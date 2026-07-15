<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Restaurant;
use Illuminate\Http\Request;

class RestaurantController extends Controller
{
    public function index(Request $request)
    {
        $restaurants = $this->paidRestaurantsQuery()
            ->when($request->filled('city'), fn ($query) => $query->where('city', 'like', '%' . trim($request->city) . '%'))
            ->when($request->filled('search'), fn ($query) => $this->applySearch($query, trim($request->search)))
            ->orderBy('name')
            ->paginate($this->perPage($request));

        $restaurants->getCollection()->transform(fn (Restaurant $restaurant) => $this->restaurantPayload($restaurant, $request));

        return response()->json($restaurants);
    }

    public function search(Request $request)
    {
        $validated = $request->validate([
            'query' => 'required|string|min:2|max:120',
        ]);

        $restaurants = $this->paidRestaurantsQuery()
            ->where(fn ($query) => $this->applySearch($query, trim($validated['query'])))
            ->orderBy('name')
            ->paginate($this->perPage($request));

        $restaurants->getCollection()->transform(fn (Restaurant $restaurant) => $this->restaurantPayload($restaurant, $request));

        return response()->json($restaurants);
    }

    public function show(Request $request, Restaurant $restaurant)
    {
        if (!$this->isPaidRestaurant($restaurant)) {
            return response()->json([
                'message' => 'Restaurant introuvable ou abonnement non actif.',
            ], 404);
        }

        $restaurant->loadMissing($this->publicRelations());

        return response()->json($this->restaurantPayload($restaurant, $request));
    }

    public function favorite(Request $request, Restaurant $restaurant)
    {
        if (!$this->isPaidRestaurant($restaurant)) {
            return response()->json([
                'message' => 'Impossible de mettre ce restaurant en favoris.',
            ], 422);
        }

        $request->user()->favoriteRestaurants()->syncWithoutDetaching([$restaurant->id]);

        return response()->json([
            'message' => 'Restaurant ajouté aux favoris.',
            'restaurant' => $this->restaurantPayload($restaurant->loadMissing($this->publicRelations()), $request),
        ], 201);
    }

    public function unfavorite(Request $request, Restaurant $restaurant)
    {
        $request->user()->favoriteRestaurants()->detach($restaurant->id);

        return response()->json([
            'message' => 'Restaurant retire des favoris.',
        ]);
    }

    public function favorites(Request $request)
    {
        $restaurants = $request->user()
            ->favoriteRestaurants()
            ->where(fn ($query) => $this->paidRestaurantConstraints($query))
            ->with($this->publicRelations())
            ->orderBy('name')
            ->paginate($this->perPage($request));

        $restaurants->getCollection()->transform(fn (Restaurant $restaurant) => $this->restaurantPayload($restaurant, $request));

        return response()->json($restaurants);
    }

    private function paidRestaurantsQuery()
    {
        return Restaurant::query()
            ->where(fn ($query) => $this->paidRestaurantConstraints($query))
            ->with($this->publicRelations());
    }

    private function paidRestaurantConstraints($query): void
    {
        $query->where('status', 'active')
            ->whereHas('payments', function ($paymentQuery) {
                $paymentQuery->where('type', 'subscription')
                    ->where('status', 'paid');
            })
            ->where(function ($dateQuery) {
                $dateQuery->whereNull('subscription_ends_at')
                    ->orWhere('subscription_ends_at', '>=', now());
            });
    }

    private function isPaidRestaurant(Restaurant $restaurant): bool
    {
        return (clone $this->paidRestaurantsQuery())
            ->whereKey($restaurant->id)
            ->exists();
    }

    private function publicRelations(): array
    {
        return [
            'plan',
            'subscription',
            'plats' => fn ($query) => $query->with('category')->where('is_available', true)->orderBy('name'),
        ];
    }

    private function applySearch($query, string $search): void
    {                            
        $query->where(function ($searchQuery) use ($search) {
            $searchQuery->where('name', 'like', "%{$search}%")
                ->orWhere('legal_name', 'like', "%{$search}%")
                ->orWhere('address', 'like', "%{$search}%")
                ->orWhere('city', 'like', "%{$search}%");
        });
    }

    private function restaurantPayload(Restaurant $restaurant, Request $request): array
    {
        $settings = $restaurant->settings ?? [];
        $favoriteRestaurantIds = $this->favoriteRestaurantIds($request);

        return [
            'id' => $restaurant->id,
            'name' => $restaurant->name,
            'slug' => $restaurant->slug,
            'address' => $restaurant->address,
            'city' => $restaurant->city,
            'country' => $restaurant->country,
            'currency' => $restaurant->currency,
            'logo_url' => $restaurant->logo ? asset("storage/{$restaurant->logo}") : null,
            'settings' => $settings,
            'app_name' => $settings['app_name'] ?? $restaurant->name,
            'slogan' => $settings['slogan'] ?? null,
            'whatsapp_order_phone' => $settings['whatsapp_order_phone'] ?? $restaurant->owner_phone,
            'opening_time' => $settings['opening_time'] ?? '08:00',
            'closing_time' => $settings['closing_time'] ?? '22:00',
            'is_favorite' => in_array($restaurant->id, $favoriteRestaurantIds, true),
            'subscription' => [
                'status' => $restaurant->subscription?->status,
                'ends_at' => $restaurant->subscription_ends_at?->toIso8601String(),
            ],
            'plan' => $restaurant->plan ? [
                'id' => $restaurant->plan->id,
                'name' => $restaurant->plan->name,
                'slug' => $restaurant->plan->slug,
            ] : null,
            'menus' => $restaurant->plats->map(fn ($plat) => [
                'id' => $plat->id,
                'name' => $plat->name,
                'description' => $plat->description,
                'price' => (float) $plat->price,
                'currency' => $plat->currency,
                'preparation_time' => $plat->preparation_time,
                'ingredients' => $plat->ingredients ?? [],
                'image_url' => $plat->image ? asset("storage/{$plat->image}") : null,
                'image_secondaire_1_url' => $plat->image_secondaire_1 ? asset("storage/{$plat->image_secondaire_1}") : null,
                'image_secondaire_2_url' => $plat->image_secondaire_2 ? asset("storage/{$plat->image_secondaire_2}") : null,
                'category' => $plat->category ? [
                    'id' => $plat->category->id,
                    'name' => $plat->category->name,
                ] : null,
            ])->values(),
        ];
    }

    private function favoriteRestaurantIds(Request $request): array
    {
        if (!$request->user()) {
            return [];
        }

        return $request->user()
            ->favoriteRestaurants()
            ->pluck('restaurants.id')
            ->all();
    }

    private function perPage(Request $request): int
    {
        return min(max((int) $request->query('per_page', 10), 1), 50);
    }
}
