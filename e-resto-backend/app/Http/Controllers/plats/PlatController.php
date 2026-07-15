<?php

namespace App\Http\Controllers\plats;

use App\Events\MenuUpdated;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Plat;
use App\Models\Category;
use Illuminate\Support\Facades\Storage;

class PlatController extends Controller
{

    /**
     * @OldOA\\Get(
     * path="/api/plats/get_plats",
     * summary="Lister les plats",
     * tags={"Plats"},
     * @OldOA\\Response(
     * response=200,
     * description="Liste des plats"
     * )
     * )
     */
    public function index()
    {
        $plats = Plat::with('category')
            ->when(request()->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
            ->paginate(10);
        return response()->json($plats);
    }


    /**
     * @OldOA\\Post(
     * path="/api/plats/create-plats",
     * summary="Créer un plat",
     * tags={"Plats"},
     * @OldOA\\RequestBody(
     * required=true,
     * @OldOA\\MediaType(
     * mediaType="multipart/form-data",
     * @OldOA\\Schema(
     * required={"name","price","category_id"},
     * @OldOA\\Property(property="name", type="string", example="Pizza"),
     * @OldOA\\Property(property="description", type="string", example="Pizza fromage"),
     * @OldOA\\Property(property="price", type="number", example=12.5),
     * @OldOA\\Property(property="category_id", type="string", format="uuid", example="550e8400-e29b-41d4-a716-446655440000"),
     * @OldOA\\Property(
     * property="image",
     * type="string",
     * format="binary",
     * description="Image du plat"
     * )
     * )
     * )
     * ),
     * @OldOA\\Response(
     * response=201,
     * description="Plat créé avec succès"
     * )
     * )
     */
public function store(Request $request)
{
    $restaurant = $request->user()?->restaurant()->with('plan')->first();
    $dishLimit = $restaurant?->plan?->maxDishes();
    if ($restaurant && $dishLimit !== null && $restaurant->plats()->count() >= $dishLimit) {
        return response()->json([
            'message' => "Limite de {$dishLimit} plats atteinte pour le plan {$restaurant->plan?->name}.",
            'requires_upgrade' => true,
        ], 422);
    }

    $validatedData = $request->validate([
        'name' => 'required|string',
        'description' => 'required|string',
        'price' => 'required|numeric',
        'currency' => 'required|string|in:USD,CDF',
        'category_id' => 'required|exists:categories,id',
        'preparation_time' => 'nullable|integer', // Temps en minutes
        'is_available' => 'nullable|boolean',     // Disponibilité
        'ingredients' => 'nullable|array',         // Tableau d'ingrédients
        'sizes' => 'nullable|array|max:1',
        'sizes.*' => 'string|in:small,medium,large',
        'promotion_percent' => 'nullable|integer|min:1|max:95',
        'promotion_ends_at' => 'nullable|date|after_or_equal:today',
        'image_principale' => 'required|image|mimes:jpg,jpeg,png,webp|max:4096',
        'image_secondaire_1' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:4096',
        'image_secondaire_2' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:4096',
    ]);

    // Extraction des données textuelles et numériques
    $data = $request->only([
        'name', 
        'description', 
        'price', 
        'currency', 
        'category_id', 
        'preparation_time'
    ]);
    $data['restaurant_id'] = $request->user()?->restaurant_id;

    // Gestion de la disponibilité (Force le boolean si envoyé via FormData)
    $data['is_available'] = $request->boolean('is_available', true);

    // Stockage des ingrédients en JSON
    if ($request->has('ingredients')) {
        $data['ingredients'] = $request->input('ingredients');
    }
    if ($request->has('sizes')) {
        $data['sizes'] = array_values(array_unique($request->input('sizes', [])));
    }

    $promotionFieldsRequested = $request->filled('promotion_percent') || $request->filled('promotion_ends_at');
    if ($promotionFieldsRequested) {
        if (!$this->canUseDishPromotions($restaurant)) {
            return response()->json([
                'message' => "Les promotions des plats ne sont pas activees pour ce plan.",
                'requires_upgrade' => true,
            ], 403);
        }

        $data['promotion_percent'] = $request->filled('promotion_percent') ? (int) $request->input('promotion_percent') : null;
        $data['promotion_ends_at'] = $request->filled('promotion_ends_at') ? $request->input('promotion_ends_at') : null;
    }

    // Stockage des images
    if ($request->hasFile('image_principale')) {
        $data['image'] = $request->file('image_principale')->store('plats', 'public');
    }
    if ($request->hasFile('image_secondaire_1')) {
        $data['image_secondaire_1'] = $request->file('image_secondaire_1')->store('plats', 'public');
    }
    if ($request->hasFile('image_secondaire_2')) {
        $data['image_secondaire_2'] = $request->file('image_secondaire_2')->store('plats', 'public');
    }

    $plat = Plat::create($data);
    $this->broadcastMenuUpdated($plat->restaurant_id, 'dish_created');

    return response()->json([
        'message' => 'Plat créé avec succès', 
        'data' => $plat->load('category')
    ], 201);
}


    /**
     * @OldOA\\Get(
     * path="/api/plats/{id}",
     * summary="Afficher un plat",
     * tags={"Plats"},
     * @OldOA\\Parameter(
     * name="id",
     * in="path",
     * required=true,
     * description="UUID du plat",
     * @OldOA\\Schema(type="string", format="uuid")
     * ),
     * @OldOA\\Response(
     * response=200,
     * description="Plat trouvé"
     * )
     * )
     */
    public function show($id)
    {
        $plat = Plat::with('category')
            ->when(request()->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
            ->findOrFail($id);
        return response()->json($plat);
    }


    /**
     * @OldOA\\Post(
     * path="/api/plats/{id}",
     * summary="Mettre à jour un plat",
     * tags={"Plats"},
     * @OldOA\\Parameter(
     * name="id",
     * in="path",
     * required=true,
     * description="UUID du plat",
     * @OldOA\\Schema(type="string", format="uuid")
     * ),
     * @OldOA\\RequestBody(
     * @OldOA\\MediaType(
     * mediaType="multipart/form-data",
     * @OldOA\\Schema(
     * @OldOA\\Property(property="name", type="string", example="Burger"),
     * @OldOA\\Property(property="description", type="string", example="Burger viande"),
     * @OldOA\\Property(property="price", type="number", example=15),
     * @OldOA\\Property(property="category_id", type="string", format="uuid"),
     * @OldOA\\Property(
     * property="image",
     * type="string",
     * format="binary"
     * )
     * )
     * )
     * ),
     * @OldOA\\Response(
     * response=200,
     * description="Plat mis à jour"
     * )
     * )
     */
public function update(Request $request, $id)
{
    $plat = Plat::query()
        ->when($request->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
        ->findOrFail($id);

    $validatedData = $request->validate([
        'name' => 'sometimes|string|max:255',
        'description' => 'sometimes|string',
        'price' => 'sometimes|numeric|min:0',
        'currency' => 'sometimes|string|in:USD,CDF',
        'category_id' => 'sometimes|exists:categories,id',
        'preparation_time' => 'nullable|integer',
        'is_available' => 'nullable|boolean',
        'ingredients' => 'nullable|array',
        'sizes' => 'nullable|array|max:1',
        'sizes.*' => 'string|in:small,medium,large',
        'sizes_clear' => 'nullable|boolean',
        'promotion_percent' => 'nullable|integer|min:1|max:95',
        'promotion_ends_at' => 'nullable|date|after_or_equal:today',
        'promotion_clear' => 'nullable|boolean',
        'image_principale' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:4096',
        'image_secondaire_1' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:4096',
        'image_secondaire_2' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:4096',
    ]);

    // On récupère les données validées
    $data = $validatedData;

    // Gestion de la disponibilité si présente dans la requête
    if ($request->has('is_available')) {
        $data['is_available'] = $request->boolean('is_available');
    }
    if ($request->has('sizes')) {
        $data['sizes'] = array_values(array_unique($request->input('sizes', [])));
    } elseif ($request->boolean('sizes_clear')) {
        $data['sizes'] = [];
    }
    $restaurant = $request->user()?->restaurant()->with('plan')->first();
    $promotionFieldsRequested = $request->filled('promotion_percent') || $request->filled('promotion_ends_at') || $request->boolean('promotion_clear');
    unset($data['promotion_clear']);

    if ($promotionFieldsRequested) {
        if (!$this->canUseDishPromotions($restaurant)) {
            return response()->json([
                'message' => "Les promotions des plats ne sont pas activees pour ce plan.",
                'requires_upgrade' => true,
            ], 403);
        }

        if ($request->boolean('promotion_clear')) {
            $data['promotion_percent'] = null;
            $data['promotion_ends_at'] = null;
        } else {
            $data['promotion_percent'] = $request->filled('promotion_percent') ? (int) $request->input('promotion_percent') : null;
            $data['promotion_ends_at'] = $request->filled('promotion_ends_at') ? $request->input('promotion_ends_at') : null;
        }
    }

    // Mapping des inputs vers les colonnes de la DB
    $imageFields = [
        'image_principale' => 'image', 
        'image_secondaire_1' => 'image_secondaire_1', 
        'image_secondaire_2' => 'image_secondaire_2'
    ];

    foreach ($imageFields as $inputName => $dbColumn) {
        if ($request->hasFile($inputName)) {
            // 1. Supprimer l'ancienne image si elle existe
            if ($plat->$dbColumn && Storage::disk('public')->exists($plat->$dbColumn)) {
                Storage::disk('public')->delete($plat->$dbColumn);
            }
            // 2. Stocker la nouvelle image
            $data[$dbColumn] = $request->file($inputName)->store('plats', 'public');
        }
    }

    // Mise à jour globale
    $plat->update($data);
    $this->broadcastMenuUpdated($plat->restaurant_id, 'dish_updated');

    return response()->json([
        'message' => 'Menu mis à jour avec succès',
        'data' => $plat->load('category')
    ]);
}


    /**
     * @OldOA\\Delete(
     * path="/api/plats/{id}",
     * summary="Supprimer un plat",
     * tags={"Plats"},
     * @OldOA\\Parameter(
     * name="id",
     * in="path",
     * required=true,
     * description="UUID du plat",
     * @OldOA\\Schema(type="string", format="uuid")
     * ),
     * @OldOA\\Response(
     * response=200,
     * description="Plat supprimé"
     * )
     * )
     */
    public function destroy($id)
    {
        $plat = Plat::query()
            ->when(request()->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
            ->findOrFail($id);

        if ($plat->image && Storage::disk('public')->exists($plat->image)) {
            Storage::disk('public')->delete($plat->image);
        }

        $restaurantId = $plat->restaurant_id;
        $plat->delete();
        $this->broadcastMenuUpdated($restaurantId, 'dish_deleted');

        return response()->json([
            'message' => 'Plat supprimé avec succès'
        ]);
    }

    /**
     * @OldOA\\Get(
     * path="/api/search-plats",
     * summary="Rechercher des plats",
     * tags={"Plats"},
     * @OldOA\\Parameter(
     * name="query",
     * in="query",
     * required=true,
     * description="Mot clé de recherche",
     * @OldOA\\Schema(type="string", example="pizza")
     * ),
     * @OldOA\\Response(
     * response=200,
     * description="Résultat de recherche"
     * )
     * )
     */
    public function search(Request $request)
    {
        $query = $request->input('query');

        $plats = Plat::with('category')
            ->when($request->user()?->restaurant_id, fn ($builder, $restaurantId) => $builder->where('restaurant_id', $restaurantId))
            ->where(function ($builder) use ($query) {
                $builder->where('name', 'LIKE', "%{$query}%")
                    ->orWhere('description', 'LIKE', "%{$query}%");
            })
            ->paginate(10);

        return response()->json($plats);
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

    private function canUseDishPromotions($restaurant): bool
    {
        return (bool) $restaurant?->plan?->allows('dish_promotions');
    }
}
