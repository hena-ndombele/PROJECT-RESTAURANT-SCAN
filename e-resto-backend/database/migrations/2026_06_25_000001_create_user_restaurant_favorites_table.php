<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('user_restaurant_favorites')) {
            return;
        }

        Schema::create('user_restaurant_favorites', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('restaurant_id')->constrained('restaurants')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'restaurant_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_restaurant_favorites');
    }
};
