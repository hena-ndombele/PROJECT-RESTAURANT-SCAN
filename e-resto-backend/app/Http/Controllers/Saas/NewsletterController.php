<?php

namespace App\Http\Controllers\Saas;

use App\Http\Controllers\Controller;
use App\Jobs\SendNewsletterCampaignEmail;
use App\Mail\NewsletterCampaignMail;
use App\Mail\NewsletterConfirmationMail;
use App\Models\NewsletterCampaign;
use App\Models\NewsletterCampaignDelivery;
use App\Models\NewsletterSubscriber;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class NewsletterController extends Controller
{
    public function subscribe(Request $request)
    {
        $validated = $request->validate(['email' => 'required|email|max:190', 'source' => 'nullable|string|max:80']);
        $email = strtolower(trim($validated['email']));
        $subscriber = NewsletterSubscriber::where('email', $email)->first();

        if ($subscriber?->status === 'confirmed') {
            return response()->json(['message' => 'Cet e-mail est déjà confirmé dans la newsletter.', 'already_exists' => true]);
        }

        $plainToken = Str::random(64);
        $data = [
            'source' => $validated['source'] ?? 'saas_landing', 'status' => 'pending',
            'confirmation_token' => hash('sha256', $plainToken), 'subscribed_at' => now(),
            'confirmed_at' => null, 'unsubscribed_at' => null, 'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1000),
        ];
        $subscriber = NewsletterSubscriber::updateOrCreate(['email' => $email], $data);
        $confirmationUrl = route('newsletter.confirm', ['subscriber' => $subscriber->id, 'token' => $plainToken]);
        Mail::to($subscriber->email)->send(new NewsletterConfirmationMail($subscriber, $confirmationUrl));

        return response()->json([
            'message' => 'Un e-mail de confirmation vous a été envoyé. Cliquez sur le bouton reçu pour confirmer votre inscription.',
            'already_exists' => false,
        ], 201);
    }

    public function confirm(NewsletterSubscriber $subscriber, string $token)
    {
        if ($subscriber->status === 'confirmed') {
            return view('newsletter.result', ['title' => 'Inscription déjà confirmée', 'message' => 'Votre adresse reçoit déjà la newsletter Restaurant Scan.']);
        }
        abort_unless($subscriber->confirmation_token && hash_equals($subscriber->confirmation_token, hash('sha256', $token)), 403);
        $subscriber->update(['status' => 'confirmed', 'confirmed_at' => now(), 'unsubscribed_at' => null, 'confirmation_token' => null]);
        return view('newsletter.result', ['title' => 'Inscription confirmée', 'message' => 'Merci ! Vous recevrez désormais les nouveautés de Restaurant Scan.']);
    }

    public function unsubscribe(Request $request, NewsletterSubscriber $subscriber)
    {
        abort_unless($request->hasValidSignature(), 403);
        $subscriber->update(['status' => 'unsubscribed', 'unsubscribed_at' => now()]);
        return view('newsletter.result', ['title' => 'Désabonnement confirmé', 'message' => 'Vous ne recevrez plus les campagnes de Restaurant Scan.']);
    }

    public function subscribers(Request $request)
    {
        $query = NewsletterSubscriber::query()->latest();
        if ($search = trim((string) $request->input('search'))) $query->where(fn ($q) => $q->where('email', 'like', "%{$search}%")->orWhere('source', 'like', "%{$search}%")->orWhere('status', 'like', "%{$search}%"));
        if ($email = trim((string) $request->input('email'))) $query->where('email', 'like', "%{$email}%");
        if ($request->filled('status')) $query->where('status', $request->input('status'));
        if ($request->filled('date')) $query->whereDate('created_at', $request->input('date'));
        if ($request->filled('month')) $query->whereMonth('created_at', $request->integer('month'));
        if ($request->filled('year')) $query->whereYear('created_at', $request->integer('year'));
        return response()->json($query->paginate(min(max($request->integer('per_page', 10), 1), 100)));
    }

    public function campaigns(Request $request)
    {
        return response()->json(NewsletterCampaign::latest()->paginate(min(max($request->integer('per_page', 10), 1), 100)));
    }

    public function storeCampaign(Request $request)
    {
        $data = $this->validateCampaign($request);
        $data['image_path'] = $request->file('image')?->store('newsletter/campaigns', 'public');
        $data['status'] = !empty($data['scheduled_at']) ? 'scheduled' : 'draft';
        $data['created_by'] = $request->user()?->id;
        return response()->json(NewsletterCampaign::create($data), 201);
    }

    public function updateCampaign(Request $request, NewsletterCampaign $campaign)
    {
        abort_if(in_array($campaign->status, ['sending', 'sent']), 422, 'Une campagne déjà envoyée ne peut plus être modifiée.');
        $data = $this->validateCampaign($request);
        if ($request->hasFile('image')) {
            if ($campaign->image_path) Storage::disk('public')->delete($campaign->image_path);
            $data['image_path'] = $request->file('image')->store('newsletter/campaigns', 'public');
        }
        if ($request->boolean('remove_image') && !$request->hasFile('image')) {
            if ($campaign->image_path) Storage::disk('public')->delete($campaign->image_path);
            $data['image_path'] = null;
        }
        $data['status'] = !empty($data['scheduled_at']) ? 'scheduled' : 'draft';
        $campaign->update($data);
        return response()->json($campaign->fresh());
    }

    public function destroyCampaign(NewsletterCampaign $campaign)
    {
        abort_if(in_array($campaign->status, ['sending', 'sent']), 422, 'Une campagne envoyée ne peut pas être supprimée.');
        if ($campaign->image_path) Storage::disk('public')->delete($campaign->image_path);
        $campaign->delete();
        return response()->json(['message' => 'Campagne supprimée.']);
    }

    public function sendTest(Request $request, NewsletterCampaign $campaign)
    {
        $validated = $request->validate(['email' => 'required|email|max:190']);
        $testSubscriber = NewsletterSubscriber::where('email', $validated['email'])->first()
            ?? NewsletterSubscriber::where('status', 'confirmed')->first();
        $url = $testSubscriber
            ? URL::temporarySignedRoute('newsletter.unsubscribe', now()->addHour(), ['subscriber' => $testSubscriber->id])
            : url('/');
        Mail::to($validated['email'])->send(new NewsletterCampaignMail($campaign, $url));
        return response()->json(['message' => 'E-mail de test envoyé.']);
    }

    public function sendNow(NewsletterCampaign $campaign)
    {
        abort_if(in_array($campaign->status, ['sending', 'sent']), 422, 'Cette campagne est déjà en cours ou envoyée.');
        $this->dispatchCampaign($campaign);
        return response()->json(['message' => 'La campagne a été placée dans la file d’envoi.', 'campaign' => $campaign->fresh()]);
    }

    public function dispatchDueCampaigns(): int
    {
        $count = 0;
        NewsletterCampaign::where('status', 'scheduled')->where('scheduled_at', '<=', now())->each(function ($campaign) use (&$count) { $this->dispatchCampaign($campaign); $count++; });
        return $count;
    }

    private function dispatchCampaign(NewsletterCampaign $campaign): void
    {
        $subscriberQuery = NewsletterSubscriber::where('status', 'confirmed');
        $recipientTotal = $subscriberQuery->count();
        $campaign->update(['status' => 'sending', 'started_at' => now(), 'recipient_total' => $recipientTotal, 'sent_count' => 0, 'failed_count' => 0]);
        if ($recipientTotal === 0) { $campaign->update(['status' => 'sent', 'sent_at' => now()]); return; }

        $subscriberQuery->select(['id', 'email'])->chunkById(500, function ($subscribers) use ($campaign) {
            foreach ($subscribers as $subscriber) {
                $delivery = NewsletterCampaignDelivery::firstOrCreate(
                    ['campaign_id' => $campaign->id, 'subscriber_id' => $subscriber->id],
                    ['email' => $subscriber->email, 'status' => 'pending']
                );
                SendNewsletterCampaignEmail::dispatch($delivery->id);
            }
        });
    }

    private function validateCampaign(Request $request): array
    {
        return $request->validate([
            'title' => 'required|string|max:190', 'subject' => 'required|string|max:190',
            'content' => 'required|string|max:50000', 'button_text' => 'nullable|string|max:80',
            'button_url' => 'nullable|url|max:2000', 'scheduled_at' => 'nullable|date|after:now',
            'image' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:5120', 'remove_image' => 'nullable|boolean',
        ]);
    }
}
