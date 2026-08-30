<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_reminder_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('restaurant_id')->constrained()->cascadeOnDelete();
            $table->string('type', 40);
            $table->date('target_date');
            $table->string('recipient');
            $table->timestamp('sent_at');
            $table->timestamps();

            $table->unique(['restaurant_id', 'type', 'target_date'], 'subscription_reminder_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_reminder_logs');
    }
};
