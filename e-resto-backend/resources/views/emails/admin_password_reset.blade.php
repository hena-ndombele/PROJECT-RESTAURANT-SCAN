<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Mot de passe reinitialise - {{ $restaurantName }}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;color:#111827;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:28px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px rgba(17,24,39,.08);">
                    <tr>
                        <td style="padding:30px;background:{{ $primaryColor }};color:#ffffff;text-align:center;">
                            @if (!empty($logoPath))
                                <img src="{{ $message->embed($logoPath) }}" alt="{{ $restaurantName }}" width="92" height="92" style="display:inline-block;border-radius:18px;margin-bottom:14px;object-fit:contain;background:#ffffff;padding:8px;">
                            @endif
                            <div style="font-size:18px;font-weight:800;line-height:1.2;margin-bottom:6px;">{{ $restaurantName }}</div>
                            <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#fff3d6;font-weight:700;">Compte utilisateur</div>
                            <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;">Mot de passe reinitialise</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:30px;">
                            <p style="margin:0 0 14px;color:#374151;line-height:1.7;">Bonjour {{ trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? '')) ?: 'Utilisateur' }},</p>
                            <p style="margin:0;color:#374151;line-height:1.7;">L'administrateur de {{ $restaurantName }} a reinitialise votre mot de passe.</p>

                            <div style="margin:24px 0;padding:18px;border-radius:14px;background:#f9fafb;border:1px solid #e5e7eb;text-align:center;">
                                <div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;font-weight:700;margin-bottom:8px;">Mot de passe temporaire</div>
                                <div style="display:inline-block;padding:12px 18px;border-radius:12px;background:#111827;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:.08em;">{{ $temporaryPassword }}</div>
                            </div>

                            <div style="margin:24px 0;padding:16px 18px;border:1px solid #fef3c7;border-radius:14px;background:#fffbeb;color:#92400e;line-height:1.6;">
                                Utilisez ce mot de passe pour vous connecter, puis changez-le dans votre profil.
                            </div>
                            <p style="margin:0;color:#6b7280;line-height:1.7;">Par securite, ne partagez pas ce mot de passe avec une personne non autorisee.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:18px 28px;background:#f9fafb;color:#6b7280;font-size:13px;line-height:1.6;text-align:center;">
                            &copy; {{ date('Y') }} {{ $restaurantName }}. Notification automatique de securite.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
