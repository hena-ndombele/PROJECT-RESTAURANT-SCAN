<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class WelcomeAgentNotification extends Notification
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
   protected $password;

    public function __construct($password)
    {
        $this->password = $password;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
   public function toMail($notifiable)
    {
        return (new MailMessage)
            ->subject('Bienvenue dans l\'équipe - Vos accès Restaurant Scan')
            ->greeting('Bonjour ' . $notifiable->name . ' !')
            ->line('Votre compte agent a été créé avec succès.')
            ->line('Voici vos identifiants de connexion :')
            ->line('**Email :** ' . $notifiable->email)
            ->line('**Mot de passe provisoire :** ' . $this->password)
            ->action('Se connecter au menu', url('/login'))
            ->line('Par mesure de sécurité, nous vous conseillons de changer ce mot de passe dès votre première connexion.');
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            //
        ];
    }
}
