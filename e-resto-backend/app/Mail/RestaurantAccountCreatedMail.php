<?php

namespace App\Mail;

use App\Models\Restaurant;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class RestaurantAccountCreatedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public Restaurant $restaurant
    ) {
    }

    public function build()
    {
        return $this->subject('Bienvenue sur E-RESTO')
            ->view('emails.restaurant_account_created');
    }
}
