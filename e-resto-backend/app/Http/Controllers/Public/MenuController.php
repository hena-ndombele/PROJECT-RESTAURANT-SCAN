<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Plat;
use App\Models\Restaurant;
use App\Models\Table;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MenuController extends Controller
{
    public function index(Request $request)
    {
        $restaurantId = null;
        if ($request->filled('table_id')) {
            $table = Table::find($request->table_id);
            if (!$table || !$table->restaurant_id) {
                return response()->json([
                    'message' => 'Cette table QR n est pas rattachee a un restaurant actif.',
                    'categories' => [],
                    'plats' => [],
                ], 404);
            }
            $restaurantId = $table->restaurant_id;
        }
        if ($request->filled('restaurant_id')) {
            $restaurantId = $request->restaurant_id;
        }
        if ($request->filled('restaurant_slug')) {
            $restaurantId = Restaurant::where('slug', $request->restaurant_slug)->value('id');
            if (!$restaurantId) {
                return response()->json([
                    'message' => 'Restaurant introuvable.',
                    'categories' => [],
                    'plats' => [],
                ], 404);
            }
        }

        if ($restaurantId) {
            $restaurant = Restaurant::find($restaurantId);
            if (!$restaurant || !in_array($restaurant->status, ['active', 'trial'], true)) {
                return response()->json([
                    'message' => 'Ce restaurant est temporairement indisponible.',
                    'categories' => [],
                    'plats' => [],
                ], 402);
            }
        }

        $categories = Category::query()
            ->when($restaurantId, fn ($query) => $query->where('restaurant_id', $restaurantId))
            ->withCount(['plats' => function ($query) use ($restaurantId) {
            $query->where('is_available', true);
            if ($restaurantId) {
                $query->where('restaurant_id', $restaurantId);
            }
        }])->orderBy('name')->get()->map(fn ($category) => [
            'id' => $category->id,
            'name' => $category->name,
            'description' => $category->description,
            'image' => $category->image,
            'image_url' => $category->image ? asset("storage/{$category->image}") : null,
            'plats_count' => $category->plats_count,
        ]);

        $platsQuery = Plat::with('category')
            ->when($restaurantId, fn ($query) => $query->where('restaurant_id', $restaurantId))
            ->where('is_available', true)
            ->orderBy('name');

        if ($request->filled('category_id') && $request->category_id !== 'all') {
            $platsQuery->where('category_id', $request->category_id);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $platsQuery->where(function ($query) use ($search) {
                $query->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $plats = $platsQuery->get()->map(fn ($plat) => [
            'id' => $plat->id,
            'name' => $plat->name,
            'description' => $plat->description,
            'price' => (float) $plat->price,
            'currency' => $plat->currency,
            'preparation_time' => $plat->preparation_time,
            'ingredients' => $plat->ingredients ?? [],
            'image' => $plat->image,
            'image_url' => $plat->image ? asset("storage/{$plat->image}") : null,
            'image_secondaire_1_url' => $plat->image_secondaire_1 ? asset("storage/{$plat->image_secondaire_1}") : null,
            'image_secondaire_2_url' => $plat->image_secondaire_2 ? asset("storage/{$plat->image_secondaire_2}") : null,
            'category' => $plat->category ? [
                'id' => $plat->category->id,
                'name' => $plat->category->name,
            ] : null,
        ]);

        return response()->json([
            'restaurant_id' => $restaurantId,
            'restaurant' => $restaurantId ? $this->publicRestaurantPayload(Restaurant::find($restaurantId)) : null,
            'categories' => $categories,
            'plats' => $plats,
        ]);
    }

    private function publicRestaurantPayload(?Restaurant $restaurant): ?array
    {
        if (!$restaurant) {
            return null;
        }

        $settings = $restaurant->settings ?? [];

        return [
            'id' => $restaurant->id,
            'name' => $restaurant->name,
            'slug' => $restaurant->slug,
            'owner_phone' => $restaurant->owner_phone,
            'address' => $restaurant->address,
            'city' => $restaurant->city,
            'currency' => $restaurant->currency,
            'logo_url' => $restaurant->logo ? asset("storage/{$restaurant->logo}") : null,
            'settings' => $settings,
            'app_name' => $settings['app_name'] ?? $restaurant->name,
            'slogan' => $settings['slogan'] ?? null,
            'theme' => $settings['theme'] ?? [],
            'can_feedback' => $this->feedbackAllowed($restaurant),
        ];
    }

    private function feedbackAllowed(Restaurant $restaurant): bool
    {
        $restaurant->loadMissing('plan');
        $slug = Str::lower((string) $restaurant->plan?->slug);
        $name = Str::lower((string) $restaurant->plan?->name);

        return Str::contains($slug, ['pro', 'business', 'enterprise'])
            || Str::contains($name, ['pro', 'business', 'enterprise']);
    }
}
