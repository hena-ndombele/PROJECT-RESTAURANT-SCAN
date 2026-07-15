<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('group_order_participants', function (Blueprint $table) {
            if (!Schema::hasColumn('group_order_participants', 'email_receipt_requested')) {
                $table->boolean('email_receipt_requested')->default(false)->after('email');
            }

            if (!Schema::hasColumn('group_order_participants', 'email_feedback_requested')) {
                $table->boolean('email_feedback_requested')->default(false)->after('email_receipt_requested');
            }
        });
    }

    public function down(): void
    {
        Schema::table('group_order_participants', function (Blueprint $table) {
            if (Schema::hasColumn('group_order_participants', 'email_feedback_requested')) {
                $table->dropColumn('email_feedback_requested');
            }

            if (Schema::hasColumn('group_order_participants', 'email_receipt_requested')) {
                $table->dropColumn('email_receipt_requested');
            }
        });
    }
};
