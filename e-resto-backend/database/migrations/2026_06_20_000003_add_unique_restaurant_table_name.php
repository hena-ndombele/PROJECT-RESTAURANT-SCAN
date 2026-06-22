<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('tables') || !Schema::hasColumn('tables', 'restaurant_id') || !Schema::hasColumn('tables', 'name')) {
            return;
        }

        try {
            DB::statement('CREATE UNIQUE INDEX tables_restaurant_id_name_unique ON tables (restaurant_id, name)');
        } catch (Throwable) {
            // Existing duplicate data should be cleaned manually; controller validation still protects new writes.
        }
    }

    public function down(): void
    {
        try {
            DB::statement('DROP INDEX tables_restaurant_id_name_unique ON tables');
        } catch (Throwable) {
        }
    }
};
