<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('subscriptions:send-expiration-reminders')
    ->dailyAt('08:00')
    ->timezone(config('app.display_timezone', 'Africa/Kinshasa'))
    ->withoutOverlapping();

Schedule::command('newsletter:dispatch-scheduled')
    ->everyMinute()
    ->withoutOverlapping();
