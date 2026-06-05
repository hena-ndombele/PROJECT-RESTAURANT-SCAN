<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Code de verification E-RESTO</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;color:#111827;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:28px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px rgba(17,24,39,.08);">
                    <tr>
                        <td style="padding:30px;background:linear-gradient(135deg,#111827,#2b1113);color:#ffffff;text-align:center;">
                            <img src="cid:logo.png" alt="E-RESTO" width="88" height="88" style="display:inline-block;border-radius:18px;margin-bottom:14px;">
                            <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#ffb15c;font-weight:700;">Connexion securisee</div>
                            <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;">Votre code de verification</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:30px;text-align:center;">
                            <p style="margin:0;color:#374151;line-height:1.7;">Utilisez ce code pour confirmer votre connexion a E-RESTO.</p>
                            <div style="display:inline-block;margin:24px 0;padding:18px 26px;border:1px solid #fed7aa;border-radius:14px;background:#fff7ed;color:#111827;font-size:38px;letter-spacing:8px;font-weight:800;">{{ $otp }}</div>
                            <p style="margin:0;color:#6b7280;line-height:1.7;">Ce code expire dans <strong>10 minutes</strong>. Ne le partagez avec personne.</p>
                            <p style="margin:24px 0 0;">
                                <a href="{{ url('/') }}" style="display:inline-block;padding:13px 18px;border-radius:10px;background:#d71920;color:#ffffff;text-decoration:none;font-weight:700;">Ouvrir E-RESTO</a>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:18px 28px;background:#f9fafb;color:#6b7280;font-size:13px;line-height:1.6;text-align:center;">
                            &copy; {{ date('Y') }} E-RESTO. Besoin d'aide ? <a href="mailto:e.resto2025@gmail.com" style="color:#d71920;text-decoration:none;">e.resto2025@gmail.com</a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
