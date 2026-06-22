<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach ($this->tenantTables() as $tableName) {
            $this->addRestaurantReference($tableName);
        }
    }

    public function down(): void
    {
        foreach ($this->tenantTables() as $tableName) {
            $this->dropRestaurantReference($tableName);
        }
    }

    private function tenantTables(): array
    {
        return [
            'users',
            'categories',
            'plats',
            'tables',
            'orders',
            'contact_messages',
            'agents',
            'account_requests',
            'Réservations',
            'RÃ©servations',
        ];
    }

    private function addRestaurantReference(string $tableName): void
    {
        if (!Schema::hasTable($tableName) || Schema::hasColumn($tableName, 'restaurant_id')) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) {
            $table->foreignUuid('restaurant_id')
                ->nullable()
                ->after('id')
                ->constrained('restaurants')
                ->nullOnDelete();
        });
    }

    private function dropRestaurantReference(string $tableName): void
    {
        if (!Schema::hasTable($tableName) || !Schema::hasColumn($tableName, 'restaurant_id')) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) {
            try {
                $table->dropForeign(['restaurant_id']);
            } catch (Throwable) {
                // Keep rollback tolerant when a database was altered manually.
            }

            $table->dropColumn('restaurant_id');
        });
    }
};
