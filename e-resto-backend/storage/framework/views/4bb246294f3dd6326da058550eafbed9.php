<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Nouveau contact restaurant</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;color:#111827;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:28px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px rgba(17,24,39,.08);">
                    <tr>
                        <td style="padding:30px;background:linear-gradient(135deg,#ff7a1a,#d71920);color:#ffffff;">
                            <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#fff3d6;font-weight:700;">Restaurant Scan Support</div>
                            <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;">Nouveau message restaurant</h1>
                            <p style="margin:10px 0 0;color:#d1d5db;line-height:1.6;">Un visiteur vient d'envoyer une demande depuis la landing SaaS.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #fed7aa;background:#fff7ed;border-radius:12px;margin-bottom:22px;">
                                <tr>
                                    <td style="padding:18px;">
                                        <p style="margin:0 0 8px;color:#9a3412;font-size:12px;text-transform:uppercase;font-weight:700;">Coordonnees</p>
                                        <p style="margin:0;color:#111827;line-height:1.7;">
                                            <strong>Nom :</strong> <?php echo e($contactMessage->name); ?><br>
                                            <strong>Email :</strong> <?php echo e($contactMessage->email); ?><br>
                                            <strong>Telephone :</strong> <?php echo e($contactMessage->phone ?: '-'); ?><br>
                                            <strong>Sujet :</strong> <?php echo e($contactMessage->subject); ?>

                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;font-weight:700;">Message</p>
                            <div style="padding:18px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;color:#1f2937;line-height:1.7;white-space:pre-line;"><?php echo e($contactMessage->message); ?></div>

                            <p style="margin:24px 0 0;">
                                <a href="mailto:<?php echo e($contactMessage->email); ?>" style="display:inline-block;padding:13px 18px;border-radius:10px;background:linear-gradient(135deg,#ff7a1a,#d71920);color:#ffffff;text-decoration:none;font-weight:700;">Repondre au client</a>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:18px 28px;background:#f9fafb;color:#6b7280;font-size:13px;line-height:1.6;">
                            &copy; <?php echo e(date('Y')); ?> Restaurant Scan. Message conserve dans le tableau de support plateforme.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
<?php /**PATH C:\xampp\htdocs\PROJECT-E-RESTO\e-resto-backend\resources\views/emails/contact_message_received.blade.php ENDPATH**/ ?>