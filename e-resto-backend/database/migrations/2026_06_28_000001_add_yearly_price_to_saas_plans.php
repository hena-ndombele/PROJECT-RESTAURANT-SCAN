<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('saas_plans', function (Blueprint $table) {
            if (!Schema::hasColumn('saas_plans', 'yearly_price')) {
                $table->decimal('yearly_price', 12, 2)->nullable()->after('monthly_price');
            }
        });
    }

    public function down(): void
    {
        Schema::table('saas_plans', function (Blueprint $table) {
            if (Schema::hasColumn('saas_plans', 'yearly_price')) {
                $table->dropColumn('yearly_price');
            }
        });
    }
};
