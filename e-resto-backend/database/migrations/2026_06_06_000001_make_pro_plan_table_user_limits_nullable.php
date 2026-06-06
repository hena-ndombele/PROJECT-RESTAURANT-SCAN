<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE saas_plans MODIFY max_tables INT UNSIGNED NULL');
        DB::statement('ALTER TABLE saas_plans MODIFY max_users INT UNSIGNED NULL');

        DB::table('saas_plans')
            ->where('slug', 'pro')
            ->update([
                'max_tables' => null,
                'max_users' => null,
            ]);
    }

    public function down(): void
    {
        DB::table('saas_plans')
            ->whereNull('max_tables')
            ->update(['max_tables' => 20]);

        DB::table('saas_plans')
            ->whereNull('max_users')
            ->update(['max_users' => 15]);

        DB::statement('ALTER TABLE saas_plans MODIFY max_tables INT UNSIGNED NOT NULL DEFAULT 10');
        DB::statement('ALTER TABLE saas_plans MODIFY max_users INT UNSIGNED NOT NULL DEFAULT 3');
    }
};
