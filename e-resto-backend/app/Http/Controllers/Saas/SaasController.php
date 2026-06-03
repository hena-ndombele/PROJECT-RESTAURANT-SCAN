<?php

namespace App\Http\Controllers\Saas;

use App\Http\Controllers\Controller;
use App\Mail\RestaurantAccountCreatedMail;
use App\Models\AccountRequest;
use App\Models\ContactMessage;
use App\Models\Feedback;
use App\Models\NewsletterSubscriber;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Restaurant;
use App\Models\RestaurantSubscription;
use App\Models\SaasPlan;
use App\Models\User;
use App\Services\MaishaPayService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
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

        $subscriber = NewsletterSubscriber::updateOrCreate(
            ['email' => strtolower($validated['email'])],
            [
                'source' => $validated['source'] ?? 'saas_landing',
                'status' => 'subscribed',
                'subscribed_at' => now(),
                'ip_address' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 1000),
            ]
        );

        return response()->json([
            'message' => 'Inscription newsletter confirmee.',
            'subscriber' => $subscriber,
        ], $subscriber->wasRecentlyCreated ? 201 : 200);
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
            'password' => 'required|string|min:6|confirmed',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:120',
            'country' => 'nullable|string|max:2',
            'currency' => 'nullable|string|in:USD,CDF',
            'saas_plan_id' => 'required|uuid|exists:saas_plans,id',
        ]);

        return DB::transaction(function () use ($validated) {
            $plan = SaasPlan::findOrFail($validated['saas_plan_id']);
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
                'password' => Hash::make($validated['password']),
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

            try {
                Mail::to($user->email)->send(new RestaurantAccountCreatedMail(
                    $user,
                    $restaurant->fresh(['plan', 'subscription'])
                ));
            } catch (\Throwable $mailError) {
                Log::warning('Email de bienvenue non envoye pendant le signup SaaS.', [
                    'restaurant_id' => $restaurant->id,
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'error' => $mailError->getMessage(),
                ]);
            }

            return response()->json([
                'restaurant' => $restaurant->load(['plan', 'subscription']),
                'owner' => $user,
                'session' => $this->sessionPayload($user),
            ], 201);
        });
    }

    public function checkout(Request $request)
    {
        $validated = $request->validate([
            'restaurant_id' => 'required|uuid|exists:restaurants,id',
            'provider' => 'required|string|in:MPESA,AIRTEL,ORANGE,MTN,mpesa,airtel,orange,mtn',
            'wallet_id' => 'required|string|max:30',
        ]);

        return DB::transaction(function () use ($validated) {
            $restaurant = Restaurant::with(['plan', 'subscription', 'users'])->findOrFail($validated['restaurant_id']);
            $this->refreshBillingStatus($restaurant);
            $restaurant->refresh();

            $plan = $restaurant->plan ?: SaasPlan::where('slug', 'starter')->firstOrFail();

            $payment = Payment::create([
                'restaurant_id' => $restaurant->id,
                'type' => 'subscription',
                'method' => 'mobile_money',
                'provider' => Str::upper($validated['provider']),
                'status' => 'pending',
                'amount' => $plan->monthly_price,
                'currency' => $plan->currency,
                'reference' => 'SUB-' . Str::upper(Str::random(10)),
                'metadata' => [
                    'plan_id' => $plan->id,
                    'wallet_id' => $validated['wallet_id'],
                ],
            ]);

            $response = $this->maishaPay->collectMobileMoney(
                $payment,
                ['name' => $restaurant->owner_name, 'email' => $restaurant->owner_email],
                $validated['provider'],
                $validated['wallet_id'],
                config('services.maishapay.callback_url') ?: url('/api/saas/payment-callback')
            );

            $status = $this->normalizePaymentStatus($response['transactionStatus'] ?? null);
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

            return response()->json([
                'payment' => $payment->fresh(),
                'maishapay' => $response,
                'restaurant' => $restaurant->fresh(['plan', 'subscription']),
                'session' => $owner && $status === 'paid' ? $this->sessionPayload($owner) : null,
            ]);
        });
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
            'tables' => (int) ($restaurant->plan?->max_tables ?? 0),
            'users' => (int) ($restaurant->plan?->max_users ?? 0),
        ];

        $usage = [
            'tables' => $restaurant->tables()->count(),
            'users' => $restaurant->users()->count(),
        ];

        $canCreateTable = $limits['tables'] > 0 && $usage['tables'] < $limits['tables'];
        $canCreateUser = $limits['users'] > 0 && $usage['users'] < $limits['users'];

        return response()->json([
            'plan' => $restaurant->plan,
            'restaurant_status' => $restaurant->status,
            'limits' => $limits,
            'usage' => $usage,
            'permissions' => [
                'can_create_table' => $canCreateTable,
                'can_create_user' => $canCreateUser,
            ],
            'messages' => [
                'tables' => $canCreateTable
                    ? "{$usage['tables']} / {$limits['tables']} tables utilisees"
                    : "Limite de {$limits['tables']} tables atteinte pour le plan {$restaurant->plan?->name}.",
                'users' => $canCreateUser
                    ? "{$usage['users']} / {$limits['users']} utilisateurs utilises"
                    : "Limite de {$limits['users']} utilisateurs atteinte pour le plan {$restaurant->plan?->name}.",
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

        $hasCustomization = $request->hasAny(['settings', 'logo_data', 'slug']);
        if ($hasCustomization && !$this->canCustomizeRestaurant($restaurant)) {
            return response()->json([
                'message' => 'La personnalisation du menu client est reservee aux plans Pro et Business.',
            ], 403);
        }

        if (!empty($validated['logo_data'])) {
            $validated['logo'] = $this->storeRestaurantLogo($validated['logo_data'], $restaurant->id);
            unset($validated['logo_data']);
        }

        if (isset($validated['settings'])) {
            $validated['settings'] = array_replace_recursive($restaurant->settings ?? [], $validated['settings']);
        }

        $restaurant->update($validated);

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
            'account_requests' => AccountRequest::latest()->take(50)->get(),
            'feedbacks' => Feedback::with(['restaurant', 'order.table'])->latest()->take(50)->get(),
            'reservations' => Reservation::with(['restaurant', 'table'])->latest()->take(50)->get(),
        ]);
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
                $restaurant->subscription()->updateOrCreate(
                    ['restaurant_id' => $restaurant->id],
                    [
                        'saas_plan_id' => $plan->id,
                        'status' => match ($restaurant->fresh()->status) {
                            'active' => 'active',
                            'past_due' => 'past_due',
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
            'theme' => [
                'primary' => '#ff7a1a',
                'secondary' => '#d71920',
                'background' => '#fff7ef',
                'dark' => '#111111',
            ],
            'payment_methods' => ['cash', 'mpesa', 'orange_money', 'airtel_money'],
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

        $restaurant->update([
            'status' => 'active',
            'subscription_ends_at' => now()->addMonth(),
        ]);

        $restaurant->subscription()->updateOrCreate(
            ['restaurant_id' => $restaurant->id],
            [
                'saas_plan_id' => $plan?->id,
                'status' => 'active',
                'starts_at' => Carbon::today(),
                'ends_at' => Carbon::today()->addMonth(),
                'next_billing_at' => Carbon::today()->addMonth(),
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
            'PENDING', 'PROCESSING' => 'pending',
            default => 'failed',
        };
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
            'max_tables' => 'sometimes|integer|min:1',
            'max_users' => 'sometimes|integer|min:1',
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

    private function sessionPayload(User $user): array
    {
        return [
            'token' => $user->createToken('restaurant-dashboard')->plainTextToken,
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
                'tables' => $restaurant->plan?->max_tables ?? 0,
                'users' => $restaurant->plan?->max_users ?? 0,
                'restaurants' => $restaurant->plan?->max_restaurants ?? 1,
            ],
        ];
    }

    private function ensureDefaultPlans(): void
    {
        $plans = [
            [
                'name' => 'Free Demo',
                'slug' => 'free',
                'description' => 'Pour tester le menu QR avec des limites strictes.',
                'monthly_price' => 0,
                'max_tables' => 3,
                'max_users' => 1,
                'features' => ['Menu QR', '3 tables', '10 plats', 'Support communautaire'],
            ],
            [
                'name' => 'Starter',
                'slug' => 'starter',
                'description' => 'Pour lancer un restaurant avec menu QR, commandes et cash.',
                'monthly_price' => 19,
                'max_tables' => 20,
                'max_users' => 3,
                'features' => ['Menu QR', 'Commandes cash', 'Dashboard restaurant', 'Support standard'],
            ],
            [
                'name' => 'Pro',
                'slug' => 'pro',
                'description' => 'Pour les restaurants qui veulent automatiser les operations.',
                'monthly_price' => 49,
                'max_tables' => 80,
                'max_users' => 12,
                'is_popular' => true,
                'features' => ['Tout Starter', 'Reservations', 'Temps reel cuisine', 'Rapports avances', 'Mobile money pret'],
            ],
            [
                'name' => 'Enterprise',
                'slug' => 'enterprise',
                'description' => 'Pour groupes, franchises et besoins multi-sites.',
                'monthly_price' => 129,
                'max_restaurants' => 10,
                'max_tables' => 500,
                'max_users' => 60,
                'features' => ['Tout Pro', 'Multi-restaurants', 'SLA prioritaire', 'Roles avances', 'Accompagnement onboarding'],
            ],
        ];

        foreach ($plans as $plan) {
            SaasPlan::firstOrCreate(
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
