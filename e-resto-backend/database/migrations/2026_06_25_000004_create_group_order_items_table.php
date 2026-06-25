<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('group_order_items')) {
            return;
        }

        Schema::create('group_order_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('group_order_id')->constrained('group_orders')->cascadeOnDelete();
            $table->foreignUuid('group_order_participant_id')->constrained('group_order_participants')->cascadeOnDelete();
            $table->foreignUuid('plat_id')->constrained('plats')->cascadeOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('price_at_add', 12, 2)->default(0);
            $table->string('note', 500)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('group_order_items');
    }
};
