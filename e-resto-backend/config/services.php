<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'maishapay' => [
        'base_url' => env('MAISHAPAY_BASE_URL', 'https://marchand.maishapay.online'),
        'public_key' => env('MAISHAPAY_PUBLIC_KEY'),
        'secret_key' => env('MAISHAPAY_SECRET_KEY'),
        'gateway_mode' => env('MAISHAPAY_GATEWAY_MODE', '1'),
        'callback_url' => env('MAISHAPAY_CALLBACK_URL'),
        'mock' => env('MAISHAPAY_MOCK', false),
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
    ],

    'firebase' => [
        'credentials' => env('FIREBASE_CREDENTIALS', storage_path('app/firebase-service-account.json')),
        'project_id' => env('FIREBASE_PROJECT_ID'),
    ],

];
