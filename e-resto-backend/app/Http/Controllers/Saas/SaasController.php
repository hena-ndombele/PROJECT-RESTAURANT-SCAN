<?php

namespace App\Http\Controllers\Saas;

use App\Http\Controllers\Controller;
use App\Mail\RestaurantAccountCreatedMail;
use App\Mail\SendOtpMail;
use App\Models\ContactMessage;
use App\Models\Feedback;
use App\Models\NewsletterSubscriber;
use App\Models\Otp;
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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SaasController extends Controller
{
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
            'plans' => SaasPlan::where('is_active', true)->orderBy('monthly_price')->get(),
            'recent_restaurants' => Restaurant::with('plan')->latest()->take(6)->get(),
            'payment_methods' => $this->paymentMethods(),
        ]);
    }

    public function plans()
    {
        $this->ensureDefaultPlans();

        return response()->json(SaasPlan::where('is_active', true)->orderBy('monthly_price')->get());
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

        return response()->json(SaasPlan::create($validated), 201);
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
            'country' => 'nullable|string|max:2',
            'currency' => 'nullable|string|in:USD,CDF',
            'saas_plan_id' => 'required|string|max:80',
        ], [
            'restaurant_name.required' => 'Le nom du restaurant est obligatoire.',
            'owner_name.required' => 'Le nom du proprietaire est obligatoire.',
            'owner_email.required' => 'L adresse email est obligatoire.',
            'owner_email.email' => 'L adresse email est invalide.',
            'owner_email.unique' => 'Cette adresse email possede deja un compte.',
            'owner_phone.required' => 'Le numero de telephone est obligatoire.',
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

            $restaurant = Restaurant::create([
                'name' => $validated['restaurant_name'],
                'slug' => $this->uniqueRestaurantSlug($validated['restaurant_name']),
                'legal_name' => $validated['legal_name'] ?? null,
                'owner_name' => $validated['owner_name'],
                'owner_email' => $validated['owner_email'],
                'owner_phone' => $validated['owner_phone'],
                'address' => $validated['address'] ?? null,
                'city' => $validated['city'] ?? null,
                'country' => $validated['country'] ?? 'CD',
                'currency' => $validated['currency'] ?? 'CDF',
                'status' => ((float) $plan->monthly_price) <= 0 ? 'active' : 'trial',
                'saas_plan_id' => $plan->id,
                'trial_ends_at' => ((float) $plan->monthly_price) <= 0 ? null : now()->addDays(14),
                'settings' => $this->defaultRestaurantSettings(),
            ]);

            $user = User::create([
                'restaurant_id' => $restaurant->id,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $validated['owner_email'],
                'phone_number' => $validated['owner_phone'],
                'address' => $validated['address'] ?? null,
                'password' => Hash::make($validated['password'] ?? Str::random(48)),
                'is_first_login' => false,
            ]);

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

            app()->terminating(function () use ($user, $restaurant) {
                try {
                    Mail::to($user->email)->send(new RestaurantAccountCreatedMail(
                        $user,
                        $restaurant->fresh(['plan', 'subscription'])
                    ));
                } catch (\Throwable) {
                }
            });

            $otpCode = rand(10000, 99999);
            Otp::where('user_id', $user->id)->delete();
            Otp::create([
                'user_id' => $user->id,
                'code' => $otpCode,
                'expires_at' => now()->addMinutes(5),
            ]);

            try {
                Mail::to($user->email)->send(new SendOtpMail((string) $otpCode));
            } catch (\Throwable) {
            }

            return response()->json([
                'message' => 'Compte cree. Un code OTP a ete envoye a votre adresse email.',
                'restaurant' => $restaurant->load(['plan', 'subscription']),
                'owner' => $user,
                'requires_otp' => true,
            ], 201);
        });
    }

    public function checkout(Request $request)
    {
        $validated = $request->validate([
            'restaurant_id' => 'required|uuid|exists:restaurants,id',
            'provider' => 'required|string|in:MPESA,AIRTEL,ORANGE,MTN,mpesa,airtel,orange,mtn',
            'wallet_id' => 'required|string|min:10|max:30',
            'billing_cycle' => 'sometimes|string|in:monthly,yearly',
        ]);

        $provider = Str::upper($validated['provider']);
        $walletId = $this->normalizeWalletId($validated['wallet_id']);

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

            $plan = $restaurant->plan ?: SaasPlan::where('slug', 'starter')->firstOrFail();
            $billingCycle = $validated['billing_cycle'] ?? 'monthly';
            $amount = $billingCycle === 'yearly'
                ? (float) $plan->monthly_price * 10
                : (float) $plan->monthly_price;

            $payment = Payment::create([
                'restaurant_id' => $restaurant->id,
                'type' => 'subscription',
                'method' => 'mobile_money',
                'provider' => $provider,
                'status' => 'pending',
                'amount' => $amount,
                'currency' => $plan->currency,
                'reference' => 'SUB-' . Str::upper(Str::random(10)),
                'metadata' => [
                    'plan_id' => $plan->id,
                    'wallet_id' => $walletId,
                    'wallet_id_original' => $validated['wallet_id'],
                    'billing_cycle' => $billingCycle,
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
                'pending' => 'Demande de paiement envoyee. Confirmez sur votre telephone pour activer votre abonnement.',
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
                default => 'Paiement non confirme. Verifiez le numero puis reessayez.',
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
        return response()->json($this->restaurantPayload($request->user()->restaurant));
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

        return response()->json([
            'restaurant' => $this->restaurantPayload($restaurant),
            'metrics' => [
                'orders_today' => $restaurant->orders()->whereDate('created_at', Carbon::today())->count(),
                'revenue_today' => (float) $restaurant->orders()->whereDate('created_at', Carbon::today())->where('payment_status', 'paid')->sum('total_amount'),
                'tables' => $restaurant->tables()->count(),
                'active_tables' => $restaurant->tables()->where('status', '!=', 'Libre')->count(),
                'team' => $restaurant->users()->count(),
            ],
            'recent_orders' => $restaurant->orders()->with(['table', 'items.plat'])->latest()->take(8)->get(),
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
            'dishes' => $restaurant->plan?->maxDishes(),
            'orders_month' => $restaurant->plan?->maxOrdersPerMonth(),
        ];

        $monthStart = Carbon::now()->startOfMonth();
        $monthEnd = Carbon::now()->endOfMonth();
        $usage = [
            'tables' => $restaurant->tables()->count(),
            'users' => $restaurant->users()->count(),
            'dishes' => $restaurant->plats()->count(),
            'orders_month' => $restaurant->orders()->whereBetween('created_at', [$monthStart, $monthEnd])->count(),
        ];

        $canCreateTable = $limits['tables'] === null || ($limits['tables'] > 0 && $usage['tables'] < $limits['tables']);
        $canCreateUser = $limits['users'] === null || ($limits['users'] > 0 && $usage['users'] < $limits['users']);
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
                'can_use_Réservations' => (bool) ($features['Réservations'] ?? false),
                'can_use_chatbot' => (bool) ($features['chatbot'] ?? false),
                'can_manage_roles' => (bool) ($features['roles'] ?? false),
                'can_use_multi_restaurant' => (bool) ($features['multi_restaurant'] ?? false),
            ],
            'features' => $features,
            'payment_methods' => $restaurant->plan?->includedPaymentMethods() ?? ['cash'],
            'messages' => [
                'tables' => $limits['tables'] === null
                    ? 'Tables illimitees'
                    : ($canCreateTable ? "{$usage['tables']} / {$limits['tables']} tables utilisees" : "Limite de {$limits['tables']} tables atteinte pour le plan {$restaurant->plan?->name}."),
                'users' => $limits['users'] === null
                    ? 'Utilisateurs illimites'
                    : ($canCreateUser ? "{$usage['users']} / {$limits['users']} utilisateurs utilises" : "Limite de {$limits['users']} utilisateurs atteinte pour le plan {$restaurant->plan?->name}."),
                'dishes' => $limits['dishes'] === null
                    ? 'Plats illimites'
                    : ($canCreateDish ? "{$usage['dishes']} / {$limits['dishes']} plats utilises" : "Limite de {$limits['dishes']} plats atteinte pour le plan {$restaurant->plan?->name}."),
                'orders_month' => $limits['orders_month'] === null
                    ? 'Commandes illimitees'
                    : ($canAcceptOrder ? "{$usage['orders_month']} / {$limits['orders_month']} commandes ce mois" : "Limite de {$limits['orders_month']} commandes mensuelles atteinte pour le plan {$restaurant->plan?->name}."),
            ],
        ]);
    }

    public function updateProfile(Request $request)
    {
        $restaurant = $request->user()->restaurant()->with('plan')->firstOrFail();

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'owner_name' => 'sometimes|nullable|string|max:255',
            'owner_phone' => 'sometimes|nullable|string|max:30',
            'address' => 'sometimes|nullable|string|max:255',
            'city' => 'sometimes|nullable|string|max:120',
            'currency' => 'sometimes|string|in:USD,CDF',
            'slug' => 'sometimes|string|max:80|alpha_dash|unique:restaurants,slug,' . $restaurant->id,
            'logo_data' => 'sometimes|nullable|string',
            'settings' => 'sometimes|array',
        ]);

        $protectedSettingKeys = ['app_name', 'slogan', 'description', 'google_maps_url', 'theme'];
        $settingsPayload = $request->input('settings', []);
        $hasProtectedSettings = is_array($settingsPayload)
            && count(array_intersect(array_keys($settingsPayload), $protectedSettingKeys)) > 0;
        $hasCustomization = $request->hasAny(['logo_data', 'slug']) || $hasProtectedSettings;
        if ($hasCustomization && !$restaurant->plan?->allows('customization')) {
            return response()->json([
                'message' => 'La personnalisation du menu client est reservee aux plans Pro et Business.',
            ], 403);
        }

        $logoChanged = !empty($validated['logo_data']);
        if ($logoChanged) {
            $validated['logo'] = $this->storeRestaurantLogo($validated['logo_data'], $restaurant->id);
            unset($validated['logo_data']);
        }

        if (isset($validated['settings'])) {
            $validated['settings'] = array_replace_recursive($restaurant->settings ?? [], $validated['settings']);
        }

        $restaurant->update($validated);
        if ($logoChanged) {
            $this->regenerateTableQrCodes($restaurant->fresh());
        }

        return response()->json($this->restaurantPayload($restaurant->fresh(['plan', 'subscription'])));
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
        return response()->json([
            'contact_messages' => ContactMessage::latest()->take(50)->get(),
            'feedbacks' => Feedback::with(['restaurant', 'order.table'])->latest()->take(50)->get(),
            'Réservations' => Reservation::with(['restaurant', 'table'])->latest()->take(50)->get(),
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
                    'phone_number' => $validated['owner_phone'] ?? null,
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
            'country' => 'nullable|string|max:2',
            'currency' => 'nullable|string|in:USD,CDF',
            'saas_plan_id' => 'nullable|uuid|exists:saas_plans,id',
            'status' => 'nullable|string|in:pending_payment,trial,active,past_due,suspended,cancelled',
        ]);

        if (isset($validated['name']) && $validated['name'] !== $restaurant->name) {
            $validated['slug'] = $this->uniqueRestaurantSlug($validated['name'], $restaurant->id);
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
            'message' => 'Mot de passe proprietaire reinitialise.',
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
            'theme' => [
                'primary' => '#ff7a1a',
                'secondary' => '#d71920',
                'background' => '#fff7ef',
                'dark' => '#111111',
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
        $plan = $restaurant->plan;
        $paymentMetadata = $payment->metadata ?? [];
        $billingCycle = $paymentMetadata['billing_cycle'] ?? 'monthly';
        $subscriptionEnd = $billingCycle === 'yearly' ? now()->addYear() : now()->addMonth();
        $billingDate = $billingCycle === 'yearly' ? Carbon::today()->addYear() : Carbon::today()->addMonth();

        $restaurant->update([
            'status' => 'active',
            'subscription_ends_at' => $subscriptionEnd,
        ]);

        $restaurant->subscription()->updateOrCreate(
            ['restaurant_id' => $restaurant->id],
            [
                'saas_plan_id' => $plan?->id,
                'status' => 'active',
                'starts_at' => Carbon::today(),
                'ends_at' => $billingDate,
                'next_billing_at' => $billingDate,
                'amount' => $payment->amount,
                'currency' => $payment->currency,
            ]
        );
    }

    private function refreshBillingStatus(Restaurant $restaurant): void
    {
        if (in_array($restaurant->status, ['suspended', 'cancelled', 'pending_payment'], true)) {
            return;
        }

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
        return $response['message']
            ?? $response['error']
            ?? $response['errors'][0]
            ?? 'Le paiement Mobile Money a ete refuse ou non confirme par le gateway.';
    }

    private function validatePlan(Request $request, ?SaasPlan $plan = null): array
    {
        return $request->validate([
            'name' => ($plan ? 'sometimes' : 'required') . '|string|max:120',
            'slug' => 'nullable|string|max:120|alpha_dash|unique:saas_plans,slug,' . ($plan?->id ?? 'NULL') . ',id',
            'description' => 'nullable|string|max:500',
            'monthly_price' => 'sometimes|numeric|min:0',
            'currency' => 'sometimes|string|in:USD,CDF',
            'max_restaurants' => 'sometimes|integer|min:1',
            'max_tables' => 'sometimes|nullable|integer|min:1',
            'max_users' => 'sometimes|nullable|integer|min:1',
            'features' => 'nullable',
            'is_popular' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
        ]);
    }

    private function normalizeFeatures(mixed $features): array
    {
        if (is_string($features)) {
            return array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n|,/', $features))));
        }

        return is_array($features) ? array_values(array_filter($features)) : [];
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
            'user' => $user->load('restaurant.plan', 'restaurant.subscription'),
            'restaurant' => $this->restaurantPayload($user->restaurant),
        ];
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
            'limits' => [
                'tables' => $restaurant->plan?->maxTables(),
                'users' => $restaurant->plan?->maxUsers(),
                'dishes' => $restaurant->plan?->maxDishes(),
                'orders_month' => $restaurant->plan?->maxOrdersPerMonth(),
                'restaurants' => $restaurant->plan?->max_restaurants ?? 1,
            ],
            'features' => $restaurant->plan?->featurePermissions() ?? [],
            'payment_methods' => $restaurant->plan?->includedPaymentMethods() ?? ['cash'],
        ];
    }

    private function regenerateTableQrCodes(Restaurant $restaurant): void
    {
        $frontendUrl = rtrim(env('CLIENT_FRONTEND_URL', 'http://localhost:5173'), '/');
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
                'max_tables' => 8,
                'max_users' => 5,
                'features' => ['20 plats', '150 commandes/mois', 'Gestion des commandes', 'Cash uniquement', 'Sur place / Emporter', 'Support standard', 'Installation : 20 000 FC'],
            ],
            [
                'name' => 'Pro',
                'slug' => 'pro',
                'description' => 'Pour automatiser le service et piloter un restaurant en croissance.',
                'monthly_price' => 25,
                'max_tables' => null,
                'max_users' => null,
                'is_popular' => true,
                'features' => ['Commandes illimitees', 'Plats illimites', 'Réservations', 'Feedback client', 'Statistiques detaillées', 'Couleurs personnalisées', 'Support prioritaire', 'Installation : 20 000 FC'],
            ],
            [
                'name' => 'Business',
                'slug' => 'business',
                'description' => 'Pour les équipes structurées et les restaurants multi-sites.',
                'monthly_price' => 30,
                'max_restaurants' => 5,
                'max_tables' => 20,
                'max_users' => 15,
                'features' => ['Tout le plan Pro', 'Assistant intelligent dashboard', 'Statistiques avancées', 'Rôles et permissions', 'Support dedié', 'Onboarding personnalisé', 'Installation : 30 000 FC', 'Multi-restaurants'],
            ],
        ];

        SaasPlan::whereIn('slug', ['free', 'enterprise'])->update(['is_active' => false]);

        foreach ($plans as $plan) {
            SaasPlan::updateOrCreate(
                ['slug' => $plan['slug']],
                [
                    'currency' => 'USD',
                    'is_active' => true,
                    'is_popular' => $plan['is_popular'] ?? false,
                    'max_restaurants' => $plan['max_restaurants'] ?? 1,
                    ...$plan,
                ]
            );
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
