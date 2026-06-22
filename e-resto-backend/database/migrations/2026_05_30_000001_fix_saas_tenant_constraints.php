<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if ($this->indexExists('categories', 'categories_name_unique')) {
            Schema::table('categories', function (Blueprint $table) {
                $table->dropUnique(['name']);
            });
        }

        Schema::table('categories', function (Blueprint $table) {
            if (!$this->indexExists('categories', 'categories_restaurant_name_index')) {
                $table->index(['restaurant_id', 'name'], 'categories_restaurant_name_index');
            }
        });
    }

    public function down(): void
    {
        // Keep rollback tolerant: MySQL may use this index for a foreign key,
        // and the table itself is dropped by earlier migrations during refresh.
    }

    private function indexExists(string $table, string $index): bool
    {
        return collect(DB::select("SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$index]))->isNotEmpty();
    }
};
