<?php

namespace App\Http\Controllers\roles;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    public function store(Request $request)
    {
        if ($response = $this->ensureCanManageRoles($request)) {
            return $response;
        }
        if ($response = $this->ensureRoleLimit($request)) {
            return $response;
        }

        $restaurantId = $request->user()?->restaurant_id;

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                Rule::unique('roles', 'name')
                    ->where('guard_name', 'web')
                    ->where('restaurant_id', $restaurantId),
            ],
            'permissions' => 'nullable|array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $role = Role::query()->create([
            'name' => $validated['name'],
            'guard_name' => 'web',
            'restaurant_id' => $restaurantId,
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
        $roles = $this->rolesQuery($request)->with('permissions')->paginate($perPage);

        return response()->json($roles);
    }

    public function show(Request $request, $id)
    {
        if ($response = $this->ensureCanManageRoles($request)) {
            return $response;
        }

        $role = $this->rolesQuery($request)->with('permissions')->findOrFail($id);

        return response()->json($role);
    }

    public function update(Request $request, $id)
    {
        if ($response = $this->ensureCanManageRoles($request)) {
            return $response;
        }

        $role = $this->rolesQuery($request)->findOrFail($id);
        if ($response = $this->ensureNotEditingOwnRole($request, $role)) {
            return $response;
        }

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                Rule::unique('roles', 'name')
                    ->ignore($role->id)
                    ->where('guard_name', $role->guard_name)
                    ->where('restaurant_id', $role->restaurant_id),
            ],
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

        $role = $this->rolesQuery($request)->findOrFail($id);
        if ($response = $this->ensureNotEditingOwnRole($request, $role)) {
            return $response;
        }
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

        $roles = $this->rolesQuery($request)
            ->with('permissions')
            ->where(function (Builder $builder) use ($query) {
                $builder->where('name', 'LIKE', "%{$query}%")
                    ->orWhere('guard_name', 'LIKE', "%{$query}%");
            })
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

        $role = $this->rolesQuery($request)->findOrFail($id);
        if ($response = $this->ensureNotEditingOwnRole($request, $role)) {
            return $response;
        }
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

        return null;
    }

    private function ensureRoleLimit(Request $request)
    {
        $restaurant = $request->user()?->restaurant()->with('plan')->first();
        if (!$restaurant) {
            return null;
        }

        $limit = $this->roleLimitForPlan($restaurant->plan?->tier() ?? 'starter');
        if ($limit !== null && $this->rolesQuery($request)->count() >= $limit) {
            return response()->json([
                'message' => "Votre plan limite la creation a {$limit} roles. Passez a un plan superieur pour en ajouter plus.",
                'requires_upgrade' => true,
            ], 403);
        }

        return null;
    }

    private function ensureNotEditingOwnRole(Request $request, Role $role)
    {
        $user = $request->user();
        if (!$user || $this->isRestaurantOwner($user)) {
            return null;
        }

        $hasRole = $user->roles()
            ->where('roles.id', $role->id)
            ->exists();

        if (!$hasRole) {
            return null;
        }

        return response()->json([
            'message' => 'Vous ne pouvez pas modifier un rôle qui vous donne vos propres permissions. Demandez au proprietaire du restaurant de le faire.',
        ], 403);
    }

    private function isRestaurantOwner($user): bool
    {
        $restaurant = $user?->restaurant;
        if (!$user || !$restaurant) {
            return false;
        }

        if ($restaurant->business_owner_user_id) {
            return $restaurant->business_owner_user_id === $user->id;
        }

        return strcasecmp((string) $restaurant->owner_email, (string) $user->email) === 0;
    }

    private function roleLimitForPlan(string $tier): ?int
    {
        return match ($tier) {
            'starter' => 5,
            'pro' => 8,
            default => null,
        };
    }

    private function rolesQuery(Request $request): Builder
    {
        $restaurantId = $request->user()?->restaurant_id;

        return Role::query()
            ->when(
                $restaurantId,
                fn (Builder $query) => $query->where('restaurant_id', $restaurantId),
                fn (Builder $query) => $query->whereNull('restaurant_id')
            );
    }
}
