<?php

namespace App\Jobs;

use App\Mail\NewsletterCampaignMail;
use App\Models\NewsletterCampaignDelivery;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\DB;

class SendNewsletterCampaignEmail implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;
    public int $timeout = 60;

    public function __construct(public string $deliveryId) {}

    public function handle(): void
    {
        $delivery = NewsletterCampaignDelivery::with(['campaign', 'subscriber'])->find($this->deliveryId);
        if (!$delivery || $delivery->status === 'sent' || !$delivery->campaign || !$delivery->subscriber) return;

        if ($delivery->subscriber->status !== 'confirmed') {
            $this->markDelivery($delivery->id, 'skipped', 'Abonné non confirmé ou désabonné.');
            return;
        }

        try {
            $unsubscribeUrl = URL::temporarySignedRoute(
                'newsletter.unsubscribe', now()->addYears(5), ['subscriber' => $delivery->subscriber_id]
            );
            Mail::to($delivery->email)->send(new NewsletterCampaignMail($delivery->campaign, $unsubscribeUrl));
            $this->markDelivery($delivery->id, 'sent');
        } catch (\Throwable $exception) {
            $this->markDelivery($delivery->id, 'failed', mb_substr($exception->getMessage(), 0, 2000));
            Log::error('Newsletter campaign delivery failed.', ['delivery_id' => $delivery->id, 'error' => $exception->getMessage()]);
            throw $exception;
        }
    }

    private function markDelivery(string $deliveryId, string $status, ?string $error = null): void
    {
        DB::transaction(function () use ($deliveryId, $status, $error) {
            $delivery = NewsletterCampaignDelivery::lockForUpdate()->find($deliveryId);
            if (!$delivery || $delivery->status === $status) return;

            $campaign = $delivery->campaign()->lockForUpdate()->first();
            if (!$campaign) return;

            $previousSent = $delivery->status === 'sent' ? 1 : 0;
            $previousFailed = in_array($delivery->status, ['failed', 'skipped'], true) ? 1 : 0;
            $nextSent = $status === 'sent' ? 1 : 0;
            $nextFailed = in_array($status, ['failed', 'skipped'], true) ? 1 : 0;

            $delivery->update([
                'status' => $status,
                'sent_at' => $status === 'sent' ? now() : null,
                'error_message' => $error,
            ]);

            $sentCount = max(0, $campaign->sent_count - $previousSent + $nextSent);
            $failedCount = max(0, $campaign->failed_count - $previousFailed + $nextFailed);
            $complete = ($sentCount + $failedCount) >= $campaign->recipient_total;
            $campaign->update([
                'sent_count' => $sentCount,
                'failed_count' => $failedCount,
                'status' => $complete ? 'sent' : 'sending',
                'sent_at' => $complete ? now() : null,
            ]);
        });
    }
}
