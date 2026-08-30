<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>{{ $isTrial ? 'Fin de votre essai gratuit' : 'Expiration de votre abonnement' }}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;color:#111827;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:28px 12px;">
    <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
            <tr><td style="padding:30px;background:linear-gradient(135deg,#ff7a1a,#d71920);color:#fff;">
                <img src="{{ $message->embed($logoPath) }}" alt="{{ $restaurant->name }}" width="112" height="72" style="display:block;margin-bottom:16px;border-radius:10px;object-fit:contain;background:#fff;">
                <div style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#fff3d6;">Restaurant Scan</div>
                <h1 style="margin:10px 0 0;font-size:27px;line-height:1.25;">{{ $isTrial ? 'Votre essai gratuit se termine bientôt' : 'Votre abonnement arrive à expiration' }}</h1>
            </td></tr>
            <tr><td style="padding:28px;color:#374151;line-height:1.7;">
                <p style="margin:0 0 16px;">Bonjour,</p>
                <p style="margin:0 0 18px;">
                    @if($isTrial)
                        L'essai gratuit de <strong>{{ $restaurant->name }}</strong> se terminera dans <strong>{{ $daysRemaining }} jours</strong>, le <strong>{{ $expiresAt->format('d/m/Y') }}</strong>.
                    @else
                        L'abonnement de <strong>{{ $restaurant->name }}</strong> expirera dans <strong>{{ $daysRemaining }} jours</strong>, le <strong>{{ $expiresAt->format('d/m/Y') }}</strong>.
                    @endif
                </p>
                <p style="margin:0 0 24px;color:#6b7280;">Renouvelez votre abonnement avant cette date afin de continuer à utiliser votre menu QR, recevoir les commandes et accéder au dashboard sans interruption.</p>
                <a href="{{ rtrim(config('app.frontend_url', config('app.url')), '/') }}/restaurant/subscription" style="display:inline-block;padding:14px 20px;border-radius:10px;background:linear-gradient(135deg,#ff7a1a,#d71920);color:#fff;text-decoration:none;font-weight:700;">Voir mon abonnement</a>
            </td></tr>
            <tr><td style="padding:18px 28px;background:#f9fafb;color:#6b7280;font-size:13px;">&copy; {{ date('Y') }} Restaurant Scan.</td></tr>
        </table>
    </td></tr>
</table>
</body>
</html>
