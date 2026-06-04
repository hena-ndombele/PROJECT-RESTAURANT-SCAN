<?php

namespace App\Http\Controllers\roles;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    public function store(Request $request)
    {
        if ($response = $this->ensureCanManageRoles($request)) {
            return $response;
        }

        $validated = $request->validate([
            'name' => 'required|string|unique:roles,name',
            'permissions' => 'nullable|array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $role = Role::create([
            'name' => $validated['name'],
            'guard_name' => 'web',
        ]);

        if (!empty($validated['permissions'])) {
            $role->syncPermissions($validated['permissions']);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([
            'message' => 'Role cree avec succes',
            'data' => $role->load('permissions'),
        ], 201);
    }

    public function index(Request $request)
    {
        if ($response = $this->ensureCanManageRoles($request)) {
            return $response;
        }

        $perPage = $request->input('per_page', 10);
        $roles = Role::with('permissions')->paginate($perPage);

        return response()->json($roles);
    }

    public function show(Request $request, $id)
    {
        if ($response = $this->ensureCanManageRoles($request)) {
            return $response;
        }

        $role = Role::with('permissions')->findOrFail($id);

        return response()->json($role);
    }

    public function update(Request $request, $id)
    {
        if ($response = $this->ensureCanManageRoles($request)) {
            return $response;
        }

        $role = Role::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|unique:roles,name,' . $role->id,
            'permissions' => 'nullable|array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $role->update([
            'name' => $validated['name'],
        ]);

        if ($request->has('permissions')) {
            $role->syncPermissions($validated['permissions'] ?? []);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([
            'message' => 'Role mis a jour avec succes',
            'data' => $role->load('permissions'),
        ]);
    }

    public function destroy(Request $request, $id)
    {
        if ($response = $this->ensureCanManageRoles($request)) {
            return $response;
        }

        $role = Role::findOrFail($id);
        $role->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([
            'message' => 'Role supprime avec succes',
        ]);
    }

    public function search(Request $request)
    {
        if ($response = $this->ensureCanManageRoles($request)) {
            return $response;
        }

        $query = $request->input('query');
        $perPage = $request->input('per_page', 10);

        if (!$query) {
            return response()->json([
                'message' => 'Veuillez fournir une valeur de recherche.',
            ], 400);
        }

        $roles = Role::with('permissions')
            ->where('name', 'LIKE', "%{$query}%")
            ->orWhere('guard_name', 'LIKE', "%{$query}%")
            ->paginate($perPage);

        return response()->json($roles);
    }

    public function syncPermissions(Request $request, $id)
    {
        if ($response = $this->ensureCanManageRoles($request)) {
            return $response;
        }

        $validated = $request->validate([
            'permissions' => 'required|array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $role = Role::findOrFail($id);
        $role->syncPermissions($validated['permissions']);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([
            'message' => 'Permissions du role mises a jour avec succes',
            'data' => $role->load('permissions'),
        ]);
    }

    private function ensureCanManageRoles(Request $request)
    {
        $restaurant = $request->user()?->restaurant()->with('plan')->first();
        if (!$restaurant) {
            return null;
        }

        if ($restaurant->plan?->allows('roles')) {
            return null;
        }

        return response()->json([
            'message' => 'La gestion des roles et permissions est reservee au plan Business.',
            'requires_upgrade' => true,
        ], 403);
    }
}
