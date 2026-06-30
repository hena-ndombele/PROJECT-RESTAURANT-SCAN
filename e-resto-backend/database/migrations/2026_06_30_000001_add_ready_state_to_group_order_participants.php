<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('group_order_participants', function (Blueprint $table) {
            if (!Schema::hasColumn('group_order_participants', 'is_ready')) {
                $table->boolean('is_ready')->default(false)->after('is_creator');
            }

            if (!Schema::hasColumn('group_order_participants', 'last_seen_at')) {
                $table->timestamp('last_seen_at')->nullable()->after('is_ready');
            }
        });
    }

    public function down(): void
    {
        Schema::table('group_order_participants', function (Blueprint $table) {
            if (Schema::hasColumn('group_order_participants', 'last_seen_at')) {
                $table->dropColumn('last_seen_at');
            }

            if (Schema::hasColumn('group_order_participants', 'is_ready')) {
                $table->dropColumn('is_ready');
            }
        });
    }
};
