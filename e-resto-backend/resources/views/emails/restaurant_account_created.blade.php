<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Bienvenue sur E-RESTO</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;color:#111827;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:28px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px rgba(17,24,39,.08);">
                    <tr>
                        <td style="padding:32px;background:linear-gradient(135deg,#111827,#2b1113);color:#ffffff;">
                            <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#ffb15c;font-weight:700;">Bienvenue sur E-RESTO</div>
                            <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">Votre espace restaurant est pret</h1>
                            <p style="margin:12px 0 0;color:#e5e7eb;line-height:1.6;">Bonjour {{ $user->first_name }} {{ $user->last_name }}, votre compte a ete cree avec succes.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #fed7aa;background:#fff7ed;border-radius:12px;margin-bottom:22px;">
                                <tr>
                                    <td style="padding:18px;color:#111827;line-height:1.8;">
                                        <strong>Restaurant :</strong> {{ $restaurant->name }}<br>
                                        <strong>Email de connexion :</strong> {{ $user->email }}<br>
                                        <strong>Plan :</strong> {{ $restaurant->plan?->name ?? 'Plan E-RESTO' }}<br>
                                        <strong>Statut :</strong> {{ $restaurant->status }}
                                    </td>
                                </tr>
                            </table>

                            @if($restaurant->status === 'trial')
                                <p style="margin:0 0 18px;color:#374151;line-height:1.7;">Votre essai gratuit est actif jusqu'au <strong>{{ optional($restaurant->trial_ends_at)->format('d/m/Y') }}</strong>. Vous pouvez deja configurer le menu, les tables QR et votre equipe.</p>
                            @elseif($restaurant->status === 'active')
                                <p style="margin:0 0 18px;color:#374151;line-height:1.7;">Votre espace restaurant est actif. Vous pouvez configurer votre menu, vos tables QR et suivre vos commandes en temps reel.</p>
                            @else
                                <p style="margin:0 0 18px;color:#374151;line-height:1.7;">Finalisez votre abonnement pour activer completement votre espace restaurant.</p>
                            @endif

                            <p style="margin:0 0 22px;color:#6b7280;line-height:1.7;">Gardez cet email : il confirme la creation de votre compte et l'adresse a utiliser pour vous connecter.</p>

                            <a href="{{ config('app.url') }}" style="display:inline-block;padding:14px 20px;border-radius:10px;background:#d71920;color:#ffffff;text-decoration:none;font-weight:700;">Ouvrir E-RESTO</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:18px 28px;background:#f9fafb;color:#6b7280;font-size:13px;line-height:1.6;">
                            &copy; {{ date('Y') }} E-RESTO. Menu QR, commandes, paiements et rapports pour restaurants.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
