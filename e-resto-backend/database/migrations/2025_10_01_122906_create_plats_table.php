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
        Schema::create('plats', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->text('description');
            
            // Prix et Devise (USD/CDF)
            $table->decimal('price', 10, 2);
            $table->string('currency', 3)->default('CDF'); 
            
            // Logique métier restaurant
            $table->integer('preparation_time')->nullable()->comment('Temps en minutes');
            $table->boolean('is_available')->default(true);
            $table->json('ingredients')->nullable(); // Stockage des tags d'ingrédients
            
            // Images (Principale + 2 Secondaires)
            $table->string('image')->nullable();
            $table->string('image_secondaire_1')->nullable();
            $table->string('image_secondaire_2')->nullable();
            
            // Relation avec catégories (UUID)
            $table->foreignUuid('category_id')->constrained('categories')->onDelete('cascade');
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('plats');
    }
};