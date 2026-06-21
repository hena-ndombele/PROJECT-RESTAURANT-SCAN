<?php

namespace App\Http\Controllers\category;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\Request;

class CategoryController extends Controller
{

    /**
     * @OldOA\\Get(
     * path="/api/category/list",
     * summary="Lister toutes les catégories",
     * tags={"Categories"},
     * @OldOA\\Response(
     * response=200,
     * description="Liste des catégories"
     * )
     * )
     */
    public function index()
    {
        $categories = Category::query()
            ->when(request()->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
            ->get();
        return response()->json($categories);
    }

    /**
     * @OldOA\\Post(
     * path="/api/category/create",
     * summary="Créer une catégorie",
     * tags={"Categories"},
     * @OldOA\\RequestBody(
     * required=true,
     * @OldOA\\JsonContent(
     * required={"name"},
     * @OldOA\\Property(property="name", type="string", example="Moteur"),
     * @OldOA\\Property(property="description", type="string", example="Pièces du moteur")
     * )
     * ),
     * @OldOA\\Response(
     * response=201,
     * description="Catégorie créée avec succès"
     * )
     * )
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string',
            'description' => 'nullable|string',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        $imagePath = null;

        if ($request->hasFile('image')) {
            if (!Storage::disk('public')->exists('categories')) {
                Storage::disk('public')->makeDirectory('categories');
            }

            $file = $request->file('image');
            $filename = time() . '_' . $file->getClientOriginalName();
            $imagePath = $file->storeAs('categories', $filename, 'public');
        }

        $category = Category::create([
            'restaurant_id' => $request->user()?->restaurant_id,
            'name' => $request->name,
            'description' => $request->description,
            'image' => $imagePath,
        ]);

        return response()->json([
            'message' => 'Catégorie créée avec succès',
            'data' => $category,
            'image_url' => $imagePath ? asset("storage/{$imagePath}") : null
        ], 201);
    }

    /**
     * @OldOA\\Get(
     * path="/api/get_category/{id}",
     * summary="Afficher une catégorie",
     * tags={"Categories"},
     * @OldOA\\Parameter(
     * name="id",
     * in="path",
     * required=true,
     * description="UUID de la catégorie",
     * @OldOA\\Schema(type="string", format="uuid", example="550e8400-e29b-41d4-a716-446655440000")
     * ),
     * @OldOA\\Response(response=200, description="Catégorie trouvée"),
     * @OldOA\\Response(response=404, description="Catégorie non trouvée")
     * )
     */
    public function show($id)
    {
        // FindOrFail fonctionne automatiquement avec les strings/UUID
        $category = Category::query()
            ->when(request()->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
            ->findOrFail($id);
        return response()->json($category);
    }

    /**
     * @OldOA\\Put(
     * path="/update_category/{id}",
     * summary="Mettre à jour une catégorie",
     * tags={"Categories"},
     * @OldOA\\Parameter(
     * name="id",
     * in="path",
     * required=true,
     * description="UUID de la catégorie",
     * @OldOA\\Schema(type="string", format="uuid")
     * ),
     * @OldOA\\RequestBody(
     * @OldOA\\JsonContent(
     * @OldOA\\Property(property="name", type="string", example="Frein"),
     * @OldOA\\Property(property="description", type="string", example="Pièces de freinage")
     * )
     * ),
     * @OldOA\\Response(response=200, description="Catégorie mise à jour")
     * )
     */
    public function update(Request $request, $id)
    {
        $category = Category::query()
            ->when($request->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
            ->findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string',
            'description' => 'nullable|string',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        $data = $request->only('name', 'description');

        if ($request->hasFile('image')) {
            if ($category->image) {
                Storage::disk('public')->delete($category->image);
            }

            $file = $request->file('image');
            $filename = time() . '_' . $file->getClientOriginalName();
            $data['image'] = $file->storeAs('categories', $filename, 'public');
        }

        $category->update($data);

        return response()->json([
            'message' => 'Catégorie mise à jour',
            'data' => $category
        ]);
    }

    /**
     * @OldOA\\Delete(
     * path="/api/delete_category/{id}",
     * summary="Supprimer une catégorie",
     * tags={"Categories"},
     * @OldOA\\Parameter(
     * name="id",
     * in="path",
     * required=true,
     * description="UUID de la catégorie",
     * @OldOA\\Schema(type="string", format="uuid")
     * ),
     * @OldOA\\Response(response=200, description="Catégorie supprimée")
     * )
     */
    public function destroy($id)
    {
        $category = Category::query()
            ->when(request()->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
            ->findOrFail($id);

        // Nettoyage de l'image lors de la suppression
        if ($category->image) {
            Storage::disk('public')->delete($category->image);
        }

        $category->delete();

        return response()->json(['message' => 'Catégorie supprimée']);
    }

    /**
     * @OldOA\\Get(
     * path="/api/category/search",
     * summary="Rechercher une catégorie",
     * tags={"Categories"},
     * @OldOA\\Parameter(
     * name="query",
     * in="query",
     * required=true,
     * @OldOA\\Schema(type="string", example="moteur")
     * ),
     * @OldOA\\Response(response=200, description="Résultats de la recherche")
     * )
     */
    public function search(Request $request)
    {
        $query = $request->input('query');

        if (!$query) {
            return response()->json(['message' => 'Veuillez fournir un terme de recherche.'], 400);
        }

        $categories = Category::query()
                            ->when($request->user()?->restaurant_id, fn ($builder, $restaurantId) => $builder->where('restaurant_id', $restaurantId))
                            ->where(function ($builder) use ($query) {
                                $builder->where('name', 'LIKE', "%{$query}%")
                                    ->orWhere('description', 'LIKE', "%{$query}%");
                            })
                            ->get();

        return response()->json([
            'message' => 'Résultats de la recherche',
            'data' => $categories
        ]);
    }
}
