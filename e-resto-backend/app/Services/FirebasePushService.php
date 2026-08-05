<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FirebasePushService
{
    public function sendToUsers(iterable $users, string $title, string $body, array $data = []): void
    {
        $tokens = collect($users)
            ->filter(fn (User $user) => $user->push_notifications_enabled && filled($user->fcm_token))
            ->pluck('fcm_token')
            ->filter()
            ->unique()
            ->values();

        $this->sendToTokens($tokens, $title, $body, $data);
    }

    public function sendToTokens(Collection $tokens, string $title, string $body, array $data = []): void
    {
        if ($tokens->isEmpty()) {
            return;
        }

        $accessToken = $this->accessToken();
        $projectId = $this->projectId();

        if (!$accessToken || !$projectId) {
            Log::warning('Firebase push skipped: missing service account or project id.');
            return;
        }

        foreach ($tokens as $token) {
            try {
                $response = Http::withToken($accessToken)
                    ->acceptJson()
                    ->post("https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send", [
                        'message' => [
                            'token' => $token,
                            'notification' => [
                                'title' => $title,
                                'body' => $body,
                            ],
                            'data' => collect($data)
                                ->mapWithKeys(fn ($value, $key) => [(string) $key => (string) $value])
                                ->all(),
                            'android' => [
                                'priority' => 'HIGH',
                                'notification' => [
                                    'channel_id' => 'restaurant_orders',
                                    'sound' => 'default',
                                ],
                            ],
                        ],
                    ]);

                if ($response->failed()) {
                    Log::warning('Firebase push failed.', [
                        'status' => $response->status(),
                        'body' => $response->body(),
                    ]);
                }
            } catch (\Throwable $exception) {
                Log::warning('Firebase push exception.', [
                    'error' => $exception->getMessage(),
                ]);
            }
        }
    }

    private function accessToken(): ?string
    {
        return Cache::remember('firebase_push_access_token', now()->addMinutes(50), function () {
            $credentials = $this->credentials();
            if (!$credentials) {
                return null;
            }

            $now = time();
            $claim = [
                'iss' => $credentials['client_email'] ?? null,
                'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
                'aud' => 'https://oauth2.googleapis.com/token',
                'iat' => $now,
                'exp' => $now + 3600,
            ];

            if (!$claim['iss'] || empty($credentials['private_key'])) {
                return null;
            }

            $jwt = $this->jwt($claim, $credentials['private_key']);
            if (!$jwt) {
                return null;
            }

            $response = Http::asForm()->post('https://oauth2.googleapis.com/token', [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $jwt,
            ]);

            if ($response->failed()) {
                Log::warning('Firebase OAuth token failed.', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return null;
            }

            return $response->json('access_token');
        });
    }

    private function credentials(): ?array
    {
        $path = (string) config('services.firebase.credentials');

        if (!is_file($path)) {
            return null;
        }

        $credentials = json_decode((string) file_get_contents($path), true);

        return is_array($credentials) ? $credentials : null;
    }

    private function projectId(): ?string
    {
        $configured = config('services.firebase.project_id');
        if ($configured) {
            return (string) $configured;
        }

        return $this->credentials()['project_id'] ?? null;
    }

    private function jwt(array $claim, string $privateKey): ?string
    {
        $header = ['alg' => 'RS256', 'typ' => 'JWT'];
        $payload = $this->base64Url(json_encode($header)) . '.' . $this->base64Url(json_encode($claim));

        if (!openssl_sign($payload, $signature, $privateKey, OPENSSL_ALGO_SHA256)) {
            return null;
        }

        return $payload . '.' . $this->base64Url($signature);
    }

    private function base64Url(string|false $value): string
    {
        return rtrim(strtr(base64_encode((string) $value), '+/', '-_'), '=');
    }
}
