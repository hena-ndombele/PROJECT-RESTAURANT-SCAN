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
                        <td style="padding:30px;background:linear-gradient(135deg,#ff7a1a,#d71920);color:#ffffff;">
                            <img src="<?php echo e($message->embed(public_path('assets/logo.png'))); ?>" alt="Restaurant Scan" width="112" height="72" style="display:block;border-radius:12px;margin-bottom:16px;object-fit:contain;background:#ffffff;">
                            <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#fff3d6;font-weight:700;">Compte equipe</div>
                            <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;">Votre acces Restaurant Scan est cree</h1>
                            <p style="margin:12px 0 0;color:#d1d5db;line-height:1.6;">Bonjour <?php echo e($user->first_name); ?> <?php echo e($user->last_name); ?>, un compte vient d'etre ouvert pour vous.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #fed7aa;background:#fff7ed;border-radius:12px;margin-bottom:22px;">
                                <tr>
                                    <td style="padding:18px;color:#111827;line-height:1.8;">
                                        <strong>Email :</strong> <?php echo e($user->email); ?><br>
                                        <strong>Mot de passe temporaire :</strong> <?php echo e($plainPassword); ?>

                                    </td>
                                </tr>
                            </table>

                            <p style="margin:0 0 20px;color:#374151;line-height:1.7;">Pour proteger votre restaurant, changez ce mot de passe lors de votre premiere connexion.</p>
                            <a href="<?php echo e(config('app.frontend_url', config('app.url'))); ?>" style="display:inline-block;padding:14px 20px;border-radius:10px;background:linear-gradient(135deg,#ff7a1a,#d71920);color:#ffffff;text-decoration:none;font-weight:700;">Se connecter</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:18px 28px;background:#f9fafb;color:#6b7280;font-size:13px;line-height:1.6;">
                            &copy; <?php echo e(date('Y')); ?> Restaurant Scan. Cet email confirme la creation de votre acces.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
<?php /**PATH C:\xampp\htdocs\PROJECT-E-RESTO\e-resto-backend\resources\views/emails/account_created.blade.php ENDPATH**/ ?>