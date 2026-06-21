<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('agents') && Schema::hasColumn('agents', 'user_id')) {
            try {
                Schema::table('agents', function (Blueprint $table) {
                    $table->dropForeign(['user_id']);
                });
            } catch (Throwable) {
                // Some local databases may not have the foreign key anymore.
            }

            DB::statement('ALTER TABLE agents MODIFY user_id CHAR(36) NULL');

            try {
                Schema::table('agents', function (Blueprint $table) {
                    $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
                });
            } catch (Throwable) {
                // Keep migration tolerant for already customized local databases.
            }
        }

        if (Schema::hasTable('users') && !Schema::hasColumn('users', 'agent_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->foreignUuid('agent_id')
                    ->nullable()
                    ->after('restaurant_id')
                    ->constrained('agents')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('users') && Schema::hasColumn('users', 'agent_id')) {
            Schema::table('users', function (Blueprint $table) {
                try {
                    $table->dropForeign(['agent_id']);
                } catch (Throwable) {
                }
                $table->dropColumn('agent_id');
            });
        }
    }
};
