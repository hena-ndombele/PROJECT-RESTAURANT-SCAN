@php
    $restaurantName = $order->restaurant?->name ?? 'Restaurant Scan';
    $trackingCode = $order->tracking_code ?? strtoupper(substr((string) $order->id, 0, 8));
    $currency = $order->currency ?? $order->restaurant?->currency ?? 'CDF';
    $total = number_format((float) ($order->total_amount ?? 0), 2, ',', ' ') . ' ' . $currency;
    $displayTimezone = $order->restaurant?->settings['timezone'] ?? config('app.display_timezone', 'Africa/Kinshasa');
    $orderDate = optional($order->created_at)->copy()->timezone($displayTimezone)->format('d/m/Y H:i');
    $tableName = $order->table?->name;
@endphp

<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Votre reçu</title>
</head>
<body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="max-width:660px;margin:0 auto;padding:28px 14px;">
        <div style="overflow:hidden;background:#ffffff;border-radius:18px;border:1px solid #e5e7eb;box-shadow:0 18px 48px rgba(15,23,42,.08);">
            <div style="background:#111827;padding:26px 28px;color:#ffffff;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                    <tr>
                        <td style="vertical-align:middle;">
                            <img src="{{ $message->embed($logoPath) }}" alt="{{ $restaurantName }}" width="76" height="76" style="display:block;width:76px;height:76px;border-radius:16px;background:#ffffff;object-fit:contain;padding:6px;">
                        </td>
                        <td style="vertical-align:middle;text-align:right;">
                            <div style="font-size:12px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:#f97316;">Reçu de commande</div>
                            <h1 style="margin:8px 0 0;font-size:26px;line-height:1.2;color:#ffffff;">{{ $restaurantName }}</h1>
                        </td>
                    </tr>
                </table>
            </div>

            <div style="padding:28px;">
                <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                    Merci pour votre visite. Votre commande a bien été enregistrée et ce message confirme les informations de suivi.
                </p>

                <div style="margin:20px 0;padding:18px;border-radius:14px;background:#fff7ed;border:1px solid #fed7aa;">
                    <div style="margin:0 0 6px;color:#9a3412;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;">Code de suivi</div>
                    <div style="color:#111827;font-size:28px;font-weight:bold;letter-spacing:.08em;">{{ $trackingCode }}</div>
                </div>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border-collapse:collapse;">
                    <tr>
                        <td style="padding:12px;border:1px solid #e5e7eb;border-radius:10px;color:#6b7280;font-size:13px;">
                            <strong style="display:block;margin-bottom:4px;color:#111827;font-size:15px;">Total</strong>
                            {{ $total }}
                        </td>
                        <td style="width:12px;"></td>
                        <td style="padding:12px;border:1px solid #e5e7eb;border-radius:10px;color:#6b7280;font-size:13px;">
                            <strong style="display:block;margin-bottom:4px;color:#111827;font-size:15px;">Commande</strong>
                            {{ $orderDate ?: 'Date non disponible' }}@if($tableName) · {{ $tableName }}@endif
                        </td>
                    </tr>
                </table>

                @if ($options['receipt'] ?? false)
                    <div style="margin:0 0 18px;padding:14px 16px;border-radius:12px;background:#f9fafb;border:1px solid #e5e7eb;color:#374151;line-height:1.5;">
                        Votre reçu de paiement est joint à cet email au format PDF.
                    </div>
                @endif

                @if (($options['feedback'] ?? false) && $feedbackUrl)
                    <p style="margin:22px 0 10px;color:#111827;font-weight:bold;">Votre avis nous aide à mieux vous servir.</p>
                    <p style="margin:0 0 16px;">
                        <a href="{{ $feedbackUrl }}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;padding:13px 18px;border-radius:10px;font-weight:bold;">
                            Donner mon avis ou revoir le menu
                        </a>
                    </p>
                    <p style="margin:0;color:#6b7280;font-size:12px;word-break:break-all;">{{ $feedbackUrl }}</p>
                @endif

                <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.5;">
                    À bientôt chez {{ $restaurantName }}.
                </p>
            </div>

            <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-align:center;">
                &copy; {{ date('Y') }} {{ $restaurantName }}. Reçu généré automatiquement par Restaurant Scan.
            </div>
        </div>
    </div>
</body>
</html>
