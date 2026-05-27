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
        Schema::create('otps', function (Blueprint $table) {
            // ID de la table OTP en UUID
            $table->uuid('id')->primary();

            // CORRECTION : On utilise foreignUuid au lieu de unsignedBigInteger
            // Cela crée la colonne 'user_id' (type UUID) et la clé étrangère en une seule ligne
            $table->foreignUuid('user_id')
                  ->constrained('users')
                  ->onDelete('cascade');

            $table->string('code', 6); // Passage à 6 caractères (plus standard)
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('otps');
    }
};
