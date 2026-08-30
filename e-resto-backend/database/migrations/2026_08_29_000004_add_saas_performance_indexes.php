<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addIndex('orders', ['restaurant_id', 'status', 'created_at'], 'orders_restaurant_status_created_index');
        $this->addIndex('orders', ['restaurant_id', 'created_at'], 'orders_restaurant_created_index');
        $this->addIndex('payments', ['restaurant_id', 'type', 'status', 'created_at'], 'payments_restaurant_type_status_created_index');
        $this->addIndex('payments', ['type', 'status', 'paid_at'], 'payments_type_status_paid_index');
        $this->addIndex('plats', ['restaurant_id', 'category_id', 'is_available'], 'plats_restaurant_category_available_index');
        $this->addIndex('tables', ['restaurant_id', 'status'], 'tables_restaurant_status_index');
        $this->addIndex('users', ['restaurant_id', 'created_at'], 'users_restaurant_created_index');
        $this->addIndex('restaurants', ['status', 'created_at'], 'restaurants_status_created_index');
        $this->addIndex('restaurants', ['saas_plan_id', 'status'], 'restaurants_plan_status_index');
        $this->addIndex('newsletter_subscribers', ['status', 'id'], 'newsletter_subscribers_status_id_index');
        $this->addIndex('newsletter_campaigns', ['status', 'scheduled_at'], 'newsletter_campaigns_status_scheduled_index');
        $this->addIndex('newsletter_campaign_deliveries', ['campaign_id', 'status'], 'newsletter_deliveries_campaign_status_index');
        $this->addIndex('RÃ©servations', ['restaurant_id', 'status', 'reservation_date'], 'reservations_restaurant_status_date_index');
    }

    public function down(): void
    {
        foreach ([
            ['orders', 'orders_restaurant_status_created_index'], ['orders', 'orders_restaurant_created_index'],
            ['payments', 'payments_restaurant_type_status_created_index'], ['payments', 'payments_type_status_paid_index'],
            ['plats', 'plats_restaurant_category_available_index'], ['tables', 'tables_restaurant_status_index'],
            ['users', 'users_restaurant_created_index'], ['restaurants', 'restaurants_status_created_index'],
            ['restaurants', 'restaurants_plan_status_index'], ['newsletter_subscribers', 'newsletter_subscribers_status_id_index'],
            ['newsletter_campaigns', 'newsletter_campaigns_status_scheduled_index'],
            ['newsletter_campaign_deliveries', 'newsletter_deliveries_campaign_status_index'],
            ['RÃ©servations', 'reservations_restaurant_status_date_index'],
        ] as [$table, $index]) {
            if ($this->indexExists($table, $index)) Schema::table($table, fn (Blueprint $blueprint) => $blueprint->dropIndex($index));
        }
    }

    private function addIndex(string $table, array $columns, string $name): void
    {
        if (!Schema::hasTable($table) || $this->indexExists($table, $name)) return;
        foreach ($columns as $column) if (!Schema::hasColumn($table, $column)) return;
        Schema::table($table, fn (Blueprint $blueprint) => $blueprint->index($columns, $name));
    }

    private function indexExists(string $table, string $index): bool
    {
        if (!Schema::hasTable($table)) return false;
        return collect(DB::select("SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$index]))->isNotEmpty();
    }
};
