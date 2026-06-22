<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = [
            'dashboard.view',
            'agents.list',
            'agents.create',
            'agents.view',
            'agents.update',
            'agents.delete',
            'users.list',
            'users.create',
            'users.view',
            'users.update',
            'users.delete',
            'roles.list',
            'roles.create',
            'roles.view',
            'roles.update',
            'roles.delete',
            'permissions.list',
            'categories.list',
            'categories.create',
            'categories.view',
            'categories.update',
            'categories.delete',
            'plats.list',
            'plats.create',
            'plats.view',
            'plats.update',
            'plats.delete',
            'tables.list',
            'tables.create',
            'tables.view',
            'tables.update',
            'tables.delete',
            'reservations.list',
            'reservations.create',
            'reservations.view',
            'reservations.update',
            'reservations.delete',
            'orders.list',
            'orders.create',
            'orders.view',
            'orders.update-status',
            'orders.delete',
            'feedback.list',
            'feedback.view',
            'settings.view',
            'settings.update',
            'account-requests.list',
            'account-requests.delete',
            'profile.view',
            'profile.change-password',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }

        $adminRole = Role::firstOrCreate([
            'name' => 'admin',
            'guard_name' => 'web',
        ]);

        $adminRole->syncPermissions($permissions);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
