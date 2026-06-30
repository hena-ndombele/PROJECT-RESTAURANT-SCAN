<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plats', function (Blueprint $table) {
            $table->unsignedTinyInteger('promotion_percent')->nullable()->after('price');
            $table->date('promotion_ends_at')->nullable()->after('promotion_percent');
        });

        DB::table('saas_plans')->orderBy('id')->chunk(50, function ($plans) {
            foreach ($plans as $plan) {
                $features = json_decode($plan->features ?: '[]', true);
                $features = is_array($features) ? $features : [];
                $alreadyListed = collect($features)->contains(fn ($feature) => strtolower(trim((string) $feature)) === 'promotions des plats');

                if (!$alreadyListed) {
                    $features[] = 'Promotions des plats';
                    DB::table('saas_plans')->where('id', $plan->id)->update([
                        'features' => json_encode(array_values($features)),
                    ]);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('plats', function (Blueprint $table) {
            $table->dropColumn(['promotion_percent', 'promotion_ends_at']);
        });

        DB::table('saas_plans')->orderBy('id')->chunk(50, function ($plans) {
            foreach ($plans as $plan) {
                $features = json_decode($plan->features ?: '[]', true);
                if (!is_array($features)) {
                    continue;
                }

                $features = array_values(array_filter($features, fn ($feature) => strtolower(trim((string) $feature)) !== 'promotions des plats'));
                DB::table('saas_plans')->where('id', $plan->id)->update([
                    'features' => json_encode($features),
                ]);
            }
        });
    }
};
