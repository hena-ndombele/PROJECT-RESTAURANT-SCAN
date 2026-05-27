<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
           $table->uuid('id')->primary();
            $table->string('name')->unique(); // Correction : ajout de ()
            $table->text('description')->nullable(); // Utilisation de text pour plus de place
            $table->string('image')->nullable(); // Ajout du champ pour le chemin de l'image
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
