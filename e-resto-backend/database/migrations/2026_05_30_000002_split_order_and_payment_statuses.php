<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('orders')) {
            return;
        }

        if (Schema::hasColumn('orders', 'payment_status')) {
            DB::table('orders')
                ->where('status', 'paid')
                ->update([
                    'status' => 'delivered',
                    'payment_status' => 'paid',
                    'payment_method' => DB::raw("COALESCE(payment_method, 'cash')"),
                ]);
        }

        DB::statement("ALTER TABLE orders MODIFY status ENUM('pending','preparing','ready','delivered','cancelled') DEFAULT 'pending'");
    }

    public function down(): void
    {
        if (!Schema::hasTable('orders')) {
            return;
        }

        DB::statement("ALTER TABLE orders MODIFY status ENUM('pending','preparing','ready','delivered','paid','cancelled') DEFAULT 'pending'");
    }
};
