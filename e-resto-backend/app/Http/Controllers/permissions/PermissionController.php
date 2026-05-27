<?php

namespace App\Http\Controllers\permissions;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

class PermissionController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 10);

        return response()->json(Permission::paginate($perPage));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:permissions,name',
        ]);

        $permission = Permission::create([
            'name' => $validated['name'],
            'guard_name' => 'web',
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([
            'message' => 'Permission creee avec succes',
            'data' => $permission,
        ], 201);
    }

    public function show($id)
    {
        return response()->json(Permission::findOrFail($id));
    }

    public function update(Request $request, $id)
    {
        $permission = Permission::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|unique:permissions,name,' . $permission->id,
        ]);

        $permission->update([
            'name' => $validated['name'],
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([
            'message' => 'Permission mise a jour avec succes',
            'data' => $permission,
        ]);
    }

    public function destroy($id)
    {
        $permission = Permission::findOrFail($id);
        $permission->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([
            'message' => 'Permission supprimee avec succes',
        ]);
    }

    public function search(Request $request)
    {
        $query = $request->input('query');
        $perPage = $request->input('per_page', 10);

        if (!$query) {
            return response()->json([
                'message' => 'Veuillez fournir une valeur de recherche.',
            ], 400);
        }

        $permissions = Permission::where('name', 'LIKE', "%{$query}%")
            ->orWhere('guard_name', 'LIKE', "%{$query}%")
            ->paginate($perPage);

        return response()->json($permissions);
    }
}
