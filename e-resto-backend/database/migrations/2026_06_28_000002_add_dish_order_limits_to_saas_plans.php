<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('saas_plans', function (Blueprint $table) {
            if (!Schema::hasColumn('saas_plans', 'max_dishes')) {
                $table->unsignedInteger('max_dishes')->nullable()->after('max_users');
            }

            if (!Schema::hasColumn('saas_plans', 'max_orders_per_month')) {
                $table->unsignedInteger('max_orders_per_month')->nullable()->after('max_dishes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('saas_plans', function (Blueprint $table) {
            if (Schema::hasColumn('saas_plans', 'max_orders_per_month')) {
                $table->dropColumn('max_orders_per_month');
            }

            if (Schema::hasColumn('saas_plans', 'max_dishes')) {
                $table->dropColumn('max_dishes');
            }
        });
    }
};
