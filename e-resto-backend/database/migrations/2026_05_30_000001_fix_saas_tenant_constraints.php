<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            try {
                $table->dropUnique(['name']);
            } catch (Throwable) {
                // Some existing databases may already have the unique index removed.
            }

            $table->index(['restaurant_id', 'name'], 'categories_restaurant_name_index');
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            try {
                $table->dropIndex('categories_restaurant_name_index');
            } catch (Throwable) {
                // Keep rollback tolerant across local database states.
            }
        });
    }
};
