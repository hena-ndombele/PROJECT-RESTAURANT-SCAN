<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('saas_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->decimal('monthly_price', 12, 2)->default(0);
            $table->string('currency', 3)->default('USD');
            $table->unsignedInteger('max_restaurants')->default(1);
            $table->unsignedInteger('max_tables')->default(10);
            $table->unsignedInteger('max_users')->default(3);
            $table->json('features')->nullable();
            $table->boolean('is_popular')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('restaurants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('legal_name')->nullable();
            $table->string('owner_name');
            $table->string('owner_email');
            $table->string('owner_phone')->nullable();
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->string('country')->default('CD');
            $table->string('currency', 3)->default('CDF');
            $table->string('logo')->nullable();
            $table->string('status')->default('trial');
            $table->foreignUuid('saas_plan_id')->nullable()->constrained('saas_plans')->nullOnDelete();
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('subscription_ends_at')->nullable();
            $table->json('settings')->nullable();
            $table->timestamps();
        });

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

        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('restaurant_id')->nullable()->constrained('restaurants')->nullOnDelete();
            $table->foreignUuid('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->string('type')->default('order');
            $table->string('method')->default('cash');
            $table->string('provider')->nullable();
            $table->string('status')->default('pending');
            $table->decimal('amount', 12, 2);
            $table->string('currency', 3)->default('CDF');
            $table->string('reference')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });

        foreach (['users', 'categories', 'plats', 'tables', 'contact_messages', 'reservations', 'agents', 'account_requests'] as $tableName) {
            if (Schema::hasTable($tableName) && !Schema::hasColumn($tableName, 'restaurant_id')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->foreignUuid('restaurant_id')->nullable()->after('id')->constrained('restaurants')->nullOnDelete();
                });
            }
        }

        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table) {
                if (!Schema::hasColumn('orders', 'restaurant_id')) {
                    $table->foreignUuid('restaurant_id')->nullable()->after('id')->constrained('restaurants')->nullOnDelete();
                }
                if (!Schema::hasColumn('orders', 'payment_method')) {
                    $table->string('payment_method')->default('cash')->after('currency');
                }
                if (!Schema::hasColumn('orders', 'payment_provider')) {
                    $table->string('payment_provider')->nullable()->after('payment_method');
                }
                if (!Schema::hasColumn('orders', 'payment_status')) {
                    $table->string('payment_status')->default('pending')->after('payment_provider');
                }
            });

            DB::statement("ALTER TABLE orders MODIFY status ENUM('pending','preparing','ready','delivered','paid','cancelled') DEFAULT 'pending'");
        }

        if (Schema::hasTable('tables') && !Schema::hasColumn('tables', 'server_phone')) {
            Schema::table('tables', function (Blueprint $table) {
                $table->string('server_phone')->nullable()->after('status');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('restaurant_subscriptions');
        Schema::dropIfExists('restaurants');
        Schema::dropIfExists('saas_plans');
    }
};
