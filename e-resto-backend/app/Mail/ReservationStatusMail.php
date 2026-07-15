<?php

namespace App\Mail;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class ReservationStatusMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Reservation $reservation)
    {
    }

    public function build()
    {
        $restaurant = $this->reservation->restaurant;
        $restaurantName = $restaurant?->name ?? 'Restaurant Scan';
        $statusLabel = match ($this->reservation->status) {
            'confirmed' => 'confirmée',
            'cancelled' => 'annulée',
            'no_show' => 'marquée absente',
            default => 'mise à jour',
        };
        $logoPath = public_path('assets/logo.png');

        if ($restaurant?->logo && Storage::disk('public')->exists($restaurant->logo)) {
            $logoPath = Storage::disk('public')->path($restaurant->logo);
        }

        $mail = $this->from(config('mail.from.address'), $restaurantName)
            ->subject("Votre réservation est {$statusLabel} - {$restaurantName}")
            ->view('emails.reservation_status', [
                'logoPath' => $logoPath,
            ]);

        if ($restaurant?->owner_email && filter_var($restaurant->owner_email, FILTER_VALIDATE_EMAIL)) {
            $mail->replyTo($restaurant->owner_email, $restaurantName);
        }

        return $mail;
    }
}
