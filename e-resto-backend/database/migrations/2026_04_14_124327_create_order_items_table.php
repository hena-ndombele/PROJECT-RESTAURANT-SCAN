<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
public function up()
{
    Schema::create('order_items', function (Blueprint $table) {
        $table->uuid('id')->primary(); // ID de la ligne en UUID
        $table->foreignUuid('order_id')->constrained('orders')->onDelete('cascade');
        $table->foreignUuid('plat_id')->constrained('plats')->onDelete('cascade');
        $table->integer('quantity');
        $table->decimal('price_at_order', 10, 2);
        $table->timestamps();
    });
}
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
