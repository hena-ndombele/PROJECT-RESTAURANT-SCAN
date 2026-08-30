<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $role = Role::firstOrCreate([
            'name' => 'admin',
            'guard_name' => 'web',
        ]);

        // Keep the platform administrator separate from every restaurant account.
        $admin = User::updateOrCreate(
            ['email' => env('ADMIN_EMAIL', 'henandombele8@gmail.com')],
            [
                'first_name' => 'Hena',
                'last_name' => 'Ndombele',
                'phone_number' => '0000000000',
                'address' => 'Kinshasa',
                'password' => bcrypt(env('ADMIN_PASSWORD', 'admin1234*')),
                'restaurant_id' => null,
            ]
        );

        $admin->syncRoles([$role]);

        $role->syncPermissions(Permission::pluck('name')->all());
    }
}
