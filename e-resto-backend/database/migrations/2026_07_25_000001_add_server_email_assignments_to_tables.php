<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tables', function (Blueprint $table) {
            if (!Schema::hasColumn('tables', 'assignment_mode')) {
                $table->string('assignment_mode', 20)->default('all')->after('server_phone');
            }

            if (!Schema::hasColumn('tables', 'assigned_server_emails')) {
                $table->json('assigned_server_emails')->nullable()->after('assignment_mode');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tables', function (Blueprint $table) {
            if (Schema::hasColumn('tables', 'assigned_server_emails')) {
                $table->dropColumn('assigned_server_emails');
            }

            if (Schema::hasColumn('tables', 'assignment_mode')) {
                $table->dropColumn('assignment_mode');
            }
        });
    }
};
