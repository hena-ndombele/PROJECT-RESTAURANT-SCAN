<?php

namespace App\Console\Commands;

use App\Mail\SubscriptionExpirationReminderMail;
use App\Models\Restaurant;
use App\Models\SubscriptionReminderLog;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendSubscriptionExpirationReminders extends Command
{
    protected $signature = 'subscriptions:send-expiration-reminders {--dry-run : Afficher les rappels sans envoyer d email}';
    protected $description = 'Envoie les rappels avant la fin des essais gratuits et des abonnements';

    public function handle(): int
    {
        $timezone = config('app.display_timezone', 'Africa/Kinshasa');
        $today = Carbon::today($timezone);
        $lastReminderDate = $today->copy()->addDays(5);
        $sent = 0;

        Restaurant::query()
            ->whereNotNull('owner_email')
            ->where(function ($query) use ($today, $lastReminderDate) {
                $query->where(function ($trial) use ($today, $lastReminderDate) {
                    $trial->where('status', 'trial')
                        ->whereDate('trial_ends_at', '>', $today->toDateString())
                        ->whereDate('trial_ends_at', '<=', $lastReminderDate->toDateString());
                })->orWhere(function ($active) use ($today, $lastReminderDate) {
                    $active->where('status', 'active')
                        ->whereDate('subscription_ends_at', '>', $today->toDateString())
                        ->whereDate('subscription_ends_at', '<=', $lastReminderDate->toDateString());
                });
            })
            ->with('plan')
            ->chunkById(100, function ($restaurants) use ($timezone, $today, &$sent) {
                foreach ($restaurants as $restaurant) {
                    $type = $restaurant->status === 'trial' ? 'trial_ending' : 'subscription_ending';
                    $expiresAt = Carbon::parse(
                        $type === 'trial_ending' ? $restaurant->trial_ends_at : $restaurant->subscription_ends_at
                    )->timezone($timezone);
                    $targetDate = $expiresAt->toDateString();

                    if (SubscriptionReminderLog::where('restaurant_id', $restaurant->id)
                        ->where('type', $type)
                        ->whereDate('target_date', $targetDate)
                        ->exists()) {
                        continue;
                    }

                    $daysRemaining = (int) max(1, $today->diffInDays($expiresAt->copy()->startOfDay(), false));
                    $this->line("{$restaurant->name}: {$type}, {$daysRemaining} jour(s), {$restaurant->owner_email}");

                    if ($this->option('dry-run')) {
                        continue;
                    }

                    try {
                        Mail::to($restaurant->owner_email)->send(
                            new SubscriptionExpirationReminderMail($restaurant, $type, $expiresAt, $daysRemaining)
                        );

                        SubscriptionReminderLog::create([
                            'restaurant_id' => $restaurant->id,
                            'type' => $type,
                            'target_date' => $targetDate,
                            'recipient' => $restaurant->owner_email,
                            'sent_at' => now(),
                        ]);
                        $sent++;
                    } catch (\Throwable $exception) {
                        Log::error('Subscription expiration reminder failed.', [
                            'restaurant_id' => $restaurant->id,
                            'type' => $type,
                            'error' => $exception->getMessage(),
                        ]);
                    }
                }
            });

        $this->info($this->option('dry-run') ? 'Simulation terminée.' : "{$sent} rappel(s) envoyé(s).");

        return self::SUCCESS;
    }
}
