<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropUnique('roles_name_guard_name_unique');
            $table->foreignUuid('restaurant_id')
                ->nullable()
                ->after('id')
                ->constrained('restaurants')
                ->nullOnDelete();
            $table->index('restaurant_id');
            $table->unique(['restaurant_id', 'name', 'guard_name'], 'roles_restaurant_name_guard_unique');
        });
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropUnique('roles_restaurant_name_guard_unique');
            $table->dropForeign(['restaurant_id']);
            $table->dropIndex(['restaurant_id']);
            $table->dropColumn('restaurant_id');
            $table->unique(['name', 'guard_name'], 'roles_name_guard_name_unique');
        });
    }
};
