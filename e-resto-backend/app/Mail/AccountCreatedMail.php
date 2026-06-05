<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class AccountCreatedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public $user)
    {
    }

    public function build()
    {
        return $this->subject('Compte cree avec succes')
            ->view('emails.account_created');
    }
}
