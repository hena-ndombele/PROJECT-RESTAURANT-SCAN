<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Spatie\Permission\Models\Role;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Créer le rôle admin s’il n’existe pas
        $role = Role::firstOrCreate(
            ['name' => 'admin', 'guard_name' => 'web']
        );

        // 2. Créer l’utilisateur admin
        $admin = User::firstOrCreate(
            ['email' => 'henandombele8@gmail.com'], // ton email par défaut
            [
                'first_name'   => 'Hena',
                'last_name'    => 'Ndombele',
                'phone_number' => '0000000000',
                'address'      => 'Kinshasa',
                'password'     => bcrypt('12345678'),
            ]
        );

        // 3. Lui donner le rôle admin
        if (! $admin->hasRole('admin')) {
            $admin->assignRole($role);
        }

        $role->syncPermissions(\Spatie\Permission\Models\Permission::pluck('name')->toArray());
    }
}
