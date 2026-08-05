<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('table_sessions')) {
            Schema::create('table_sessions', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('restaurant_id')->constrained()->cascadeOnDelete();
                $table->foreignUuid('table_id')->constrained('tables')->cascadeOnDelete();
                $table->string('token', 100)->unique();
                $table->string('status', 20)->default('active');
                $table->timestamp('expires_at')->nullable();
                $table->timestamp('closed_at')->nullable();
                $table->timestamps();

                $table->index(['table_id', 'status', 'expires_at']);
                $table->index(['restaurant_id', 'status']);
            });
        }

        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'table_session_id')) {
                $table->foreignUuid('table_session_id')->nullable()->after('table_id')->constrained('table_sessions')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'table_session_id')) {
                $table->dropConstrainedForeignId('table_session_id');
            }
        });

        Schema::dropIfExists('table_sessions');
    }
};
