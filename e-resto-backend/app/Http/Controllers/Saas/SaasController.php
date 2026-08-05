<?php

namespace App\Http\Controllers\Saas;

use App\Events\BusinessRestaurantsUpdated;
use App\Events\MenuUpdated;
use App\Http\Controllers\Controller;
use App\Mail\SendOtpMail;
use App\Models\ContactMessage;
use App\Models\Feedback;
use App\Models\NewsletterSubscriber;
use App\Models\Otp;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Restaurant;
use App\Models\RestaurantSubscription;
use App\Models\SaasPlan;
use App\Models\Table;
use App\Models\User;
use App\Services\MaishaPayService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

class SaasController extends Controller
{
    private const ACTIVE_PLANS_CACHE_KEY = 'saas:plans:active';

    public function __construct(private MaishaPayService $maishaPay)
    {
    }

    public function overview()
    {
        $this->ensureDefaultPlans();

        return response()->json([
            'metrics' => [
                'restaurants' => Restaurant::count(),
                'plan_counts' => [
                    'starter' => $this->countRestaurantsForPlan('starter'),
                    'pro' => $this->countRestaurantsForPlan('pro'),
                    'business' => $this->countRestaurantsForPlan('business'),
                ],
                'active_restaurants' => Restaurant::whereIn('status', ['active', 'trial'])->count(),
                'trial_restaurants' => Restaurant::where('status', 'trial')->count(),
                'past_due_restaurants' => Restaurant::where('status', 'past_due')->count(),
                'monthly_revenue' => (float) Payment::where('type', 'subscription')
                    ->where('status', 'paid')
                    ->whereMonth('paid_at', now()->month)
                    ->sum('amount'),
            ],
            'plans' => $this->cachedActivePlans(),
            'recent_restaurants' => Restaurant::with('plan')->latest()->take(6)->get(),
            'payment_methods' => $this->paymentMethods(),
        ]);
    }

    public function plans()
    {
        return response()->json($this->cachedActivePlans());
    }

    public function adminPlans()
    {
        $this->ensureDefaultPlans();

        return response()->json(SaasPlan::orderBy('monthly_price')->get());
    }

    public function newsletterSubscribe(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email|max:190',
            'source' => 'nullable|string|max:80',
        ]);

        $email = strtolower(trim($validated['email']));
        $subscriber = NewsletterSubscriber::where('email', $email)->first();

        if ($subscriber) {
            return response()->json([
                'message' => 'Cet e-mail est déjà inscrit à la newsletter.',
                'already_exists' => true,
                'subscriber' => $subscriber,
            ]);
        }

        $subscriber = NewsletterSubscriber::create([
            'email' => $email,
            'source' => $validated['source'] ?? 'saas_landing',
            'status' => 'subscribed',
            'subscribed_at' => now(),
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1000),
        ]);

        return response()->json([
            'message' => 'Votre adresse e-mail a été enregistrée dans la newsletter.',
            'already_exists' => false,
            'subscriber' => $subscriber,
        ], 201);
    }

    public function storePlan(Request $request)
    {
        $validated = $this->validatePlan($request);
        $validated['slug'] = Str::slug($validated['slug'] ?? $validated['name']);
        $validated['features'] = $this->normalizeFeatures($validated['features'] ?? []);

        $plan = SaasPlan::create($validated);
        $this->forgetPlansCache();

        return response()->json($plan, 201);
    }

    public function updatePlan(Request $request, SaasPlan $plan)
    {
        $validated = $this->validatePlan($request, $plan);
        if (isset($validated['name']) && empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }
        if (isset($validated['features'])) {
            $validated['features'] = $this->normalizeFeatures($validated['features']);
        }

        $plan->update($validated);
        $this->forgetPlansCache();

        return response()->json($plan->fresh());
    }

    public function destroyPlan(SaasPlan $plan)
    {
        if ($plan->restaurants()->exists()) {
            return response()->json([
                'message' => 'Ce plan est utilise par des restaurants et ne peut pas etre supprime.',
            ], 422);
        }

        $plan->delete();
        $this->forgetPlansCache();

        return response()->json(['message' => 'Plan supprime avec succes.']);
    }

    public function signup(Request $request)
    {
        $this->ensureDefaultPlans();

        $validated = $request->validate([
            'restaurant_name' => 'required|string|max:255',
            'legal_name' => 'nullable|string|max:255',
            'owner_name' => 'required|string|max:255',
            'owner_email' => 'required|email|max:255|unique:users,email',
            'owner_phone' => 'required|string|max:30',
            'password' => 'required_without:google_credential|nullable|string|min:6|confirmed',
            'google_credential' => 'nullable|string',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:120',
            'commune' => 'nullable|string|max:120',
            'country' => 'nullable|string|max:2',
            'currency' => 'nullable|string|in:USD,CDF',
            'saas_plan_id' => 'required|string|max:80',
        ], [
            'restaurant_name.required' => 'Le nom du restaurant est obligatoire.',
            'owner_name.required' => 'Le nom du propriétaire est obligatoire.',
            'owner_email.required' => 'L adresse email est obligatoire.',
            'owner_email.email' => 'L adresse email est invalide.',
            'owner_email.unique' => 'Cette adresse email possede deja un compte.',
            'owner_phone.required' => 'Le numero de téléphone est obligatoire.',
            'password.required_without' => 'Le mot de passe est obligatoire.',
            'password.min' => 'Le mot de passe doit contenir au moins 6 caracteres.',
            'password.confirmed' => 'Les mots de passe ne correspondent pas.',
            'saas_plan_id.required' => 'Choisissez un plan avant de creer le compte.',
            'saas_plan_id.string' => 'Le plan selectionne est invalide. Revenez depuis la page Tarifs.',
        ]);

        $plan = $this->resolveSignupPlan($validated['saas_plan_id']);
        if (!$plan) {
            return response()->json([
                'message' => 'Le plan selectionne est invalide. Revenez depuis la page Tarifs.',
                'errors' => [
                    'saas_plan_id' => ['Le plan selectionne est invalide. Revenez depuis la page Tarifs.'],
                ],
            ], 422);
        }

        if (!empty($validated['google_credential'])) {
            $googleProfile = $this->verifiedGoogleProfile($validated['google_credential']);

            if (!$googleProfile || strcasecmp($googleProfile['email'], $validated['owner_email']) !== 0) {
                return response()->json(['message' => 'Le compte Google ne correspond pas a cette adresse email.'], 422);
            }
        }

        return DB::transaction(function () use ($validated, $plan) {
            [$firstName, $lastName] = $this->splitName($validated['owner_name']);

            $ownerPhone = $this->normalizeCongoPhone($validated['owner_phone']);

            $restaurant = Restaurant::create([
                'name' => $validated['restaurant_name'],
                'slug' => $this->uniqueRestaurantSlug($validated['restaurant_name']),
                'legal_name' => $validated['legal_name'] ?? null,
                'owner_name' => $validated['owner_name'],
                'owner_email' => $validated['owner_email'],
                'owner_phone' => $ownerPhone,
                'address' => $validated['address'] ?? null,
                'city' => $validated['city'] ?? null,
                'commune' => $validated['commune'] ?? null,
                'country' => $validated['country'] ?? 'CD',
                'currency' => $validated['currency'] ?? 'CDF',
                'status' => ((float) $plan->monthly_price) <= 0 ? 'active' : 'trial',
                'saas_plan_id' => $plan->id,
                'trial_ends_at' => ((float) $plan->monthly_price) <= 0 ? null : now()->addDays(14),
                'settings' => [
                    ...$this->defaultRestaurantSettings(),
                    'account_created_mail_sent' => false,
                ],
            ]);

            $user = User::create([
                'restaurant_id' => $restaurant->id,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $validated['owner_email'],
                'phone_number' => $ownerPhone,
                'address' => $validated['address'] ?? null,
                'password' => Hash::make($validated['password'] ?? Str::random(48)),
                'is_first_login' => false,
            ]);

            $restaurant->update(['business_owner_user_id' => $user->id]);

            RestaurantSubscription::create([
                'restaurant_id' => $restaurant->id,
                'saas_plan_id' => $plan->id,
                'status' => ((float) $plan->monthly_price) <= 0 ? 'active' : 'trialing',
                'starts_at' => Carbon::today(),
                'ends_at' => ((float) $plan->monthly_price) <= 0 ? null : Carbon::today()->addDays(14),
                'next_billing_at' => ((float) $plan->monthly_price) <= 0 ? null : Carbon::today()->addDays(14),
                'amount' => $plan->monthly_price,
                'currency' => $plan->currency,
            ]);

            $otpCode = rand(10000, 99999);
            Otp::where('user_id', $user->id)->delete();
            Otp::create([
                'user_id' => $user->id,
                'code' => $otpCode,
                'expires_at' => now()->addMinutes(5),
            ]);

            $mailSent = true;
            try {
                Mail::to($user->email)->send(new SendOtpMail((string) $otpCode, $restaurant));
            } catch (\Throwable $exception) {
                $mailSent = false;
                Log::warning('Restaurant signup OTP mail failed.', [
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'error' => $exception->getMessage(),
                ]);
            }

            return response()->json([
                'message' => 'Compte crée. Un code OTP a été envoyé à votre adresse e-mail.',
                'message' => $mailSent
                    ? 'Compte cree. Un code OTP a ete envoye a votre adresse e-mail.'
                    : 'Compte cree, mais l e-mail OTP n a pas pu etre envoye. Verifiez la configuration mail.',
                'restaurant' => $restaurant->load(['plan', 'subscription']),
                'owner' => $user,
                'requires_otp' => true,
                'mail_sent' => $mailSent,
            ], 201);
        });
    }

    public function checkout(Request $request)
    {
        $validated = $request->validate([
            'restaurant_id' => 'required|uuid|exists:restaurants,id',
            'saas_plan_id' => 'sometimes|nullable|string|max:80',
            'provider' => 'required|string|in:MPESA,AIRTEL,ORANGE,MTN,mpesa,airtel,orange,mtn',
            'wallet_id' => 'required|string|min:10|max:30',
            'billing_cycle' => 'sometimes|string|in:monthly,yearly',
            'reference' => 'sometimes|nullable|string|max:60|unique:payments,reference',
        ]);

        $provider = Str::upper($validated['provider']);
        $walletId = $this->normalizeWalletId($validated['wallet_id']);
        $this->ensureDefaultPlans();

        if (!$this->isValidWalletForProvider($walletId, $provider)) {
            return response()->json([
                'message' => $this->walletValidationMessage($provider),
            ], 422);
        }

        $callbackUrl = config('services.maishapay.callback_url') ?: url('/api/saas/payment-callback');

        return DB::transaction(function () use ($validated, $provider, $walletId, $callbackUrl) {
            $restaurant = Restaurant::with(['plan', 'subscription', 'users'])->findOrFail($validated['restaurant_id']);
            $this->refreshBillingStatus($restaurant);
            $restaurant->refresh();

            $plan = !empty($validated['saas_plan_id'])
                ? $this->resolveSignupPlan($validated['saas_plan_id'])
                : ($restaurant->plan ?: SaasPlan::where('slug', 'starter')->firstOrFail());
            if (!$plan) {
                return response()->json(['message' => 'Le plan selectionne est invalide.'], 422);
            }
            $billingCycle = $validated['billing_cycle'] ?? 'monthly';
            $amount = $this->planPriceForCycle($plan, $billingCycle);
            $baseAmount = $billingCycle === 'yearly'
                ? $this->yearlyPrice($plan)
                : $this->monthlyPrice($plan);

            $payment = Payment::create([
                'restaurant_id' => $restaurant->id,
                'type' => 'subscription',
                'method' => 'mobile_money',
                'provider' => $provider,
                'status' => 'pending',
                'amount' => $amount,
                'currency' => $plan->currency,
                'reference' => ($validated['reference'] ?? null) ?: 'SUB-' . Str::upper(Str::random(10)),
                'metadata' => [
                    'plan_id' => $plan->id,
                    'plan_slug' => $plan->slug,
                    'plan_name' => $plan->name,
                    'wallet_id' => $walletId,
                    'wallet_id_original' => $validated['wallet_id'],
                    'billing_cycle' => $billingCycle,
                    'base_amount' => $baseAmount,
                    'discount_amount' => max(0, $baseAmount - $amount),
                    'promo_label' => $plan->hasActivePromo() ? $plan->promo_label : null,
                    'promo_percent' => $plan->hasActivePromo() ? $plan->promo_percent : null,
                ],
            ]);

            $response = $this->maishaPay->collectMobileMoney(
                $payment,
                ['name' => $restaurant->owner_name, 'email' => $restaurant->owner_email],
                $provider,
                $walletId,
                $callbackUrl
            );

            $status = $this->normalizePaymentStatus(
                $response['transactionStatus']
                    ?? $response['status']
                    ?? $response['data']['transactionStatus']
                    ?? null
            );

            if (($response['gateway_success'] ?? true) === false && $status === 'pending') {
                $status = 'failed';
            }

            $payment->update([
                'status' => $status,
                'paid_at' => $status === 'paid' ? now() : null,
                'metadata' => [
                    ...($payment->metadata ?? []),
                    'maishapay_response' => $response,
                ],
            ]);

            if ($status === 'paid') {
                $this->activateRestaurant($restaurant, $payment);
            }

            $owner = $restaurant->users()->first();
            $message = match ($status) {
                'paid' => 'Paiement confirme. Votre abonnement est actif.',
                'pending' => 'Demande de paiement envoyée. Confirmez sur votre téléphone pour activer votre abonnement.',
                default => $this->gatewayFailureMessage($response),
            };
            $httpStatus = match ($status) {
                'paid' => 200,
                'pending' => 202,
                default => 422,
            };

            return response()->json([
                'message' => $message,
                'payment' => $payment->fresh(),
                'maishapay' => $response,
                'restaurant' => $restaurant->fresh(['plan', 'subscription']),
                'session' => $owner && $status === 'paid' ? $this->sessionPayload($owner) : null,
            ], $httpStatus);
        });
    }

    public function checkoutStatus(Payment $payment)
    {
        if ($payment->type !== 'subscription') {
            return response()->json(['message' => 'Paiement abonnement introuvable.'], 404);
        }

        $payment->load('restaurant.plan', 'restaurant.subscription', 'restaurant.users');
        $owner = $payment->restaurant?->users()->first();

        return response()->json([
            'message' => match ($payment->status) {
                'paid' => 'Paiement confirme. Votre abonnement est actif.',
                'pending' => 'Paiement encore en attente de confirmation operateur.',
                default => 'Paiement non confirme. Verifiez le numero puis réessayez.',
            },
            'payment' => $payment,
            'restaurant' => $payment->restaurant ? $this->restaurantPayload($payment->restaurant) : null,
            'session' => $owner && $payment->status === 'paid' ? $this->sessionPayload($owner) : null,
        ]);
    }

    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::with('restaurant.plan', 'restaurant.subscription')
            ->where('email', $validated['email'])
            ->first();

        if (!$user || !$user->restaurant || !Hash::check($validated['password'], $user->password)) {
            return response()->json(['message' => 'Identifiants restaurant incorrects.'], 401);
        }

        $this->refreshBillingStatus($user->restaurant);
        $user->restaurant->refresh();

        if (!$this->canAccessWorkspace($user->restaurant)) {
            return response()->json([
                'message' => 'Votre essai ou abonnement est expire. Reglez votre abonnement pour continuer.',
                'restaurant' => $this->restaurantPayload($user->restaurant),
            ], 402);
        }

        return response()->json($this->sessionPayload($user));
    }

    public function googleConfig()
    {
        $clientId = config('services.google.client_id');

        return response()->json([
            'enabled' => filled($clientId),
            'client_id' => $clientId,
        ]);
    }

    public function googleLogin(Request $request)
    {
        $validated = $request->validate([
            'credential' => 'required|string',
        ]);

        $profile = $this->verifiedGoogleProfile($validated['credential']);
        if (!$profile) {
            return response()->json(['message' => 'Connexion Google invalide ou expiree.'], 401);
        }

        $user = User::with('restaurant.plan', 'restaurant.subscription')
            ->where('email', $profile['email'])
            ->first();

        if (!$user || !$user->restaurant) {
            return response()->json([
                'message' => 'Aucun espace restaurant n est associe a ce compte Google.',
            ], 404);
        }

        $this->refreshBillingStatus($user->restaurant);
        $user->restaurant->refresh();

        if (!$this->canAccessWorkspace($user->restaurant)) {
            return response()->json([
                'message' => 'Votre essai ou abonnement est expire. Reglez votre abonnement pour continuer.',
                'restaurant' => $this->restaurantPayload($user->restaurant),
            ], 402);
        }

        return response()->json($this->sessionPayload($user));
    }

    public function paymentCallback(Request $request)
    {
        $reference = $request->input('originatingTransactionId')
            ?? $request->input('transactionReference')
            ?? $request->input('reference');

        if (!$reference) {
            return response()->json(['message' => 'Reference paiement manquante.'], 422);
        }

        $payment = Payment::where('reference', $reference)->firstOrFail();
        $status = $this->normalizePaymentStatus($request->input('transactionStatus'));

        $payment->update([
            'status' => $status,
            'paid_at' => $status === 'paid' ? now() : $payment->paid_at,
            'metadata' => [
                ...($payment->metadata ?? []),
                'callback' => $request->all(),
            ],
        ]);

        if ($status === 'paid' && $payment->restaurant) {
            $this->activateRestaurant($payment->restaurant, $payment);
        }

        return response()->json(['message' => 'Callback paiement traite.']);
    }

    public function me(Request $request)
    {
        $restaurant = $request->user()->restaurant()->with(['plan', 'subscription'])->firstOrFail();

        return response()->json($this->restaurantPayload($restaurant));
    }

    public function businessRestaurants(Request $request)
    {
        $restaurant = $request->user()->restaurant()->with('plan')->firstOrFail();
        $this->ensureBusinessOwner($request->user(), $restaurant);

        if (!$restaurant->plan?->allows('multi_restaurant')) {
            return response()->json([
                'message' => 'Le multi-restaurant est reserve au plan Business.',
            ], 403);
        }

        if (!$this->canManageBusinessRestaurants($request->user(), $restaurant)) {
            return response()->json([
                'message' => 'Seul le proprietaire du compte Business peut gerer plusieurs restaurants.',
            ], 403);
        }

        $this->refreshBillingStatus($restaurant);

        $restaurants = $this->businessRestaurantQuery($request->user())
            ->with(['plan', 'subscription'])
            ->orderBy('created_at')
            ->get()
            ->map(fn (Restaurant $restaurant) => $this->restaurantPayload($restaurant));

        return response()->json([
            'restaurants' => $restaurants,
            'current_restaurant_id' => $request->user()->restaurant_id,
            'limit' => $restaurant->plan?->max_restaurants ?? null,
        ]);
    }

    public function storeBusinessRestaurant(Request $request)
    {
        $currentRestaurant = $request->user()->restaurant()->with(['plan', 'subscription'])->firstOrFail();
        $this->ensureBusinessOwner($request->user(), $currentRestaurant);

        if (!$currentRestaurant->plan?->allows('multi_restaurant')) {
            return response()->json([
                'message' => 'Le multi-restaurant est reserve au plan Business.',
            ], 403);
        }

        if (!$this->canManageBusinessRestaurants($request->user(), $currentRestaurant)) {
            return response()->json([
                'message' => 'Seul le proprietaire du compte Business peut ajouter un restaurant.',
            ], 403);
        }

        $this->refreshBillingStatus($currentRestaurant);
        $currentRestaurant = $currentRestaurant->fresh(['plan', 'subscription']);

        $limit = $currentRestaurant->plan?->max_restaurants;
        $currentCount = $this->businessRestaurantQuery($request->user())->count();
        if ($limit !== null && $currentCount >= (int) $limit) {
            return response()->json([
                'message' => "Limite de {$limit} restaurants atteinte pour votre plan Business.",
            ], 422);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'legal_name' => 'nullable|string|max:255',
            'owner_phone' => 'nullable|string|max:30',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:120',
            'commune' => 'nullable|string|max:120',
            'country' => 'nullable|string|max:2',
            'currency' => 'nullable|string|in:USD,CDF',
        ]);

        $businessOwnerId = $this->businessOwnerId($request->user());
        $restaurant = Restaurant::create([
            'name' => $validated['name'],
            'slug' => $this->uniqueRestaurantSlug($validated['name']),
            'legal_name' => $validated['legal_name'] ?? null,
            'owner_name' => $currentRestaurant->owner_name ?: trim($request->user()->first_name . ' ' . $request->user()->last_name),
            'owner_email' => $currentRestaurant->owner_email ?: $request->user()->email,
            'owner_phone' => $this->normalizeCongoPhone($validated['owner_phone'] ?? $currentRestaurant->owner_phone),
            'address' => $validated['address'] ?? null,
            'city' => $validated['city'] ?? null,
            'commune' => $validated['commune'] ?? null,
            'country' => $validated['country'] ?? $currentRestaurant->country ?? 'CD',
            'currency' => $validated['currency'] ?? $currentRestaurant->currency ?? 'CDF',
            'status' => $currentRestaurant->status,
            'saas_plan_id' => $currentRestaurant->saas_plan_id,
            'business_owner_user_id' => $businessOwnerId,
            'trial_ends_at' => $currentRestaurant->trial_ends_at,
            'subscription_ends_at' => $currentRestaurant->subscription_ends_at,
            'settings' => $this->defaultRestaurantSettings(),
        ]);

        if ($currentRestaurant->plan) {
            RestaurantSubscription::create([
                'restaurant_id' => $restaurant->id,
                'saas_plan_id' => $currentRestaurant->plan->id,
                'status' => $currentRestaurant->subscription?->status ?? ($restaurant->status === 'active' ? 'active' : 'trialing'),
                'starts_at' => Carbon::today(),
                'ends_at' => $currentRestaurant->subscription?->ends_at,
                'next_billing_at' => $currentRestaurant->subscription?->next_billing_at,
                'amount' => $currentRestaurant->subscription?->amount ?? $currentRestaurant->plan->monthly_price,
                'currency' => $currentRestaurant->subscription?->currency ?? $currentRestaurant->plan->currency,
            ]);
        }

        $restaurantPayload = $this->restaurantPayload($restaurant->fresh(['plan', 'subscription']));
        $this->broadcastBusinessRestaurantsUpdated($businessOwnerId, 'created', $restaurant->id, [
            'restaurant' => $restaurantPayload,
        ]);

        return response()->json([
            'message' => 'Restaurant ajouté avec succès.',
            'restaurant' => $restaurantPayload,
        ], 201);
    }

    public function switchBusinessRestaurant(Request $request, Restaurant $restaurant)
    {
        $currentRestaurant = $request->user()->restaurant()->with('plan')->firstOrFail();
        $this->ensureBusinessOwner($request->user(), $currentRestaurant);

        if (!$currentRestaurant->plan?->allows('multi_restaurant')) {
            return response()->json([
                'message' => 'Le multi-restaurant est reserve au plan Business.',
            ], 403);
        }

        if (!$this->canManageBusinessRestaurants($request->user(), $currentRestaurant)) {
            return response()->json([
                'message' => 'Seul le proprietaire du compte Business peut changer de restaurant.',
            ], 403);
        }

        $businessOwnerId = $this->businessOwnerId($request->user());
        $restaurantOwnerId = $restaurant->business_owner_user_id ?: ($restaurant->id === $currentRestaurant->id ? $businessOwnerId : null);
        $sameOwnerBusinessRestaurant = $this->isSameBusinessGroupRestaurant($restaurant, $currentRestaurant);

        if ($restaurantOwnerId !== $businessOwnerId && !$sameOwnerBusinessRestaurant) {
            return response()->json([
                'message' => 'Ce restaurant ne fait pas partie de votre espace Business.',
            ], 403);
        }

        if ($restaurant->business_owner_user_id !== $businessOwnerId) {
            $restaurant->update(['business_owner_user_id' => $businessOwnerId]);
        }

        $request->user()->update(['restaurant_id' => $restaurant->id]);
        $user = $request->user()->fresh(['roles.permissions', 'agent', 'restaurant.plan', 'restaurant.subscription']);

        return response()->json([
            'message' => 'Restaurant actif change avec succes.',
            'user' => $user,
            'restaurant' => $this->restaurantPayload($user->restaurant),
        ]);
    }

    public function destroyBusinessRestaurant(Request $request, Restaurant $restaurant)
    {
        $currentRestaurant = $request->user()->restaurant()->with('plan')->firstOrFail();
        $this->ensureBusinessOwner($request->user(), $currentRestaurant);

        if (!$currentRestaurant->plan?->allows('multi_restaurant')) {
            return response()->json([
                'message' => 'Le multi-restaurant est reserve au plan Business.',
            ], 403);
        }

        $businessOwnerId = $this->businessOwnerId($request->user());
        $isOwner = $currentRestaurant->business_owner_user_id === $request->user()->id
            || strcasecmp((string) $currentRestaurant->owner_email, (string) $request->user()->email) === 0;

        if (!$isOwner) {
            return response()->json([
                'message' => 'Seul le proprietaire du compte Business peut supprimer un restaurant.',
            ], 403);
        }

        $restaurantOwnerId = $restaurant->business_owner_user_id ?: ($restaurant->id === $currentRestaurant->id ? $businessOwnerId : null);
        $sameOwnerBusinessRestaurant = $this->isSameBusinessGroupRestaurant($restaurant, $currentRestaurant);
        if ($restaurantOwnerId !== $businessOwnerId && !$sameOwnerBusinessRestaurant) {
            return response()->json([
                'message' => 'Ce restaurant ne fait pas partie de votre espace Business.',
            ], 403);
        }

        $restaurants = $this->businessRestaurantQuery($request->user())
            ->orderBy('created_at')
            ->get();

        if ($restaurants->count() <= 1) {
            return response()->json([
                'message' => 'Impossible de supprimer le dernier restaurant du compte Business.',
            ], 422);
        }

        $fallbackRestaurant = $restaurants
            ->first(fn (Restaurant $item) => $item->id !== $restaurant->id);

        if (!$fallbackRestaurant) {
            return response()->json([
                'message' => 'Aucun autre restaurant disponible pour continuer votre session.',
            ], 422);
        }

        if ($request->user()->restaurant_id === $restaurant->id) {
            $request->user()->update(['restaurant_id' => $fallbackRestaurant->id]);
        }

        $deletedRestaurantId = $restaurant->id;
        $restaurant->delete();

        $user = $request->user()->fresh(['roles.permissions', 'agent', 'restaurant.plan', 'restaurant.subscription']);
        $remainingRestaurants = $this->businessRestaurantQuery($user)
            ->with(['plan', 'subscription'])
            ->orderBy('created_at')
            ->get()
            ->map(fn (Restaurant $item) => $this->restaurantPayload($item));

        $fallbackPayload = $this->restaurantPayload($user->restaurant);
        $this->broadcastBusinessRestaurantsUpdated($businessOwnerId, 'deleted', $deletedRestaurantId, [
            'fallback_restaurant' => $fallbackPayload,
        ]);

        return response()->json([
            'message' => 'Restaurant Business supprime avec succes.',
            'user' => $user,
            'restaurant' => $fallbackPayload,
            'restaurants' => $remainingRestaurants,
            'current_restaurant_id' => $user->restaurant_id,
        ]);
    }

    public function dashboard(Request $request)
    {
        $restaurant = $request->user()->restaurant()->with(['plan', 'subscription'])->firstOrFail();
        $this->refreshBillingStatus($restaurant);
        $restaurant->refresh();

        if (!$this->canAccessWorkspace($restaurant)) {
            return response()->json([
                'message' => 'Votre espace est limite car votre abonnement est expire.',
                'restaurant' => $this->restaurantPayload($restaurant),
                'requires_payment' => true,
            ], 402);
        }

        [$todayStart, $todayEnd] = $this->localDateRange(Carbon::now(config('app.display_timezone', 'Africa/Kinshasa'))->toDateString());
        $todayOrders = $restaurant->orders()->whereBetween('created_at', [$todayStart, $todayEnd]);
        $paidTodayOrders = (clone $todayOrders)->where('payment_status', 'paid')->with('items')->get();

        return response()->json([
            'restaurant' => $this->restaurantPayload($restaurant),
            'metrics' => [
                'orders_today' => (clone $todayOrders)->count(),
                'revenue_today' => (float) $paidTodayOrders->sum(fn ($order) => (float) $order->total_amount),
                'revenue_today_by_currency' => $this->ordersRevenueByCurrency($paidTodayOrders),
                'tables' => $restaurant->tables()->count(),
                'active_tables' => $restaurant->tables()->where('status', '!=', 'Libre')->count(),
                'team' => $restaurant->users()->count(),
            ],
            'recent_orders' => $restaurant->orders()->with(['table', 'items.plat'])->latest()->take(8)->get(),
        ]);
    }

    public function businessAnalytics(Request $request)
    {
        $restaurant = $request->user()->restaurant()->with('plan')->firstOrFail();
        $this->ensureBusinessOwner($request->user(), $restaurant);

        if (!$this->canManageBusinessRestaurants($request->user(), $restaurant)) {
            return response()->json([
                'message' => 'La vue globale Business est reservee au proprietaire ou aux roles autorises.',
            ], 403);
        }

        $month = (int) $request->query('month', Carbon::now()->month);
        $year = (int) $request->query('year', Carbon::now()->year);
        $month = min(12, max(1, $month));
        $year = min(Carbon::now()->year + 1, max(2020, $year));

        $restaurants = $this->businessRestaurantQuery($request->user())
            ->withCount(['tables', 'users'])
            ->orderBy('created_at')
            ->get();
        $restaurantIds = $restaurants->pluck('id');
        $today = Carbon::today();
        $selectedPeriod = Carbon::create($year, $month, 1);
        $monthStart = $selectedPeriod->copy()->startOfMonth();
        $monthEnd = $selectedPeriod->copy()->endOfMonth();
        $yearStart = Carbon::create($year, 1, 1)->startOfYear();
        $yearEnd = Carbon::create($year, 12, 31)->endOfYear();

        $monthOrders = Order::query()
            ->whereIn('restaurant_id', $restaurantIds)
            ->whereBetween('created_at', [$monthStart, $monthEnd]);

        $restaurantRows = $restaurants->map(function (Restaurant $restaurant) use ($monthStart, $monthEnd) {
            $orders = $restaurant->orders()->whereBetween('created_at', [$monthStart, $monthEnd]);
            $paidOrders = (clone $orders)->where('payment_status', 'paid')->with('items')->get();
            $revenue = $this->ordersRevenueByCurrency($paidOrders);
            $ordersCount = (clone $orders)->count();

            return [
                'id' => $restaurant->id,
                'name' => $restaurant->name,
                'city' => $restaurant->city,
                'logo_url' => $restaurant->logo ? asset("storage/{$restaurant->logo}") : null,
                'orders_count' => $ordersCount,
                'paid_orders_count' => $paidOrders->count(),
                'revenue_by_currency' => $revenue,
                'tables_count' => $restaurant->tables_count,
                'users_count' => $restaurant->users_count,
                'score' => $paidOrders->sum(fn ($order) => (float) $order->total_amount),
            ];
        })->sortByDesc('score')->values();

        $topRestaurant = $restaurantRows->first();
        $weakestRestaurant = $restaurantRows->sortBy('score')->first();

        return response()->json([
            'period' => [
                'label' => $selectedPeriod->locale('fr')->isoFormat('MMMM YYYY'),
                'from' => $monthStart->toDateString(),
                'to' => $monthEnd->toDateString(),
                'month' => $month,
                'year' => $year,
            ],
            'summary' => [
                'restaurants_count' => $restaurants->count(),
                'orders_today' => Order::whereIn('restaurant_id', $restaurantIds)->whereDate('created_at', $today)->count(),
                'orders_month' => (clone $monthOrders)->count(),
                'orders_year' => Order::whereIn('restaurant_id', $restaurantIds)->whereBetween('created_at', [$yearStart, $yearEnd])->count(),
                'revenue_month_by_currency' => $this->ordersRevenueByCurrency(
                    Order::whereIn('restaurant_id', $restaurantIds)
                        ->whereBetween('created_at', [$monthStart, $monthEnd])
                        ->where('payment_status', 'paid')
                        ->with('items')
                        ->get()
                ),
                'revenue_year_by_currency' => $this->ordersRevenueByCurrency(
                    Order::whereIn('restaurant_id', $restaurantIds)
                        ->whereBetween('created_at', [$yearStart, $yearEnd])
                        ->where('payment_status', 'paid')
                        ->with('items')
                        ->get()
                ),
                'best_restaurant' => $topRestaurant,
                'weakest_restaurant' => $weakestRestaurant,
            ],
            'restaurants' => $restaurantRows,
            'monthly_evolution' => $this->businessMonthlyEvolution($restaurantIds),
            'top_dishes' => $this->businessTopDishes($restaurantIds, $monthStart, $monthEnd),
        ]);
    }

    public function usage(Request $request)
    {
        $restaurant = $request->user()->restaurant()->with(['plan', 'subscription'])->firstOrFail();
        $this->refreshBillingStatus($restaurant);
        $restaurant->refresh();
        $restaurant->loadMissing('plan');

        $limits = [
            'tables' => $restaurant->plan?->maxTables(),
            'users' => $restaurant->plan?->maxUsers(),
            'roles' => $this->roleLimitForPlan($restaurant->plan?->tier() ?? 'starter'),
            'dishes' => $restaurant->plan?->maxDishes(),
            'orders_month' => $restaurant->plan?->maxOrdersPerMonth(),
        ];

        $monthStart = Carbon::now()->startOfMonth();
        $monthEnd = Carbon::now()->endOfMonth();
        $usage = [
            'tables' => $restaurant->tables()->count(),
            'users' => $restaurant->users()->count(),
            'roles' => Schema::hasColumn('roles', 'restaurant_id')
                ? Role::where('restaurant_id', $restaurant->id)->count()
                : 0,
            'dishes' => $restaurant->plats()->count(),
            'orders_month' => $restaurant->orders()->whereBetween('created_at', [$monthStart, $monthEnd])->count(),
        ];

        $canCreateTable = $limits['tables'] === null || ($limits['tables'] > 0 && $usage['tables'] < $limits['tables']);
        $canCreateUser = $limits['users'] === null || ($limits['users'] > 0 && $usage['users'] < $limits['users']);
        $canCreateRole = $limits['roles'] === null || ($limits['roles'] > 0 && $usage['roles'] < $limits['roles']);
        $canCreateDish = $limits['dishes'] === null || $usage['dishes'] < $limits['dishes'];
        $canAcceptOrder = $limits['orders_month'] === null || $usage['orders_month'] < $limits['orders_month'];
        $features = $restaurant->plan?->featurePermissions() ?? [];

        return response()->json([
            'plan' => $restaurant->plan,
            'restaurant_status' => $restaurant->status,
            'limits' => $limits,
            'usage' => $usage,
            'permissions' => [
                'can_create_table' => $canCreateTable,
                'can_create_user' => $canCreateUser,
                'can_create_dish' => $canCreateDish,
                'can_accept_order' => $canAcceptOrder,
                'can_use_mobile_money' => (bool) ($features['mobile_money'] ?? false),
                'can_view_analytics' => (bool) ($features['analytics'] ?? false),
                'can_view_advanced_analytics' => (bool) ($features['advanced_analytics'] ?? false),
                'can_customize_menu' => (bool) ($features['customization'] ?? false),
                'can_use_feedback' => (bool) ($features['feedback'] ?? false),
                'can_use_reservations' => (bool) ($features['reservations'] ?? false),
                'can_use_group_orders' => (bool) ($features['group_orders'] ?? false),
                'can_use_chatbot' => (bool) ($features['chatbot'] ?? false),
                'can_manage_roles' => (bool) ($features['roles'] ?? false),
                'can_create_role' => $canCreateRole,
                'can_use_multi_restaurant' => (bool) ($features['multi_restaurant'] ?? false),
                'can_use_dish_promotions' => (bool) ($features['dish_promotions'] ?? false),
            ],
            'features' => $features,
            'payment_methods' => $restaurant->plan?->includedPaymentMethods() ?? ['cash'],
            'messages' => [
                'tables' => $limits['tables'] === null
                    ? 'Tables illimitees'
                    : ($canCreateTable ? "{$usage['tables']} / {$limits['tables']} tables utilisées" : "Limite de {$limits['tables']} tables atteinte pour le plan {$restaurant->plan?->name}."),
                'users' => $limits['users'] === null
                    ? 'Utilisateurs illimites'
                    : ($canCreateUser ? "{$usage['users']} / {$limits['users']} utilisateurs utilisés" : "Limite de {$limits['users']} utilisateurs atteinte pour le plan {$restaurant->plan?->name}."),
                'roles' => $limits['roles'] === null
                    ? 'Roles illimites'
                    : ($canCreateRole ? "{$usage['roles']} / {$limits['roles']} roles utilisés" : "Limite de {$limits['roles']} roles atteinte pour le plan {$restaurant->plan?->name}."),
                'dishes' => $limits['dishes'] === null
                    ? 'Plats illimites'
                    : ($canCreateDish ? "{$usage['dishes']} / {$limits['dishes']} plats utilisés" : "Limite de {$limits['dishes']} plats atteinte pour le plan {$restaurant->plan?->name}."),
                'orders_month' => $limits['orders_month'] === null
                    ? 'Commandes illimitees'
                    : ($canAcceptOrder ? "{$usage['orders_month']} / {$limits['orders_month']} commandes ce mois" : "Limite de {$limits['orders_month']} commandes mensuelles atteinte pour le plan {$restaurant->plan?->name}."),
            ],
        ]);
    }

    public function restaurantPayments(Request $request)
    {
        $restaurant = $request->user()->restaurant;
        if (!$restaurant) {
            return response()->json([]);
        }

        $query = Payment::query()
            ->where('restaurant_id', $restaurant->id)
            ->where('type', 'subscription')
            ->latest();

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        return response()->json($query->limit(100)->get());
    }

    public function updateProfile(Request $request)
    {
        $currentRestaurant = $request->user()->restaurant()->with('plan')->firstOrFail();
        $restaurant = $currentRestaurant;

        $validated = $request->validate([
            'restaurant_id' => 'sometimes|uuid|exists:restaurants,id',
            'name' => 'sometimes|string|max:255',
            'owner_name' => 'sometimes|nullable|string|max:255',
            'owner_phone' => 'sometimes|nullable|string|max:30',
            'address' => 'sometimes|nullable|string|max:255',
            'city' => 'sometimes|nullable|string|max:120',
            'commune' => 'sometimes|nullable|string|max:120',
            'currency' => 'sometimes|string|in:USD,CDF',
            'slug' => 'sometimes|string|max:80|alpha_dash|unique:restaurants,slug,' . $restaurant->id,
            'logo_data' => 'sometimes|nullable|string',
            'settings' => 'sometimes|array',
            'settings.usd_cdf_rate' => 'sometimes|numeric|min:1',
        ]);

        if (!empty($validated['restaurant_id']) && (string) $validated['restaurant_id'] !== (string) $currentRestaurant->id) {
            $targetRestaurant = Restaurant::with('plan')->findOrFail($validated['restaurant_id']);
            $businessOwnerId = $this->businessOwnerId($request->user());
            $targetOwnerId = $targetRestaurant->business_owner_user_id
                ?: ($targetRestaurant->id === $currentRestaurant->id ? $businessOwnerId : null);
            $sameOwnerBusinessRestaurant = $this->isSameBusinessGroupRestaurant($targetRestaurant, $currentRestaurant);

            if (!$this->canManageBusinessRestaurants($request->user(), $currentRestaurant)
                || ($targetOwnerId !== $businessOwnerId && !$sameOwnerBusinessRestaurant)) {
                return response()->json([
                    'message' => 'Vous ne pouvez pas modifier ce restaurant.',
                ], 403);
            }

            $restaurant = $targetRestaurant;
        }

        unset($validated['restaurant_id']);

        $protectedSettingKeys = ['qr_template'];
        $settingsPayload = $request->input('settings', []);
        $hasProtectedSettings = is_array($settingsPayload)
            && count(array_intersect(array_keys($settingsPayload), $protectedSettingKeys)) > 0
            && !empty($settingsPayload['qr_template'])
            && $settingsPayload['qr_template'] !== 'simple';
        $hasAdvancedCustomization = $request->has('slug') || $hasProtectedSettings;
        if ($hasAdvancedCustomization && !$restaurant->plan?->allows('customization')) {
            return response()->json([
                'message' => 'La personnalisation du menu client est reservee aux plans Pro et Business.',
            ], 403);
        }

        $logoChanged = !empty($validated['logo_data']);
        if ($logoChanged) {
            $validated['logo'] = $this->storeRestaurantLogo($validated['logo_data'], $restaurant->id);
        }

        if (array_key_exists('owner_phone', $validated)) {
            $validated['owner_phone'] = $this->normalizeCongoPhone($validated['owner_phone']);
        }

        $updateData = $validated;
        unset($updateData['settings'], $updateData['logo_data']);

        if (is_array($settingsPayload) && !empty($settingsPayload)) {
            $updateData['settings'] = array_replace_recursive($restaurant->settings ?? [], $settingsPayload);
        }

        $restaurant->forceFill($updateData)->save();
        if ($logoChanged) {
            $this->regenerateTableQrCodes($restaurant->fresh());
        }
        $this->broadcastMenuUpdated($restaurant->id, 'restaurant_settings_updated');

        return response()->json($this->restaurantPayload($restaurant->fresh(['plan', 'subscription'])));
    }

    private function roleLimitForPlan(string $tier): ?int
    {
        return match ($tier) {
            'starter' => 5,
            'pro' => 8,
            default => null,
        };
    }

    private function broadcastMenuUpdated(?string $restaurantId, string $reason): void
    {
        if (!$restaurantId) {
            return;
        }

        try {
            broadcast(new MenuUpdated($restaurantId, $reason))->toOthers();
        } catch (\Throwable) {
            // Keep the saved change even when the realtime server is unavailable.
        }
    }

    private function broadcastBusinessRestaurantsUpdated(?string $businessOwnerId, string $action, ?string $restaurantId = null, array $payload = []): void
    {
        if (!$businessOwnerId) {
            return;
        }

        try {
            broadcast(new BusinessRestaurantsUpdated($businessOwnerId, $action, $restaurantId, $payload))->toOthers();
        } catch (\Throwable) {
            // Keep the saved change even when the realtime server is unavailable.
        }
    }

    public function restaurants(Request $request)
    {
        $query = Restaurant::with(['plan', 'subscription', 'users'])
            ->withCount(['users', 'tables', 'orders'])
            ->withSum(['payments as subscription_revenue' => function ($query) {
                $query->where('type', 'subscription')->where('status', 'paid');
            }], 'amount')
            ->latest();

        if ($search = $request->query('search')) {
            $query->where(function ($builder) use ($search) {
                $builder->where('name', 'like', "%{$search}%")
                    ->orWhere('owner_name', 'like', "%{$search}%")
                    ->orWhere('owner_email', 'like', "%{$search}%")
                    ->orWhere('city', 'like', "%{$search}%");
            });
        }

        return response()->json($query->get());
    }

    public function payments(Request $request)
    {
        $query = Payment::with('restaurant')
            ->where('type', 'subscription')
            ->latest();

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($restaurantId = $request->query('restaurant_id')) {
            $query->where('restaurant_id', $restaurantId);
        }

        return response()->json($query->limit(200)->get());
    }

    public function walletBalance()
    {
        return response()->json([
            'wallet' => 'Transfert',
            'balances' => [
                'CDF' => $this->maishaPay->walletBalance('CDF'),
                'USD' => $this->maishaPay->walletBalance('USD'),
            ],
        ]);
    }

    public function supportCenter()
    {
        $reservations = Reservation::with(['restaurant', 'table'])->latest()->take(50)->get();

        return response()->json([
            'contact_messages' => ContactMessage::latest()->take(50)->get(),
            'feedbacks' => Feedback::with(['restaurant', 'order.table'])->latest()->take(50)->get(),
            'reservations' => $reservations,
            'Réservations' => $reservations,
        ]);
    }

    public function contactMessages(Request $request)
    {
        $query = ContactMessage::query()->latest();
        $this->applyAdminListingFilters($query, $request, ['email'], ['name', 'email', 'phone', 'subject', 'message']);

        return response()->json($query->paginate($this->adminPerPage($request)));
    }

    public function newsletterSubscribers(Request $request)
    {
        $query = NewsletterSubscriber::query()->latest();
        $this->applyAdminListingFilters($query, $request, ['email'], ['email', 'source', 'status']);

        return response()->json($query->paginate($this->adminPerPage($request)));
    }

    public function auditTrail()
    {
        return response()->json([
            'events' => collect()
                ->merge(Restaurant::with('plan')->latest()->take(10)->get()->map(fn ($restaurant) => [
                    'type' => 'restaurant',
                    'title' => 'Restaurant inscrit ou modifie',
                    'subject' => $restaurant->name,
                    'status' => $restaurant->status,
                    'created_at' => $restaurant->updated_at,
                ]))
                ->merge(Payment::with('restaurant')->latest()->take(10)->get()->map(fn ($payment) => [
                    'type' => 'payment',
                    'title' => 'Paiement abonnement',
                    'subject' => $payment->restaurant?->name ?? $payment->reference,
                    'status' => $payment->status,
                    'amount' => $payment->amount,
                    'currency' => $payment->currency,
                    'created_at' => $payment->updated_at,
                ]))
                ->sortByDesc('created_at')
                ->values(),
        ]);
    }

    public function storeRestaurant(Request $request)
    {
        $this->ensureDefaultPlans();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'legal_name' => 'nullable|string|max:255',
            'owner_name' => 'required|string|max:255',
            'owner_email' => 'required|email|max:255',
            'owner_phone' => 'nullable|string|max:30',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:120',
            'commune' => 'nullable|string|max:120',
            'country' => 'nullable|string|max:2',
            'currency' => 'nullable|string|in:USD,CDF',
            'saas_plan_id' => 'nullable|uuid|exists:saas_plans,id',
            'status' => 'nullable|string|in:pending_payment,trial,active,past_due,suspended,cancelled',
            'owner_password' => 'nullable|string|min:6',
        ]);

        $plan = isset($validated['saas_plan_id'])
            ? SaasPlan::find($validated['saas_plan_id'])
            : SaasPlan::where('slug', 'starter')->first();

        $ownerPassword = $validated['owner_password'] ?? 'Eresto@2026';
        unset($validated['owner_password']);
        $ownerPhone = $this->normalizeCongoPhone($validated['owner_phone'] ?? null);
        $validated['owner_phone'] = $ownerPhone;

        $restaurant = Restaurant::create([
            ...$validated,
            'slug' => $this->uniqueRestaurantSlug($validated['name']),
            'country' => $validated['country'] ?? 'CD',
            'currency' => $validated['currency'] ?? 'CDF',
            'status' => $validated['status'] ?? 'trial',
            'saas_plan_id' => $plan?->id,
            'trial_ends_at' => now()->addDays(14),
            'settings' => $this->defaultRestaurantSettings(),
        ]);

        if ($plan) {
            RestaurantSubscription::create([
                'restaurant_id' => $restaurant->id,
                'saas_plan_id' => $plan->id,
                'status' => $restaurant->status === 'active' ? 'active' : 'trialing',
                'starts_at' => Carbon::today(),
                'next_billing_at' => Carbon::today()->addDays(14),
                'amount' => $plan->monthly_price,
                'currency' => $plan->currency,
            ]);
        }

        if (!empty($validated['owner_email'])) {
            [$firstName, $lastName] = $this->splitName($validated['owner_name']);
            User::firstOrCreate(
                ['email' => $validated['owner_email']],
                [
                    'restaurant_id' => $restaurant->id,
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'phone_number' => $ownerPhone,
                    'address' => $validated['address'] ?? null,
                    'password' => Hash::make($ownerPassword),
                    'is_first_login' => true,
                ]
            );
        }

        return response()->json($restaurant->load(['plan', 'subscription']), 201);
    }

    public function updateRestaurant(Request $request, Restaurant $restaurant)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'legal_name' => 'nullable|string|max:255',
            'owner_name' => 'sometimes|string|max:255',
            'owner_email' => 'sometimes|email|max:255',
            'owner_phone' => 'nullable|string|max:30',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:120',
            'commune' => 'nullable|string|max:120',
            'country' => 'nullable|string|max:2',
            'currency' => 'nullable|string|in:USD,CDF',
            'saas_plan_id' => 'nullable|uuid|exists:saas_plans,id',
            'status' => 'nullable|string|in:pending_payment,trial,active,past_due,suspended,cancelled',
        ]);

        if (isset($validated['name']) && $validated['name'] !== $restaurant->name) {
            $validated['slug'] = $this->uniqueRestaurantSlug($validated['name'], $restaurant->id);
        }

        if (array_key_exists('owner_phone', $validated)) {
            $validated['owner_phone'] = $this->normalizeCongoPhone($validated['owner_phone']);
        }

        $restaurant->update($validated);

        if (array_key_exists('saas_plan_id', $validated) || array_key_exists('status', $validated)) {
            $plan = $restaurant->fresh()->plan;
            if ($plan) {
                RestaurantSubscription::updateOrCreate(
                    ['restaurant_id' => $restaurant->id],
                    [
                        'saas_plan_id' => $plan->id,
                        'status' => match ($restaurant->fresh()->status) {
                            'active' => 'active',
                            'past_due' => 'past_due',
                            'suspended' => 'suspended',
                            'cancelled' => 'cancelled',
                            default => 'trialing',
                        },
                        'starts_at' => Carbon::today(),
                        'ends_at' => $restaurant->fresh()->status === 'active' ? Carbon::today()->addMonth() : null,
                        'next_billing_at' => $restaurant->fresh()->status === 'active' ? Carbon::today()->addMonth() : Carbon::today()->addDays(14),
                        'amount' => $plan->monthly_price,
                        'currency' => $plan->currency,
                    ]
                );
            }
        }

        return response()->json($restaurant->fresh(['plan', 'subscription']));
    }

    public function resetOwnerPassword(Request $request, Restaurant $restaurant)
    {
        $validated = $request->validate([
            'password' => 'required|string|min:6',
        ]);

        $owner = $restaurant->users()->where('email', $restaurant->owner_email)->first()
            ?? $restaurant->users()->first();

        if (!$owner) {
            [$firstName, $lastName] = $this->splitName($restaurant->owner_name);
            $owner = User::create([
                'restaurant_id' => $restaurant->id,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $restaurant->owner_email,
                'phone_number' => $restaurant->owner_phone,
                'password' => Hash::make($validated['password']),
                'is_first_login' => true,
            ]);
        } else {
            $owner->update([
                'password' => Hash::make($validated['password']),
                'is_first_login' => true,
            ]);
        }

        return response()->json([
            'message' => 'Mot de passe propriétaire reinitialise.',
            'owner' => $owner,
        ]);
    }

    public function destroyRestaurant(Restaurant $restaurant)
    {
        $restaurant->delete();

        return response()->json(['message' => 'Restaurant supprime avec succes']);
    }

    public function registerInterest(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'owner_name' => 'required|string|max:255',
            'owner_email' => 'required|email|max:255',
            'owner_phone' => 'nullable|string|max:30',
            'city' => 'nullable|string|max:120',
            'commune' => 'nullable|string|max:120',
            'saas_plan_id' => 'nullable|uuid|exists:saas_plans,id',
        ]);

        return $this->storeRestaurant(new Request([...$validated, 'status' => 'trial']));
    }

    private function applyAdminListingFilters($query, Request $request, array $emailColumns, array $searchColumns): void
    {
        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($subQuery) use ($search, $searchColumns) {
                foreach ($searchColumns as $column) {
                    $subQuery->orWhere($column, 'like', "%{$search}%");
                }
            });
        }

        if ($email = trim((string) $request->query('email', ''))) {
            $query->where(function ($subQuery) use ($email, $emailColumns) {
                foreach ($emailColumns as $column) {
                    $subQuery->orWhere($column, 'like', "%{$email}%");
                }
            });
        }

        if ($date = trim((string) $request->query('date', ''))) {
            $query->whereDate('created_at', $date);
        }

        if ($month = (int) $request->query('month')) {
            $query->whereMonth('created_at', $month);
        }

        if ($year = (int) $request->query('year')) {
            $query->whereYear('created_at', $year);
        }
    }

    private function adminPerPage(Request $request): int
    {
        return min(max((int) $request->query('per_page', 10), 5), 50);
    }

    private function cachedActivePlans()
    {
        return Cache::remember(
            self::ACTIVE_PLANS_CACHE_KEY,
            now()->addSeconds((int) env('SAAS_PLANS_CACHE_SECONDS', 300)),
            function () {
                $this->ensureDefaultPlans();

                return SaasPlan::where('is_active', true)
                    ->orderBy('monthly_price')
                    ->get();
            }
        );
    }

    private function forgetPlansCache(): void
    {
        Cache::forget(self::ACTIVE_PLANS_CACHE_KEY);
    }

    private function countRestaurantsForPlan(string $planSlug): int
    {
        $needle = strtolower($planSlug);

        return Restaurant::whereHas('plan', function ($query) use ($needle) {
            $query->whereRaw('LOWER(slug) like ?', ["%{$needle}%"])
                ->orWhereRaw('LOWER(name) like ?', ["%{$needle}%"]);
        })->count();
    }

    private function paymentMethods(): array
    {
        return [
            ['key' => 'cash', 'name' => 'Cash', 'status' => 'active', 'description' => 'Paiement manuel a la caisse ou a table.'],
            ['key' => 'mpesa', 'name' => 'M-Pesa', 'status' => 'active', 'description' => 'Collecte Mobile Money via MaishaPay.'],
            ['key' => 'orange', 'name' => 'Orange Money', 'status' => 'active', 'description' => 'Collecte Mobile Money via MaishaPay.'],
            ['key' => 'airtel', 'name' => 'Airtel Money', 'status' => 'active', 'description' => 'Collecte Mobile Money via MaishaPay.'],
        ];
    }

    private function defaultRestaurantSettings(): array
    {
        return [
            'app_name' => 'Menu digital',
            'slogan' => 'Menu digital QR code',
            'description' => 'Menu digital QR code',
            'google_maps_url' => null,
            'whatsapp_order_phone' => null,
            'opening_time' => '08:00',
            'closing_time' => '22:00',
            'usd_cdf_rate' => 2850,
            'theme' => [
                'primary' => '#ff7a1a',
                'secondary' => '#d71920',
                'background' => '#fff7ef',
                'dark' => '#111111',
                'customized' => false,
            ],
            'payment_methods' => ['cash'],
        ];
    }

    private function storeRestaurantLogo(string $logoData, string $restaurantId): string
    {
        if (!preg_match('/^data:image\/(png|jpe?g|webp);base64,/', $logoData, $matches)) {
            throw new \InvalidArgumentException('Format du logo invalide.');
        }

        $extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
        $data = substr($logoData, strpos($logoData, ',') + 1);
        $binary = base64_decode($data, true);

        if ($binary === false) {
            throw new \InvalidArgumentException('Logo illisible.');
        }

        $path = "restaurants/{$restaurantId}/logo-" . Str::random(8) . ".{$extension}";
        Storage::disk('public')->put($path, $binary);

        return $path;
    }

    private function activateRestaurant(Restaurant $restaurant, Payment $payment): void
    {
        $restaurant->loadMissing(['plan', 'subscription']);
        $paymentMetadata = $payment->metadata ?? [];
        $plan = !empty($paymentMetadata['plan_id'])
            ? SaasPlan::find($paymentMetadata['plan_id'])
            : $restaurant->plan;
        $billingCycle = $paymentMetadata['billing_cycle'] ?? 'monthly';
        $currentEnd = collect([
            $restaurant->subscription_ends_at,
            $restaurant->subscription?->ends_at,
            $restaurant->trial_ends_at,
        ])->filter()->map(fn ($value) => Carbon::parse($value))->filter(fn (Carbon $date) => $date->isFuture())->max();
        $periodStart = $currentEnd instanceof Carbon ? $currentEnd->copy() : now();
        $subscriptionEnd = $billingCycle === 'yearly'
            ? $periodStart->copy()->addYear()
            : $periodStart->copy()->addMonth();
        $billingDate = $subscriptionEnd->copy()->startOfDay();

        $restaurantUpdates = [
            'status' => 'active',
            'saas_plan_id' => $plan?->id ?? $restaurant->saas_plan_id,
            'subscription_ends_at' => $subscriptionEnd,
        ];

        $subscriptionUpdates = [
            'saas_plan_id' => $plan?->id,
            'status' => 'active',
            'starts_at' => Carbon::today(),
            'ends_at' => $billingDate,
            'next_billing_at' => $billingDate,
            'amount' => $payment->amount,
            'currency' => $payment->currency,
        ];

        if ($plan?->allows('multi_restaurant')) {
            $this->syncBusinessSubscription($restaurant, $restaurantUpdates, $subscriptionUpdates);
            return;
        }

        $restaurant->update($restaurantUpdates);
        RestaurantSubscription::updateOrCreate(['restaurant_id' => $restaurant->id], $subscriptionUpdates);
    }

    private function syncBusinessSubscription(Restaurant $sourceRestaurant, array $restaurantUpdates, array $subscriptionUpdates): void
    {
        $businessOwnerId = $this->businessOwnerIdForRestaurant($sourceRestaurant);

        if (!$businessOwnerId) {
            $sourceRestaurant->update($restaurantUpdates);
            RestaurantSubscription::updateOrCreate(['restaurant_id' => $sourceRestaurant->id], $subscriptionUpdates);
            return;
        }

        $restaurants = Restaurant::query()
            ->where(function ($query) use ($sourceRestaurant, $businessOwnerId) {
                $query->where('business_owner_user_id', $businessOwnerId)
                    ->orWhere('id', $sourceRestaurant->id);

                if ($sourceRestaurant->owner_email) {
                    $query->orWhere(function ($ownerQuery) use ($sourceRestaurant) {
                        $ownerQuery->where('owner_email', $sourceRestaurant->owner_email)
                            ->whereNull('business_owner_user_id')
                            ->where('saas_plan_id', $sourceRestaurant->saas_plan_id);
                    });
                }
            })
            ->get();

        foreach ($restaurants as $restaurant) {
            $updates = $restaurantUpdates;
            if (!$restaurant->business_owner_user_id) {
                $updates['business_owner_user_id'] = $businessOwnerId;
            }

            $restaurant->update($updates);
            RestaurantSubscription::updateOrCreate(['restaurant_id' => $restaurant->id], $subscriptionUpdates);
        }
    }

    private function businessOwnerIdForRestaurant(Restaurant $restaurant): ?string
    {
        if ($restaurant->business_owner_user_id) {
            return $restaurant->business_owner_user_id;
        }

        if ($restaurant->owner_email) {
            return User::where('restaurant_id', $restaurant->id)
                ->where('email', $restaurant->owner_email)
                ->value('id')
                ?: User::where('email', $restaurant->owner_email)->value('id');
        }

        return null;
    }

    private function isSameBusinessGroupRestaurant(Restaurant $restaurant, Restaurant $currentRestaurant): bool
    {
        return (bool) $restaurant->owner_email
            && strcasecmp((string) $restaurant->owner_email, (string) $currentRestaurant->owner_email) === 0
            && (string) $restaurant->saas_plan_id === (string) $currentRestaurant->saas_plan_id;
    }

    private function syncBusinessSubscriptionFromGroup(Restaurant $restaurant): void
    {
        if (!$restaurant->plan?->allows('multi_restaurant')) {
            return;
        }

        $businessOwnerId = $this->businessOwnerIdForRestaurant($restaurant);
        if (!$businessOwnerId) {
            return;
        }

        $restaurants = Restaurant::query()
            ->with(['subscription', 'plan'])
            ->where(function ($query) use ($restaurant, $businessOwnerId) {
                $query->where('business_owner_user_id', $businessOwnerId)
                    ->orWhere('id', $restaurant->id);

                if ($restaurant->owner_email) {
                    $query->orWhere(function ($ownerQuery) use ($restaurant) {
                        $ownerQuery->where('owner_email', $restaurant->owner_email)
                            ->whereNull('business_owner_user_id')
                            ->where('saas_plan_id', $restaurant->saas_plan_id);
                    });
                }
            })
            ->get();

        $reference = $restaurants
            ->filter(fn (Restaurant $item) => $item->status === 'active')
            ->map(function (Restaurant $item) {
                $end = collect([
                    $item->subscription_ends_at,
                    $item->subscription?->ends_at,
                    $item->subscription?->next_billing_at,
                ])->filter()->map(fn ($value) => Carbon::parse($value))->max();

                return ['restaurant' => $item, 'end' => $end];
            })
            ->filter(fn (array $item) => $item['end'] instanceof Carbon && $item['end']->isFuture())
            ->sortByDesc(fn (array $item) => $item['end']->timestamp)
            ->first();

        if (!$reference) {
            return;
        }

        /** @var Restaurant $referenceRestaurant */
        $referenceRestaurant = $reference['restaurant'];
        /** @var Carbon $subscriptionEnd */
        $subscriptionEnd = $reference['end']->copy();
        $billingDate = $subscriptionEnd->copy()->startOfDay();
        $subscription = $referenceRestaurant->subscription;

        foreach ($restaurants as $item) {
            $updates = [
                'status' => 'active',
                'saas_plan_id' => $referenceRestaurant->saas_plan_id,
                'subscription_ends_at' => $subscriptionEnd,
            ];

            if (!$item->business_owner_user_id) {
                $updates['business_owner_user_id'] = $businessOwnerId;
            }

            $item->update($updates);
            RestaurantSubscription::updateOrCreate(
                ['restaurant_id' => $item->id],
                [
                    'saas_plan_id' => $subscription?->saas_plan_id ?? $referenceRestaurant->saas_plan_id,
                    'status' => 'active',
                    'starts_at' => $subscription?->starts_at ?? Carbon::today(),
                    'ends_at' => $billingDate,
                    'next_billing_at' => $subscription?->next_billing_at ?? $billingDate,
                    'amount' => $subscription?->amount ?? $referenceRestaurant->plan?->monthly_price ?? 0,
                    'currency' => $subscription?->currency ?? $referenceRestaurant->currency,
                ]
            );
        }
    }

    private function yearlyPrice(SaasPlan $plan): float
    {
        return (float) ($plan->yearly_price ?: ((float) $plan->monthly_price * 12));
    }

    private function planPriceForCycle(SaasPlan $plan, string $billingCycle): float
    {
        return $plan->priceForCycle($billingCycle);
    }

    private function annualMonthlyPrice(SaasPlan $plan): float
    {
        return $this->yearlyPrice($plan) / 12;
    }

    private function monthlyPrice(SaasPlan $plan): float
    {
        return (float) $plan->monthly_price;
    }

    private function refreshBillingStatus(Restaurant $restaurant): void
    {
        if (in_array($restaurant->status, ['suspended', 'cancelled', 'pending_payment'], true)) {
            return;
        }

        $restaurant->loadMissing(['plan', 'subscription']);
        $this->syncBusinessSubscriptionFromGroup($restaurant);
        $restaurant->refresh()->loadMissing(['plan', 'subscription']);

        if ($restaurant->status === 'trial' && $restaurant->trial_ends_at && $restaurant->trial_ends_at->isPast()) {
            $restaurant->update(['status' => 'past_due']);
            $restaurant->subscription?->update(['status' => 'past_due']);
            return;
        }

        if ($restaurant->status === 'active' && $restaurant->subscription_ends_at && $restaurant->subscription_ends_at->isPast()) {
            $restaurant->update(['status' => 'past_due']);
            $restaurant->subscription?->update(['status' => 'past_due']);
        }
    }

    private function canAccessWorkspace(Restaurant $restaurant): bool
    {
        return in_array($restaurant->status, ['active', 'trial'], true);
    }

    private function canCustomizeRestaurant(Restaurant $restaurant): bool
    {
        $restaurant->loadMissing('plan');
        $slug = Str::lower((string) $restaurant->plan?->slug);
        $name = Str::lower((string) $restaurant->plan?->name);

        return Str::contains($slug, ['pro', 'business', 'enterprise'])
            || Str::contains($name, ['pro', 'business', 'enterprise']);
    }

    private function normalizePaymentStatus(?string $status): string
    {
        return match (Str::upper((string) $status)) {
            'SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED' => 'paid',
            'PENDING', 'PROCESSING', 'INITIATED', 'CREATED', 'WAITING', 'WAITING_CUSTOMER_CONFIRMATION' => 'pending',
            default => 'failed',
        };
    }

    private function normalizeWalletId(string $walletId): string
    {
        $value = trim($walletId);
        $value = preg_replace('/[\s\-.()]/', '', $value) ?? '';

        if (str_starts_with($value, '00')) {
            $value = '+' . substr($value, 2);
        }

        if (str_starts_with($value, '+')) {
            return '+' . preg_replace('/\D/', '', substr($value, 1));
        }

        $digits = preg_replace('/\D/', '', $value) ?? '';

        if (str_starts_with($digits, '0')) {
            $digits = '243' . substr($digits, 1);
        }

        if (!str_starts_with($digits, '243')) {
            $digits = '243' . $digits;
        }

        return '+' . $digits;
    }

    private function normalizeCongoPhone(?string $phone): ?string
    {
        $value = trim((string) $phone);
        if ($value === '') {
            return null;
        }

        $value = preg_replace('/[\s\-.()]/', '', $value) ?? '';
        if (str_starts_with($value, '00')) {
            $value = '+' . substr($value, 2);
        }

        if (str_starts_with($value, '+')) {
            $digits = preg_replace('/\D/', '', substr($value, 1)) ?? '';
        } else {
            $digits = preg_replace('/\D/', '', $value) ?? '';
        }

        if (str_starts_with($digits, '0')) {
            $digits = '243' . substr($digits, 1);
        }

        if (!str_starts_with($digits, '243')) {
            $digits = '243' . $digits;
        }

        return '+' . $digits;
    }

    private function isValidWalletForProvider(string $walletId, string $provider): bool
    {
        return match ($provider) {
            'AIRTEL' => (bool) preg_match('/^\+2439\d{8}$/', $walletId),
            'ORANGE' => (bool) preg_match('/^\+243(84|85)\d{7}$/', $walletId),
            'MPESA' => (bool) preg_match('/^\+243(81|82|83)\d{7}$/', $walletId),
            'MTN' => (bool) preg_match('/^\+243\d{9}$/', $walletId),
            default => false,
        };
    }

    private function walletValidationMessage(string $provider): string
    {
        return match ($provider) {
            'AIRTEL' => 'Numero Airtel Money invalide. Utilisez le format +2439XXXXXXXX.',
            'ORANGE' => 'Numero Orange Money invalide. Utilisez le format +24384XXXXXXX ou +24385XXXXXXX.',
            'MPESA' => 'Numero M-Pesa invalide. Utilisez le format +24381XXXXXXX, +24382XXXXXXX ou +24383XXXXXXX.',
            default => 'Numero Mobile Money invalide. Utilisez le format international +243XXXXXXXXX.',
        };
    }

    private function gatewayFailureMessage(array $response): string
    {
        $candidates = [
            $response['message'] ?? null,
            $response['error'] ?? null,
            $response['errorMessage'] ?? null,
            $response['description'] ?? null,
            $response['reason'] ?? null,
            $response['data']['message'] ?? null,
            $response['data']['error'] ?? null,
            $response['data']['description'] ?? null,
            $response['data']['reason'] ?? null,
            $response['errors'][0] ?? null,
            $response['errors']['message'][0] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        return 'Le paiement Mobile Money n\'a pas pu être effectué. Veuillez réessayer.';
    }

    private function validatePlan(Request $request, ?SaasPlan $plan = null): array
    {
        return $request->validate([
            'name' => ($plan ? 'sometimes' : 'required') . '|string|max:120',
            'slug' => 'nullable|string|max:120|alpha_dash|unique:saas_plans,slug,' . ($plan?->id ?? 'NULL') . ',id',
            'description' => 'nullable|string|max:500',
            'monthly_price' => 'sometimes|numeric|min:0',
            'yearly_price' => 'sometimes|nullable|numeric|min:0',
            'promo_label' => 'sometimes|nullable|string|max:80',
            'promo_percent' => 'sometimes|nullable|integer|min:1|max:95',
            'promo_starts_at' => 'sometimes|nullable|date',
            'promo_ends_at' => 'sometimes|nullable|date|after_or_equal:promo_starts_at',
            'currency' => 'sometimes|string|in:USD,CDF',
            'max_restaurants' => 'sometimes|integer|min:1',
            'max_tables' => 'sometimes|nullable|integer|min:1',
            'max_users' => 'sometimes|nullable|integer|min:1',
            'max_dishes' => 'sometimes|nullable|integer|min:1',
            'max_orders_per_month' => 'sometimes|nullable|integer|min:1',
            'features' => 'nullable',
            'is_popular' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
        ]);
    }

    private function normalizeFeatures(mixed $features): array
    {
        if (is_string($features)) {
            $features = array_map('trim', preg_split('/\r\n|\r|\n|,/', $features));
        }

        if (!is_array($features)) {
            return [];
        }

        $unique = [];
        foreach ($features as $feature) {
            $label = trim((string) $feature);
            if ($label === '') {
                continue;
            }

            $unique[$this->normalizeFeatureLabel($label)] = $label;
        }

        return array_values($unique);
    }

    private function withPlanFeature(array $features, string $targetSlug, string $planSlug, string $feature): array
    {
        if ($planSlug !== $targetSlug) {
            return $features;
        }

        $normalized = $this->normalizeFeatureLabel($feature);
        foreach ($features as $existingFeature) {
            if ($this->normalizeFeatureLabel((string) $existingFeature) === $normalized) {
                return $features;
            }
        }

        $features[] = $feature;

        return $features;
    }

    private function normalizeFeatureLabel(string $value): string
    {
        return Str::of($value)
            ->ascii()
            ->lower()
            ->replace(['_', '-'], ' ')
            ->squish()
            ->toString();
    }

    private function splitName(string $fullName): array
    {
        $parts = preg_split('/\s+/', trim($fullName), 2);

        return [$parts[0] ?: 'Owner', $parts[1] ?? 'Restaurant'];
    }

    private function verifiedGoogleProfile(string $credential): ?array
    {
        $clientId = config('services.google.client_id');
        if (!$clientId) {
            return null;
        }

        try {
            $response = Http::timeout(8)->get('https://oauth2.googleapis.com/tokeninfo', [
                'id_token' => $credential,
            ]);

            if (!$response->successful()) {
                return null;
            }

            $profile = $response->json();
            $issuer = $profile['iss'] ?? null;
            $isVerified = filter_var($profile['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);

            if (($profile['aud'] ?? null) !== $clientId
                || !in_array($issuer, ['accounts.google.com', 'https://accounts.google.com'], true)
                || !$isVerified
                || empty($profile['email'])) {
                return null;
            }

            return [
                'email' => strtolower($profile['email']),
                'name' => $profile['name'] ?? $profile['email'],
                'picture' => $profile['picture'] ?? null,
            ];
        } catch (\Throwable) {
            return null;
        }
    }

    private function sessionPayload(User $user): array
    {
        $expiresAt = now()->addMinutes((int) env('AUTH_TOKEN_TTL_MINUTES', 1440));

        return [
            'token' => $user->createToken('restaurant-dashboard', ['*'], $expiresAt)->plainTextToken,
            'token_expires_at' => $expiresAt->toIso8601String(),
            'user' => $user->load('roles.permissions', 'agent', 'restaurant.plan', 'restaurant.subscription'),
            'restaurant' => $this->restaurantPayload($user->restaurant),
        ];
    }

    private function businessOwnerId(User $user): string
    {
        $restaurant = $user->restaurant;
        if ($restaurant?->business_owner_user_id) {
            return $restaurant->business_owner_user_id;
        }

        $owner = $restaurant?->owner_email
            ? User::where('email', $restaurant->owner_email)->first()
            : null;

        return $owner?->id ?: $user->id;
    }

    private function ensureBusinessOwner(User $user, Restaurant $restaurant): void
    {
        if (!$restaurant->business_owner_user_id && strcasecmp((string) $restaurant->owner_email, (string) $user->email) === 0) {
            $restaurant->update(['business_owner_user_id' => $user->id]);
            $restaurant->refresh();
        }
    }

    private function canManageBusinessRestaurants(?User $user, Restaurant $restaurant): bool
    {
        if (!$user || !$restaurant->plan?->allows('multi_restaurant')) {
            return false;
        }

        if ($restaurant->business_owner_user_id) {
            return $restaurant->business_owner_user_id === $user->id
                || $this->userHasMultiTenantRole($user);
        }

        return strcasecmp((string) $restaurant->owner_email, (string) $user->email) === 0
            || $this->userHasMultiTenantRole($user);
    }

    private function userHasMultiTenantRole(User $user): bool
    {
        $user->loadMissing('roles');
        $businessOwnerId = $this->businessOwnerId($user);
        $restaurantIds = Restaurant::query()
            ->where('business_owner_user_id', $businessOwnerId)
            ->orWhere('id', $user->restaurant_id)
            ->pluck('id');

        $multiTenantRoles = ['multi-tenant', 'multi-restaurant', 'multi-restaurants'];

        return $user->roles
            ->filter(fn ($role) => !$role->restaurant_id || $restaurantIds->contains($role->restaurant_id))
            ->contains(function ($role) use ($multiTenantRoles) {
                $roleName = Str::of((string) $role->name)
                    ->lower()
                    ->replace(['_', ' '], '-')
                    ->toString();

                return in_array($roleName, $multiTenantRoles, true);
            });
    }

    private function businessRestaurantQuery(User $user)
    {
        $businessOwnerId = $this->businessOwnerId($user);
        $currentRestaurant = $user->restaurant;
        $currentRestaurantId = $user->restaurant_id;
        $ownerEmail = $currentRestaurant?->owner_email;
        $planId = $currentRestaurant?->saas_plan_id;

        return Restaurant::query()
            ->where('business_owner_user_id', $businessOwnerId)
            ->orWhere('id', $currentRestaurantId)
            ->orWhere(function ($query) use ($currentRestaurantId) {
                $query->where('id', $currentRestaurantId)
                    ->whereNull('business_owner_user_id');
            })
            ->orWhere(function ($query) use ($ownerEmail, $planId) {
                if (!$ownerEmail) {
                    $query->whereRaw('1 = 0');
                    return;
                }

                $query->where('owner_email', $ownerEmail)
                    ->when($planId, fn ($planQuery) => $planQuery->where('saas_plan_id', $planId));
            });
    }

    private function ordersRevenueByCurrency($orders): array
    {
        $totals = collect();

        foreach (collect($orders) as $order) {
            $order->loadMissing('items');
            $items = $order->items ?? collect();

            if ($items->isEmpty()) {
                $currency = $this->normalizeCurrency($order->currency);
                $current = $totals->get($currency, [
                    'currency' => $currency,
                    'amount' => 0,
                    'order_ids' => collect(),
                ]);
                $current['amount'] += (float) $order->total_amount;
                $current['order_ids']->push($order->id);
                $totals->put($currency, $current);
                continue;
            }

            foreach ($items as $item) {
                $currency = $this->normalizeCurrency($item->original_currency ?: $order->currency);
                $unitPrice = $item->original_price !== null
                    ? (float) $item->original_price
                    : (float) ($item->price_at_order ?: $item->converted_price ?: 0);
                $current = $totals->get($currency, [
                    'currency' => $currency,
                    'amount' => 0,
                    'order_ids' => collect(),
                ]);
                $current['amount'] += ((int) $item->quantity) * $unitPrice;
                $current['order_ids']->push($order->id);
                $totals->put($currency, $current);
            }
        }

        $totals = $totals
            ->map(fn ($item) => [
                'currency' => $item['currency'],
                'amount' => round((float) $item['amount'], 2),
                'count' => $item['order_ids']->unique()->count(),
            ])
            ->values();

        foreach (['CDF', 'USD'] as $currency) {
            if (!$totals->contains('currency', $currency)) {
                $totals->push(['currency' => $currency, 'amount' => 0, 'count' => 0]);
            }
        }

        return $totals->sortBy('currency')->values()->all();
    }

    private function businessMonthlyEvolution($restaurantIds): array
    {
        return collect(range(5, 0))->map(function (int $offset) use ($restaurantIds) {
            $date = Carbon::now()->subMonths($offset);
            $start = $date->copy()->startOfMonth();
            $end = $date->copy()->endOfMonth();
            $orders = Order::whereIn('restaurant_id', $restaurantIds)
                ->whereBetween('created_at', [$start, $end]);
            $paidOrders = (clone $orders)->where('payment_status', 'paid')->with('items')->get();

            return [
                'label' => $date->locale('fr')->isoFormat('MMM YYYY'),
                'orders_count' => (clone $orders)->count(),
                'revenue_by_currency' => $this->ordersRevenueByCurrency($paidOrders),
            ];
        })->values()->all();
    }

    private function businessTopDishes($restaurantIds, Carbon $start, Carbon $end): array
    {
        return DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->leftJoin('plats', 'plats.id', '=', 'order_items.plat_id')
            ->whereIn('orders.restaurant_id', $restaurantIds)
            ->whereBetween('orders.created_at', [$start, $end])
            ->selectRaw('COALESCE(plats.name, ?) as name', ['Plat inconnu'])
            ->selectRaw('COALESCE(order_items.original_currency, orders.currency, ?) as currency', ['USD'])
            ->selectRaw('SUM(order_items.quantity) as quantity')
            ->selectRaw('SUM(order_items.quantity * COALESCE(order_items.original_price, order_items.price_at_order, order_items.converted_price, 0)) as revenue')
            ->groupBy('name', 'currency')
            ->orderByDesc('quantity')
            ->limit(8)
            ->get()
            ->map(fn ($item) => [
                'name' => $item->name,
                'quantity' => (int) $item->quantity,
                'revenue' => round((float) $item->revenue, 2),
                'currency' => $this->normalizeCurrency($item->currency),
            ])
            ->all();
    }

    private function normalizeCurrency(?string $currency): string
    {
        $value = strtoupper(trim((string) ($currency ?: 'USD')));
        return in_array($value, ['CDF', 'USD'], true) ? $value : 'USD';
    }

    private function localDateRange(string $date): array
    {
        $timezone = config('app.display_timezone', 'Africa/Kinshasa');
        $start = Carbon::parse($date, $timezone)->startOfDay()->timezone(config('app.timezone', 'UTC'));
        $end = Carbon::parse($date, $timezone)->endOfDay()->timezone(config('app.timezone', 'UTC'));

        return [$start, $end];
    }

    private function restaurantPayload(?Restaurant $restaurant): ?array
    {
        if (!$restaurant) {
            return null;
        }

        $restaurant->loadMissing(['plan', 'subscription']);

        return [
            ...$restaurant->toArray(),
            'logo_url' => $restaurant->logo ? asset("storage/{$restaurant->logo}") : null,
            'logo_data_url' => $this->publicDiskDataUrl($restaurant->logo),
            'limits' => [
                'tables' => $restaurant->plan?->maxTables(),
                'users' => $restaurant->plan?->maxUsers(),
                'dishes' => $restaurant->plan?->maxDishes(),
                'orders_month' => $restaurant->plan?->maxOrdersPerMonth(),
                'restaurants' => $restaurant->plan?->max_restaurants ?? 1,
            ],
            'features' => $restaurant->plan?->featurePermissions() ?? [],
            'can_manage_business_restaurants' => $this->canManageBusinessRestaurants(auth()->user(), $restaurant),
            'payment_methods' => $restaurant->plan?->includedPaymentMethods() ?? ['cash'],
        ];
    }

    private function publicDiskDataUrl(?string $path): ?string
    {
        if (!$path || !Storage::disk('public')->exists($path)) {
            return null;
        }

        $contents = Storage::disk('public')->get($path);
        $mimeType = Storage::disk('public')->mimeType($path) ?: 'image/png';

        return 'data:' . $mimeType . ';base64,' . base64_encode($contents);
    }

    private function regenerateTableQrCodes(Restaurant $restaurant): void
    {
        $frontendUrl = rtrim(env('CLIENT_FRONTEND_URL', 'https://restaurascan.com'), '/');
        $restaurant->tables()->get()->each(function (Table $table) use ($restaurant, $frontendUrl) {
            $url = $frontendUrl . '/?' . http_build_query([
                'table_id' => $table->id,
                'restaurant_slug' => $restaurant->slug,
            ]);
            $qrImage = \SimpleSoftwareIO\QrCode\Facades\QrCode::format('svg')
                ->size(400)
                ->errorCorrection('H')
                ->margin(2)
                ->generate($url);

            if ($restaurant->logo && Storage::disk('public')->exists($restaurant->logo)) {
                $logoPath = Storage::disk('public')->path($restaurant->logo);
                $mime = mime_content_type($logoPath) ?: 'image/png';
                $logoData = base64_encode((string) file_get_contents($logoPath));
                $logo = sprintf(
                    '<rect x="154" y="154" width="92" height="92" rx="18" fill="#fff"/><image href="data:%s;base64,%s" x="164" y="164" width="72" height="72" preserveAspectRatio="xMidYMid meet"/>',
                    $mime,
                    $logoData
                );
                $qrImage = str_replace('</svg>', $logo . '</svg>', $qrImage);
            }

            $qrPath = "qrcodes/table_{$table->id}.svg";
            if (!Storage::disk('public')->exists('qrcodes')) {
                Storage::disk('public')->makeDirectory('qrcodes');
            }
            Storage::disk('public')->put($qrPath, $qrImage);
            $table->update(['qr_code' => $qrPath]);
        });
    }

    private function ensureDefaultPlans(): void
    {
        $plans = [
            [
                'name' => 'Starter',
                'slug' => 'starter',
                'description' => 'Pour lancer un service digital simple et professionnel.',
                'monthly_price' => 15,
                'yearly_price' => 144,
                'max_tables' => 6,
                'max_users' => 5,
                'max_dishes' => 15,
                'max_orders_per_month' => 150,
                'features' => ['15 plats', '150 commandes/mois', 'Gestion des commandes', 'Templates QR Standard', 'Promotions des plats', 'Cash uniquement', 'Sur place / Emporter', 'Support standard', 'Installation : 10$'],
            ],
            [
                'name' => 'Pro',
                'slug' => 'pro',
                'description' => 'Pour automatiser le service et piloter un restaurant en croissance.',
                'monthly_price' => 35,
                'yearly_price' => 360,
                'max_tables' => null,
                'max_users' => null,
                'max_dishes' => null,
                'max_orders_per_month' => null,
                'is_popular' => true,
                'features' => ['Commandes illimitées', 'Plats illimités', 'Promotions des plats', 'Réservations', 'Feedback client', 'Statistiques détaillées', 'Couleurs personnalisées', 'Support prioritaire', 'Installation : 15$'],
            ],
            [
                'name' => 'Business',
                'slug' => 'business',
                'description' => 'Pour les équipes structurées et les restaurants multi-sites.',
                'monthly_price' => 50,
                'yearly_price' => 480,
                'max_restaurants' => 5,
                'max_tables' => null,
                'max_users' => null,
                'max_dishes' => null,
                'max_orders_per_month' => null,
                'features' => ['Tout le plan Pro', 'Promotions des plats', 'Assistant intelligent dashboard', 'Statistiques avancées', 'Rôles et permissions', 'Support dédié', 'Onboarding personnalisé', 'Installation : 15$', 'Multi-restaurants'],
            ],
        ];

        SaasPlan::whereIn('slug', ['free', 'enterprise'])->update(['is_active' => false]);

        foreach ($plans as $plan) {
            $plan['features'] = $this->withPlanFeature($plan['features'], 'starter', $plan['slug'], 'Logo personnalisable');
            $plan['features'] = $this->withPlanFeature($plan['features'], 'pro', $plan['slug'], 'Commandes groupees');
            $plan['features'] = $this->withPlanFeature($plan['features'], 'business', $plan['slug'], 'Commandes groupees');

            $existing = SaasPlan::where('slug', $plan['slug'])->first();

            if ($existing) {
                continue;
            }

            SaasPlan::create([
                'currency' => 'USD',
                'is_active' => true,
                'is_popular' => $plan['is_popular'] ?? false,
                'max_restaurants' => $plan['max_restaurants'] ?? 1,
                ...$plan,
            ]);
        }
    }

    private function resolveSignupPlan(string $identifier): ?SaasPlan
    {
        $identifier = trim($identifier);

        if ($identifier === '') {
            return null;
        }

        return SaasPlan::where('is_active', true)
            ->where(function ($query) use ($identifier) {
                $query->where('id', $identifier)
                    ->orWhere('slug', Str::slug($identifier))
                    ->orWhere('name', $identifier);
            })
            ->first();
    }

    private function uniqueRestaurantSlug(string $name, ?string $ignoreId = null): string
    {
        $base = Str::slug($name) ?: Str::random(8);
        $slug = $base;
        $counter = 2;

        while (Restaurant::where('slug', $slug)
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->exists()) {
            $slug = "{$base}-{$counter}";
            $counter++;
        }

        return $slug;
    }
}
