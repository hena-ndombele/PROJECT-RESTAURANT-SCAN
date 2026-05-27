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
    Schema::create('agents', function (Blueprint $table) {
        $table->uuid('id')->primary();

        // CORRECTION : On utilise foreignUuid au lieu de foreignId
        $table->foreignUuid('user_id')->constrained('users')->onDelete('cascade');

        $table->string('first_name');
        $table->string('last_name');
        $table->string('email');
        $table->string('phone_number');
        $table->string('address');
        $table->string('education_level');
        $table->string('fonction');

        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('agents');
    }
};
