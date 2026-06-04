<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ContactController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'email' => 'required|email|max:190',
            'phone' => 'nullable|string|max:30',
            'subject' => 'required|string|max:150',
            'message' => 'required|string|max:3000',
        ]);

        $message = ContactMessage::create($validated);

        app()->terminating(function () use ($message) {
            try {
                $recipient = config('mail.from.address') ?: 'e.resto2025@gmail.com';
                $body = implode("\n", [
                    'Nouveau message depuis la landing SaaS E-RESTO',
                    '',
                    'Nom : ' . $message->name,
                    'Email : ' . $message->email,
                    'Telephone : ' . ($message->phone ?: '-'),
                    'Sujet : ' . $message->subject,
                    '',
                    'Message :',
                    $message->message,
                ]);

                Mail::raw($body, function ($mail) use ($message, $recipient) {
                    $mail->to($recipient)
                        ->replyTo($message->email, $message->name)
                        ->subject('[E-RESTO] Nouveau contact restaurant');
                });
            } catch (\Throwable $mailError) {
                Log::warning('Email contact landing non envoye.', [
                    'contact_message_id' => $message->id,
                    'email' => $message->email,
                    'error' => $mailError->getMessage(),
                ]);
            }
        });

        return response()->json([
            'message' => 'Message envoyee avec succes',
            'data' => $message,
        ], 201);
    }
}
