<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Plat;
use Illuminate\Http\Request;

class MenuController extends Controller
{
    public function index(Request $request)
    {
        $categories = Category::withCount(['plats' => function ($query) {
            $query->where('is_available', true);
        }])->orderBy('name')->get()->map(fn ($category) => [
            'id' => $category->id,
            'name' => $category->name,
            'description' => $category->description,
            'image' => $category->image,
            'image_url' => $category->image ? asset("storage/{$category->image}") : null,
            'plats_count' => $category->plats_count,
        ]);

        $platsQuery = Plat::with('category')
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
            'categories' => $categories,
            'plats' => $plats,
        ]);
    }
}
