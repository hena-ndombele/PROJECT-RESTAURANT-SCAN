<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint; // Cet import est crucial
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Remplacez (Table $table) par (Blueprint $table)
        Schema::create('account_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('username');
            $table->string('phone');
            $table->text('message')->nullable(); // nullable permet d'envoyer un formulaire sans message
            $table->string('status')->default('pending');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('account_requests');
    }
};
