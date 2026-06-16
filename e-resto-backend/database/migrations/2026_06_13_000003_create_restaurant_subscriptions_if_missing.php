<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('restaurant_subscriptions')) {
            return;
        }

        Schema::create('restaurant_subscriptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('restaurant_id')->constrained('restaurants')->cascadeOnDelete();
            $table->foreignUuid('saas_plan_id')->constrained('saas_plans')->cascadeOnDelete();
            $table->string('status')->default('trialing');
            $table->date('starts_at');
            $table->date('ends_at')->nullable();
            $table->date('next_billing_at')->nullable();
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('currency', 3)->default('USD');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('restaurant_subscriptions');
    }
};
