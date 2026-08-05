<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Code de verification <?php echo e($restaurantName); ?></title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;color:#111827;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:28px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px rgba(17,24,39,.08);">
                    <tr>
                        <td style="padding:30px;background:<?php echo e($primaryColor); ?>;color:#ffffff;text-align:center;">
                            <?php if(!empty($logoPath)): ?>
                                <img src="<?php echo e($message->embed($logoPath)); ?>" alt="<?php echo e($restaurantName); ?>" width="92" height="92" style="display:inline-block;border-radius:18px;margin-bottom:14px;object-fit:contain;background:#ffffff;padding:8px;">
                            <?php endif; ?>
                            <div style="font-size:18px;font-weight:800;line-height:1.2;margin-bottom:6px;"><?php echo e($restaurantName); ?></div>
                            <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#fff3d6;font-weight:700;">Connexion securisee</div>
                            <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;">Votre code de verification</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:30px;text-align:center;">
                            <p style="margin:0;color:#374151;line-height:1.7;">Utilisez ce code pour confirmer votre connexion a <?php echo e($restaurantName); ?>.</p>
                            <div style="display:inline-block;margin:24px 0;padding:18px 26px;border:1px solid #fed7aa;border-radius:14px;background:#fff7ed;color:<?php echo e($secondaryColor); ?>;font-size:38px;letter-spacing:8px;font-weight:800;"><?php echo e($otp); ?></div>
                            <p style="margin:0;color:#6b7280;line-height:1.7;">Ce code expire dans <strong>5 minutes</strong>. Ne le partagez avec personne.</p>
                            <p style="margin:24px 0 0;">
                                <a href="<?php echo e(config('app.frontend_url', config('app.url'))); ?>" style="display:inline-block;padding:13px 18px;border-radius:10px;background:<?php echo e($primaryColor); ?>;color:#ffffff;text-decoration:none;font-weight:700;">Ouvrir Restaurant Scan</a>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:18px 28px;background:#f9fafb;color:#6b7280;font-size:13px;line-height:1.6;text-align:center;">
                            &copy; <?php echo e(date('Y')); ?> <?php echo e($restaurantName); ?>. Besoin d'aide ? <a href="mailto:restaurantScan2026@gmail.com" style="color:<?php echo e($secondaryColor); ?>;text-decoration:none;">restaurantScan2026@gmail.com</a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
<?php /**PATH C:\xampp\htdocs\PROJECT-RESTAURANT-SCAN\e-resto-backend\resources\views/emails/otp.blade.php ENDPATH**/ ?>