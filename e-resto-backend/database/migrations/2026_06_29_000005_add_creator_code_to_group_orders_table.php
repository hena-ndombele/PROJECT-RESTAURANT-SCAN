<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('group_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('group_orders', 'creator_code_hash')) {
                $table->string('creator_code_hash')->nullable()->after('creator_email');
            }
        });
    }

    public function down(): void
    {
        Schema::table('group_orders', function (Blueprint $table) {
            if (Schema::hasColumn('group_orders', 'creator_code_hash')) {
                $table->dropColumn('creator_code_hash');
            }
        });
    }
};
