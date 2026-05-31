<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            if (!Schema::hasColumn('reservations', 'source')) {
                $table->string('source')->default('qr_client')->after('status');
            }
            if (!Schema::hasColumn('reservations', 'internal_note')) {
                $table->text('internal_note')->nullable()->after('special_requests');
            }
            if (!Schema::hasColumn('reservations', 'cancellation_reason')) {
                $table->text('cancellation_reason')->nullable()->after('internal_note');
            }
            if (!Schema::hasColumn('reservations', 'confirmed_at')) {
                $table->timestamp('confirmed_at')->nullable()->after('source');
            }
            if (!Schema::hasColumn('reservations', 'seated_at')) {
                $table->timestamp('seated_at')->nullable()->after('confirmed_at');
            }
            if (!Schema::hasColumn('reservations', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('seated_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            foreach (['source', 'internal_note', 'cancellation_reason', 'confirmed_at', 'seated_at', 'completed_at'] as $column) {
                if (Schema::hasColumn('reservations', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
