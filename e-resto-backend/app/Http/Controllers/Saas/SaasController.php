<?php

namespace App\Http\Controllers\Saas;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Restaurant;
use App\Models\RestaurantSubscription;
use App\Models\SaasPlan;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SaasController extends Controller
{
    public function overview()
    {
        $this->ensureDefaultPlans();

        $restaurants = Restaurant::with('plan')->latest()->take(6)->get();

        return response()->json([
            'metrics' => [
                'restaurants' => Restaurant::count(),
                'active_restaurants' => Restaurant::whereIn('status', ['active', 'trial'])->count(),
                'trial_restaurants' => Restaurant::where('status', 'trial')->count(),
                'monthly_revenue' => (float) Payment::where('type', 'subscription')
                    ->where('status', 'paid')
                    ->whereMonth('paid_at', now()->month)
                    ->sum('amount'),
            ],
            'plans' => SaasPlan::where('is_active', true)->orderBy('monthly_price')->get(),
            'recent_restaurants' => $restaurants,
            'payment_methods' => $this->paymentMethods(),
        ]);
    }

    public function plans()
    {
        $this->ensureDefaultPlans();

        return response()->json(SaasPlan::where('is_active', true)->orderBy('monthly_price')->get());
    }

    public function restaurants(Request $request)
    {
        $query = Restaurant::with(['plan', 'subscription'])->latest();

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
            'status' => 'nullable|string|in:trial,active,suspended,cancelled',
        ]);

        $plan = isset($validated['saas_plan_id'])
            ? SaasPlan::find($validated['saas_plan_id'])
            : SaasPlan::where('slug', 'starter')->first();

        $restaurant = Restaurant::create([
            ...$validated,
            'slug' => $this->uniqueRestaurantSlug($validated['name']),
            'country' => $validated['country'] ?? 'CD',
            'currency' => $validated['currency'] ?? 'CDF',
            'status' => $validated['status'] ?? 'trial',
            'saas_plan_id' => $plan?->id,
            'trial_ends_at' => now()->addDays(14),
            'settings' => [
                'theme' => [
                    'primary' => '#ff7a1a',
                    'secondary' => '#d71920',
                    'dark' => '#111111',
                ],
                'payment_methods' => ['cash', 'orange_money', 'mpesa', 'airtel_money'],
            ],
        ]);

        if ($plan) {
            RestaurantSubscription::create([
                'restaurant_id' => $restaurant->id,
                'saas_plan_id' => $plan->id,
                'status' => 'trialing',
                'starts_at' => Carbon::today(),
                'next_billing_at' => Carbon::today()->addDays(14),
                'amount' => $plan->monthly_price,
                'currency' => $plan->currency,
            ]);
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
            'status' => 'nullable|string|in:trial,active,suspended,cancelled',
        ]);

        if (isset($validated['name']) && $validated['name'] !== $restaurant->name) {
            $validated['slug'] = $this->uniqueRestaurantSlug($validated['name'], $restaurant->id);
        }

        $restaurant->update($validated);

        return response()->json($restaurant->fresh(['plan', 'subscription']));
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

        $restaurant = $this->storeRestaurant(new Request([
            ...$validated,
            'status' => 'trial',
        ]));

        return $restaurant;
    }

    private function paymentMethods(): array
    {
        return [
            ['key' => 'cash', 'name' => 'Cash', 'status' => 'active', 'description' => 'Paiement manuel a la caisse ou a table.'],
            ['key' => 'orange_money', 'name' => 'Orange Money', 'status' => 'active', 'description' => 'Interface mobile money visible cote client.'],
            ['key' => 'mpesa', 'name' => 'M-Pesa', 'status' => 'active', 'description' => 'Interface mobile money visible cote client.'],
            ['key' => 'airtel_money', 'name' => 'Airtel Money', 'status' => 'active', 'description' => 'Interface mobile money visible cote client.'],
        ];
    }

    private function ensureDefaultPlans(): void
    {
        $plans = [
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
            SaasPlan::updateOrCreate(
                ['slug' => $plan['slug']],
                [
                    'currency' => 'USD',
                    'is_active' => true,
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
