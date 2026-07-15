<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('group_order_participants')) {
            return;
        }

        Schema::create('group_order_participants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('group_order_id')->constrained('group_orders')->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('phone', 30)->nullable();
            $table->string('email', 160)->nullable();
            $table->boolean('is_creator')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('group_order_participants');
    }
};
