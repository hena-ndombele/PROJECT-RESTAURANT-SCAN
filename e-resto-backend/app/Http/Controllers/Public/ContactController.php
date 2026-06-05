<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Mail\ContactMessageReceivedMail;
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
                Mail::to($recipient)->send(new ContactMessageReceivedMail($message));
            } catch (\Throwable $mailError) {
                Log::warning('Email contact landing non envoye.', [
                    'contact_message_id' => $message->id,
                    'email' => $message->email,
                    'error' => $mailError->getMessage(),
                ]);
            }
        });

        return response()->json([
            'message' => 'Message envoye avec succes',
            'data' => $message,
        ], 201);
    }
}
