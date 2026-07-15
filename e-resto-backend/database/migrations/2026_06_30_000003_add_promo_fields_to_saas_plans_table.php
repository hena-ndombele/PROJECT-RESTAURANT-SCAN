<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('saas_plans', function (Blueprint $table) {
            $table->string('promo_label')->nullable()->after('yearly_price');
            $table->unsignedTinyInteger('promo_percent')->nullable()->after('promo_label');
            $table->date('promo_starts_at')->nullable()->after('promo_percent');
            $table->date('promo_ends_at')->nullable()->after('promo_starts_at');
        });
    }

    public function down(): void
    {
        Schema::table('saas_plans', function (Blueprint $table) {
            $table->dropColumn(['promo_label', 'promo_percent', 'promo_starts_at', 'promo_ends_at']);
        });
    }
};
