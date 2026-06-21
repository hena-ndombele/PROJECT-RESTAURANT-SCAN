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
        $theme = $restaurant?->settings['theme'] ?? [];
        $primaryColor = $theme['primary'] ?? '#ff7a1a';
        $logoPath = $restaurant?->logo ? storage_path("app/public/{$restaurant->logo}") : public_path('assets/logo.png');
        if (!is_file($logoPath)) {
            $logoPath = public_path('assets/logo.png');
        }

        return $this->subject('Compte cree avec succes')
            ->view('emails.account_created', [
                'restaurant' => $restaurant,
                'primaryColor' => $primaryColor,
                'logoPath' => $logoPath,
            ]);
    }
}
