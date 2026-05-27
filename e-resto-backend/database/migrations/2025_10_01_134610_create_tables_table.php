<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
      Schema::create('tables', function (Blueprint $table) {
   $table->uuid('id')->primary();
    $table->string('name');
    $table->integer('capacity')->default(2);
    // On utilise un enum pour sécuriser les statuts
    $table->enum('status', ['Libre', 'Occupée', 'Réservée'])->default('Libre');
    $table->string('qr_code')->nullable();
    $table->timestamps();
});
    }

    public function down(): void
    {
        Schema::dropIfExists('tables');
    }
};
