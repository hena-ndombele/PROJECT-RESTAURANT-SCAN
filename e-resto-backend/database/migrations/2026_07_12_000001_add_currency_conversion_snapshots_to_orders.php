<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'exchange_rate')) {
                $table->decimal('exchange_rate', 12, 4)->nullable()->after('currency');
            }

            if (!Schema::hasColumn('orders', 'exchange_rate_pair')) {
                $table->string('exchange_rate_pair', 20)->nullable()->after('exchange_rate');
            }
        });

        Schema::table('order_items', function (Blueprint $table) {
            if (!Schema::hasColumn('order_items', 'original_price')) {
                $table->decimal('original_price', 12, 2)->nullable()->after('price_at_order');
            }

            if (!Schema::hasColumn('order_items', 'original_currency')) {
                $table->string('original_currency', 3)->nullable()->after('original_price');
            }

            if (!Schema::hasColumn('order_items', 'converted_price')) {
                $table->decimal('converted_price', 12, 2)->nullable()->after('original_currency');
            }

            if (!Schema::hasColumn('order_items', 'conversion_rate')) {
                $table->decimal('conversion_rate', 14, 6)->nullable()->after('converted_price');
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            foreach (['conversion_rate', 'converted_price', 'original_currency', 'original_price'] as $column) {
                if (Schema::hasColumn('order_items', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            foreach (['exchange_rate_pair', 'exchange_rate'] as $column) {
                if (Schema::hasColumn('orders', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
