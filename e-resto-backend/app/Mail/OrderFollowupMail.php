<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class OrderFollowupMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Order $order,
        public array $options,
        public ?array $receipt = null,
        public ?string $feedbackUrl = null,
    ) {
    }

    public function build()
    {
        $restaurant = $this->order->restaurant;
        $restaurantName = $restaurant?->name ?? 'Restaurant Scan';
        $logoPath = public_path('assets/logo.png');

        if ($restaurant?->logo && Storage::disk('public')->exists($restaurant->logo)) {
            $logoPath = Storage::disk('public')->path($restaurant->logo);
        }

        $mail = $this->from(config('mail.from.address'), $restaurantName)
            ->subject("Votre reçu - {$restaurantName}")
            ->view('emails.order_followup', [
                'logoPath' => $logoPath,
            ]);

        if ($restaurant?->owner_email && filter_var($restaurant->owner_email, FILTER_VALIDATE_EMAIL)) {
            $mail->replyTo($restaurant->owner_email, $restaurantName);
        }

        if (($this->options['receipt'] ?? false) && $this->receipt) {
            $mail->attachFromStorageDisk('public', $this->receipt['path'], $this->receipt['filename'], [
                'mime' => 'application/pdf',
            ]);
        }

        return $mail;
    }
}
