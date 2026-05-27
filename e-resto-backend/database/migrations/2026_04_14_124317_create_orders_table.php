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
    Schema::create('orders', function (Blueprint $table) {
        $table->uuid('id')->primary(); // ID de la commande en UUID
        $table->foreignUuid('table_id')->constrained('tables')->onDelete('cascade');
        $table->decimal('total_amount', 10, 2)->default(0);
        $table->string('currency')->default('CDF');
        $table->enum('status', ['pending', 'preparing', 'ready', 'delivered', 'paid'])->default('pending');
        $table->text('note')->nullable();
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
