<?php

namespace App\Mail;

use App\Models\NewsletterSubscriber;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class NewsletterConfirmationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public NewsletterSubscriber $subscriber, public string $confirmationUrl) {}

    public function build(): self
    {
        return $this->from(config('mail.from.address'), 'Restaurant Scan')
            ->replyTo(config('mail.no_reply.address'), config('mail.no_reply.name'))
            ->subject('Confirmez votre inscription à la newsletter')
            ->view('emails.newsletter_confirmation')
            ->withSymfonyMessage(function ($message) {
                $message->getHeaders()->addTextHeader('Auto-Submitted', 'auto-generated');
                $message->getHeaders()->addTextHeader('X-Auto-Response-Suppress', 'All');
            });
    }
}
