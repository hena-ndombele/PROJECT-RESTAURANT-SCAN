<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('tracking_code', 12)->nullable()->unique()->after('id');
            $table->string('customer_name')->nullable()->after('note');
            $table->string('customer_phone', 30)->nullable()->after('customer_name');
            $table->string('customer_email')->nullable()->after('customer_phone');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique(['tracking_code']);
            $table->dropColumn([
                'tracking_code',
                'customer_name',
                'customer_phone',
                'customer_email',
            ]);
        });
    }
};
