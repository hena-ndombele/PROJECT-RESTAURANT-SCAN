<?php

namespace App\Mail;

use App\Models\Restaurant;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class PasswordChangedMail extends Mailable
{
    use Queueable, SerializesModels;

    public User $user;
    public ?Restaurant $restaurant;
    public ?string $logoPath;
    public string $primaryColor;
    public string $secondaryColor;

    public function __construct(User $user, ?Restaurant $restaurant = null)
    {
        $this->user = $user;
        $this->restaurant = $restaurant;
        $this->logoPath = $this->logoPath($restaurant);

        $theme = $restaurant?->settings['theme'] ?? [];
        $this->primaryColor = $this->validColor($theme['primary'] ?? $theme['primary_color'] ?? '#ff7a1a', '#ff7a1a');
        $this->secondaryColor = $this->validColor($theme['secondary'] ?? $theme['secondary_color'] ?? '#d71920', '#d71920');
    }

    public function build()
    {
        $restaurantName = $this->restaurant?->name ?: 'Restaurant Scan';

        return $this->subject("Mot de passe modifie - {$restaurantName}")
            ->view('emails.password_changed')
            ->with([
                'user' => $this->user,
                'restaurant' => $this->restaurant,
                'restaurantName' => $restaurantName,
                'logoPath' => $this->logoPath,
                'primaryColor' => $this->primaryColor,
                'secondaryColor' => $this->secondaryColor,
            ]);
    }

    private function logoPath(?Restaurant $restaurant): ?string
    {
        if ($restaurant?->logo && Storage::disk('public')->exists($restaurant->logo)) {
            return Storage::disk('public')->path($restaurant->logo);
        }

        $defaultLogo = public_path('assets/logo.png');
        return is_file($defaultLogo) ? $defaultLogo : null;
    }

    private function validColor(?string $value, string $fallback): string
    {
        $color = trim((string) $value);

        return preg_match('/^#[0-9a-f]{3}([0-9a-f]{3})?$/i', $color) ? $color : $fallback;
    }
}
