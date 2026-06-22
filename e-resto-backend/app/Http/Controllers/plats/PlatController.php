<?php

namespace App\Http\Controllers\plats;

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

    return response()->json([
        'message' => 'Plat mis à jour avec succès',
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

        $plat->delete();

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
}
