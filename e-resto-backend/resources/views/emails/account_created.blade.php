<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Compte Restaurant Scan cree</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;color:#111827;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:28px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px rgba(17,24,39,.08);">
                    <tr>
                        <td style="padding:30px;background:{{ $primaryColor }};color:#ffffff;">
                            <img src="{{ $message->embed($logoPath) }}" alt="{{ $restaurant?->name ?? 'Restaurant Scan' }}" width="112" height="72" style="display:block;border-radius:12px;margin-bottom:16px;object-fit:contain;background:#ffffff;">
                            <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#fff3d6;font-weight:700;">Compte equipe</div>
                            <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;">Votre acces est cree</h1>
                            <p style="margin:12px 0 0;color:#f9fafb;line-height:1.6;">Bonjour {{ $user->first_name }} {{ $user->last_name }}, {{ $restaurant?->name ?? 'Restaurant Scan' }} vient de vous donner un acces.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid {{ $primaryColor }};background:#fff7ed;border-radius:12px;margin-bottom:22px;">
                                <tr>
                                    <td style="padding:18px;color:#111827;line-height:1.8;">
                                        <strong>Email :</strong> {{ $user->email }}<br>
                                        <strong>Mot de passe temporaire :</strong> {{ $plainPassword }}
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:0 0 20px;color:#374151;line-height:1.7;">Pour proteger votre restaurant, changez ce mot de passe lors de votre premiere connexion.</p>
                            <a href="{{ rtrim(config('app.frontend_url'), '/') }}/restaurant/login" style="display:inline-block;padding:14px 20px;border-radius:10px;background:{{ $primaryColor }};color:#111827;text-decoration:none;font-weight:700;">Se connecter</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:18px 28px;background:#f9fafb;color:#6b7280;font-size:13px;line-height:1.6;">
                            &copy; {{ date('Y') }} {{ $restaurant?->name ?? 'Restaurant Scan' }}. Cet email confirme la création de votre accès.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
