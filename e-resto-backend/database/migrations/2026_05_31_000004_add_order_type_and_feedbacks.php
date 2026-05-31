<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'order_type')) {
                $table->string('order_type')->default('dine_in')->after('table_id');
            }
            if (!Schema::hasColumn('orders', 'pickup_name')) {
                $table->string('pickup_name')->nullable()->after('customer_email');
            }
            if (!Schema::hasColumn('orders', 'pickup_phone')) {
                $table->string('pickup_phone')->nullable()->after('pickup_name');
            }
        });

        Schema::create('feedbacks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('restaurant_id')->nullable()->constrained('restaurants')->nullOnDelete();
            $table->foreignUuid('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->foreignUuid('table_id')->nullable()->constrained('tables')->nullOnDelete();
            $table->unsignedTinyInteger('food_rating')->default(0);
            $table->unsignedTinyInteger('service_rating')->default(0);
            $table->unsignedTinyInteger('ordering_rating')->default(0);
            $table->boolean('recommended')->nullable();
            $table->text('comment')->nullable();
            $table->string('customer_name')->nullable();
            $table->string('customer_phone')->nullable();
            $table->string('status')->default('new');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feedbacks');

        Schema::table('orders', function (Blueprint $table) {
            foreach (['order_type', 'pickup_name', 'pickup_phone'] as $column) {
                if (Schema::hasColumn('orders', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
