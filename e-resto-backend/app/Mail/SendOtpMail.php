<?php
namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class SendOtpMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $otp;

    public function __construct(string $otp)
    {
        $this->otp = $otp;
    }

    public function build()
    {
        return $this->subject('Code de verification E-RESTO')
                    ->view('emails.otp')
                    ->with(['otp' => $this->otp])
                    ->attach(public_path('assets/logo.png'), [
                        'as' => 'logo.png',
                        'mime' => 'image/png',
                    ]);
    }
}
