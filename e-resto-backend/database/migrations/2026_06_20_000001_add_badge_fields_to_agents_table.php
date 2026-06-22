<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('agents')) {
            return;
        }

        Schema::table('agents', function (Blueprint $table) {
            if (!Schema::hasColumn('agents', 'matricule')) {
                $table->string('matricule', 60)->nullable()->after('user_id')->index();
            }
            if (!Schema::hasColumn('agents', 'photo')) {
                $table->string('photo')->nullable()->after('email');
            }
            if (!Schema::hasColumn('agents', 'department')) {
                $table->string('department')->nullable()->after('fonction');
            }
            if (!Schema::hasColumn('agents', 'status')) {
                $table->string('status', 30)->default('active')->after('department');
            }
            if (!Schema::hasColumn('agents', 'contract_type')) {
                $table->string('contract_type', 60)->nullable()->after('status');
            }
            if (!Schema::hasColumn('agents', 'shift')) {
                $table->string('shift', 60)->nullable()->after('contract_type');
            }
            if (!Schema::hasColumn('agents', 'hired_at')) {
                $table->date('hired_at')->nullable()->after('shift');
            }
            if (!Schema::hasColumn('agents', 'emergency_contact_name')) {
                $table->string('emergency_contact_name')->nullable()->after('hired_at');
            }
            if (!Schema::hasColumn('agents', 'emergency_contact_phone')) {
                $table->string('emergency_contact_phone', 60)->nullable()->after('emergency_contact_name');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('agents')) {
            return;
        }

        Schema::table('agents', function (Blueprint $table) {
            foreach ([
                'emergency_contact_phone',
                'emergency_contact_name',
                'hired_at',
                'shift',
                'contract_type',
                'status',
                'department',
                'photo',
                'matricule',
            ] as $column) {
                if (Schema::hasColumn('agents', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
