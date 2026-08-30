<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('newsletter_subscribers', function (Blueprint $table) {
            $table->string('confirmation_token', 64)->nullable()->unique()->after('status');
            $table->timestamp('confirmed_at')->nullable()->after('subscribed_at');
            $table->timestamp('unsubscribed_at')->nullable()->after('confirmed_at');
        });

        DB::table('newsletter_subscribers')
            ->where('status', 'subscribed')
            ->update(['status' => 'confirmed', 'confirmed_at' => DB::raw('COALESCE(subscribed_at, created_at)')]);

        Schema::create('newsletter_campaigns', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('subject');
            $table->longText('content');
            $table->string('image_path')->nullable();
            $table->string('button_text')->nullable();
            $table->text('button_url')->nullable();
            $table->string('status')->default('draft');
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->unsignedInteger('recipient_total')->default(0);
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('newsletter_campaign_deliveries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('campaign_id')->constrained('newsletter_campaigns')->cascadeOnDelete();
            $table->foreignUuid('subscriber_id')->constrained('newsletter_subscribers')->cascadeOnDelete();
            $table->string('email');
            $table->string('status')->default('pending');
            $table->timestamp('sent_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();
            $table->unique(['campaign_id', 'subscriber_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('newsletter_campaign_deliveries');
        Schema::dropIfExists('newsletter_campaigns');
        Schema::table('newsletter_subscribers', function (Blueprint $table) {
            $table->dropUnique(['confirmation_token']);
            $table->dropColumn(['confirmation_token', 'confirmed_at', 'unsubscribed_at']);
        });
    }
};
