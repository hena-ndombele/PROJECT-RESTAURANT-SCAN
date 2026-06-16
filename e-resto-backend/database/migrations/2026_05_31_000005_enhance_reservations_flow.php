<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private string $tableName = 'Réservations';

    public function up(): void
    {
        if (!Schema::hasTable($this->tableName)) {
            return;
        }

        Schema::table($this->tableName, function (Blueprint $table) {
            if (!Schema::hasColumn($this->tableName, 'source')) {
                $table->string('source')->default('qr_client')->after('status');
            }
            if (!Schema::hasColumn($this->tableName, 'internal_note')) {
                $table->text('internal_note')->nullable()->after('special_requests');
            }
            if (!Schema::hasColumn($this->tableName, 'cancellation_reason')) {
                $table->text('cancellation_reason')->nullable()->after('internal_note');
            }
            if (!Schema::hasColumn($this->tableName, 'confirmed_at')) {
                $table->timestamp('confirmed_at')->nullable()->after('source');
            }
            if (!Schema::hasColumn($this->tableName, 'seated_at')) {
                $table->timestamp('seated_at')->nullable()->after('confirmed_at');
            }
            if (!Schema::hasColumn($this->tableName, 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('seated_at');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable($this->tableName)) {
            return;
        }

        Schema::table($this->tableName, function (Blueprint $table) {
            foreach (['source', 'internal_note', 'cancellation_reason', 'confirmed_at', 'seated_at', 'completed_at'] as $column) {
                if (Schema::hasColumn($this->tableName, $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
