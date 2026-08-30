<?php

namespace App\Mail;

use App\Models\NewsletterCampaign;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class NewsletterCampaignMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public NewsletterCampaign $campaign, public string $unsubscribeUrl) {}

    public function build(): self
    {
        $mail = $this->from(config('mail.from.address'), 'Restaurant Scan')
            ->replyTo(config('mail.no_reply.address'), config('mail.no_reply.name'))
            ->subject($this->campaign->subject)
            ->view('emails.newsletter_campaign')
            ->withSymfonyMessage(function ($message) {
                $headers = $message->getHeaders();
                $headers->addTextHeader('Auto-Submitted', 'auto-generated');
                $headers->addTextHeader('X-Auto-Response-Suppress', 'All');
                $headers->addTextHeader('Precedence', 'bulk');
                $headers->addTextHeader('List-Unsubscribe', '<'.$this->unsubscribeUrl.'>');
            });

        if ($this->campaign->image_path && Storage::disk('public')->exists($this->campaign->image_path)) {
            $mail->with(['campaignImagePath' => Storage::disk('public')->path($this->campaign->image_path)]);
        }

        return $mail;
    }
}
