<?php

namespace App\Mail;

use App\Models\ContactMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ContactMessageReceivedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public ContactMessage $contactMessage)
    {
    }

    public function build()
    {
        return $this->subject('[Restaurant Scan] Nouveau contact restaurant')
            ->replyTo($this->contactMessage->email, $this->contactMessage->name)
            ->view('emails.contact_message_received');
    }
}
