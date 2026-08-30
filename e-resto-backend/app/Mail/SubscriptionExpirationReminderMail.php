<?php

namespace App\Mail;

use App\Models\Restaurant;
use Carbon\CarbonInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class SubscriptionExpirationReminderMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Restaurant $restaurant,
        public string $reminderType,
        public CarbonInterface $expiresAt,
        public int $daysRemaining,
    ) {
    }

    public function build(): self
    {
        $isTrial = $this->reminderType === 'trial_ending';
        $subject = $isTrial
            ? "Votre essai gratuit se termine dans {$this->daysRemaining} jours"
            : "Votre abonnement expire dans {$this->daysRemaining} jours";
        $logoPath = public_path('assets/logo.png');

        if ($this->restaurant->logo && Storage::disk('public')->exists($this->restaurant->logo)) {
            $logoPath = Storage::disk('public')->path($this->restaurant->logo);
        }

        return $this->from(config('mail.from.address'), 'Restaurant Scan')
            ->subject($subject)
            ->view('emails.subscription_expiration_reminder', [
                'isTrial' => $isTrial,
                'logoPath' => $logoPath,
            ]);
    }
}
