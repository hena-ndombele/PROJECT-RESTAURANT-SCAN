<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class AccountCreatedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public $user, public string $plainPassword)
    {
    }

    public function build()
    {
        $restaurant = $this->user->restaurant;
        $restaurantName = $restaurant?->name ?? 'Restaurant Scan';
        $theme = $restaurant?->settings['theme'] ?? [];
        $primaryColor = $theme['primary'] ?? '#ff7a1a';
        $logoPath = $restaurant?->logo ? storage_path("app/public/{$restaurant->logo}") : public_path('assets/logo.png');
        if (!is_file($logoPath)) {
            $logoPath = public_path('assets/logo.png');
        }

        $mail = $this->from(config('mail.from.address'), $restaurantName)
            ->subject("Votre accès - {$restaurantName}")
            ->view('emails.account_created', [
                'restaurant' => $restaurant,
                'primaryColor' => $primaryColor,
                'logoPath' => $logoPath,
            ]);

        if ($restaurant?->owner_email && filter_var($restaurant->owner_email, FILTER_VALIDATE_EMAIL)) {
            $mail->replyTo($restaurant->owner_email, $restaurantName);
        }

        return $mail;
    }
}
