<?php

namespace App\Services;

use App\Models\Payment;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class MaishaPayService
{
    public function collectMobileMoney(Payment $payment, array $customer, string $provider, string $walletId, string $callbackUrl): array
    {
        $transactionReference = $payment->reference ?: 'SUB-' . Str::upper(Str::random(10));

        $payload = [
            'transactionReference' => $transactionReference,
            'gatewayMode' => config('services.maishapay.gateway_mode', '1'),
            'publicApiKey' => config('services.maishapay.public_key'),
            'secretApiKey' => config('services.maishapay.secret_key'),
            'order' => [
                'amount' => (string) $payment->amount,
                'currency' => $payment->currency,
                'customerFullName' => $customer['name'],
                'customerEmailAdress' => $customer['email'],
            ],
            'paymentChannel' => [
                'channel' => 'MOBILEMONEY',
                'provider' => Str::upper($provider),
                'walletID' => $walletId,
                'callbackUrl' => $callbackUrl,
            ],
        ];

        Validator::make($payload, [
            'publicApiKey' => 'required|string',
            'secretApiKey' => 'required|string',
        ], [
            'publicApiKey.required' => 'La cle publique MaishaPay est manquante.',
            'secretApiKey.required' => 'La cle secrete MaishaPay est manquante.',
        ])->validate();

        if (filter_var(config('services.maishapay.mock'), FILTER_VALIDATE_BOOLEAN)) {
            return [
                'status_code' => 200,
                'transactionStatus' => 'SUCCESS',
                'transactionId' => random_int(100000, 999999),
                'originatingTransactionId' => $transactionReference,
                'mock' => true,
                'order' => [
                    'customerFullName' => $customer['name'],
                    'customerPhoneNumber' => $walletId,
                    'customerEmailAdress' => $customer['email'],
                    'cost' => [
                        'amount' => (float) $payment->amount,
                        'frais' => round(((float) $payment->amount) * 0.04, 2),
                        'total' => round(((float) $payment->amount) * 1.04, 2),
                        'currency' => $payment->currency,
                    ],
                ],
                'paymentChannel' => [
                    'channel' => 'MOBILEMONEY',
                    'provider' => [
                        'libelle' => Str::upper($provider),
                        'picture' => 'service-logos/' . Str::lower($provider) . '.png',
                    ],
                    'walletID' => $walletId,
                ],
                'created_at' => now()->format('d-m-Y H:i'),
                'updated_at' => now()->format('d-m-Y H:i'),
            ];
        }

        $baseUrl = rtrim(config('services.maishapay.base_url'), '/');

        return Http::acceptJson()
            ->asJson()
            ->timeout(30)
            ->post("{$baseUrl}/api/collect/v2/store/mobileMoney", $payload)
            ->json() ?? [
                'status_code' => 502,
                'transactionStatus' => 'FAILED',
                'message' => 'Reponse MaishaPay vide ou invalide.',
            ];
    }
}
