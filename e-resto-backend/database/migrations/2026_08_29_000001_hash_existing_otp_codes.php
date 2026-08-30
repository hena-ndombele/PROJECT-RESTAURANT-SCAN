<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('otps', function ($table) {
            $table->string('code', 255)->change();
        });

        DB::table('otps')->orderBy('id')->each(function (object $otp): void {
            if (!Hash::needsRehash($otp->code)) {
                return;
            }

            DB::table('otps')
                ->where('id', $otp->id)
                ->update(['code' => Hash::make((string) $otp->code)]);
        });
    }

    public function down(): void
    {
        DB::table('otps')->delete();

        Schema::table('otps', function ($table) {
            $table->string('code', 6)->change();
        });
    }
};
