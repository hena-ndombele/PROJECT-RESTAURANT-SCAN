<?php

namespace App\Services;

use App\Models\Payment;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Throwable;

class MaishaPayService
{
    public function walletBalance(string $currency, string $wallet = 'Transfert'): array
    {
        $payload = [
            'gatewayMode' => (int) config('services.maishapay.gateway_mode', '1'),
            'publicApiKey' => config('services.maishapay.public_key'),
            'secretApiKey' => config('services.maishapay.secret_key'),
            'wallet' => $wallet,
            'currency' => Str::upper($currency),
        ];

        Validator::make($payload, [
            'publicApiKey' => 'required|string',
            'secretApiKey' => 'required|string',
            'wallet' => 'required|string',
            'currency' => 'required|string|in:CDF,USD',
        ], [
            'publicApiKey.required' => 'La cle publique MaishaPay est manquante.',
            'secretApiKey.required' => 'La cle secrete MaishaPay est manquante.',
        ])->validate();

        if (filter_var(config('services.maishapay.mock'), FILTER_VALIDATE_BOOLEAN)) {
            return [
                'wallet' => $wallet,
                'currency' => Str::upper($currency),
                'balance' => Str::upper($currency) === 'CDF' ? 0 : 0,
                'status' => 'mock',
                'updated_at' => now()->toIso8601String(),
            ];
        }

        $baseUrl = rtrim(config('services.maishapay.base_url'), '/');
        $response = Http::acceptJson()
            ->asJson()
            ->timeout(30)
            ->post("{$baseUrl}/wallet/balance/report", $payload);

        $data = $response->json() ?? [];

        return [
            'wallet' => $wallet,
            'currency' => Str::upper($currency),
            'balance' => $this->extractBalanceAmount($data),
            'status' => $response->successful() ? 'available' : 'unavailable',
            'raw' => $data,
            'updated_at' => now()->toIso8601String(),
        ];
    }

    public function collectMobileMoney(Payment $payment, array $customer, string $provider, string $walletId, string $callbackUrl): array
    {
        $transactionReference = $payment->reference ?: 'SUB-' . Str::upper(Str::random(10));

        $payload = [
            'transactionReference' => $transactionReference,
            'gatewayMode' => (int) config('services.maishapay.gateway_mode', '1'),
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
                'gateway_success' => true,
                'transactionStatus' => 'SUCCESS',
                'mock' => true,
                'message' => 'Paiement abonnement simule avec succes.',
                'transactionReference' => $transactionReference,
            ];
        }

        $baseUrl = rtrim(config('services.maishapay.base_url'), '/');

        try {
            $response = Http::acceptJson()
                ->asJson()
                ->timeout(45)
                ->post("{$baseUrl}/api/collect/v2/store/mobileMoney", $payload);
        } catch (Throwable $error) {
            return [
                'status_code' => 503,
                'transactionStatus' => 'FAILED',
                'message' => 'Paiement echoue. Verifiez le numero puis reessayez.',
            ];
        }

        $data = $response->json();

        if (!is_array($data)) {
            return [
                'status_code' => $response->status(),
                'transactionStatus' => 'FAILED',
                'message' => 'Reponse MaishaPay vide ou invalide.',
            ];
        }

        return [
            'status_code' => $response->status(),
            'gateway_success' => $response->successful(),
            ...$data,
        ] ?: [
            'status_code' => 502,
            'transactionStatus' => 'FAILED',
            'message' => 'Reponse MaishaPay vide ou invalide.',
            ];
    }

    private function extractBalanceAmount(array $data): float
    {
        $candidates = [
            $data['balance'] ?? null,
            $data['solde'] ?? null,
            $data['amount'] ?? null,
            $data['data']['balance'] ?? null,
            $data['data']['solde'] ?? null,
            $data['data']['amount'] ?? null,
            $data['wallet']['balance'] ?? null,
            $data['wallet']['solde'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (is_numeric($candidate)) {
                return (float) $candidate;
            }
        }

        return 0;
    }
}
