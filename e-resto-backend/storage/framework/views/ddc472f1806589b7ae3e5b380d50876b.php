<?php
    $restaurantName = $reservation->restaurant?->name ?? 'Restaurant Scan';
    $timezone = $reservation->restaurant?->settings['timezone'] ?? config('app.display_timezone', 'Africa/Kinshasa');
    $date = optional($reservation->reservation_date)->timezone($timezone)->format('d/m/Y');
    $time = $reservation->reservation_time ? substr((string) $reservation->reservation_time, 0, 5) : '--:--';
    $tableName = $reservation->table?->name;
    $statusConfig = match ($reservation->status) {
        'confirmed' => [
            'label' => 'Réservation confirmée',
            'color' => '#16a34a',
            'bg' => '#f0fdf4',
            'text' => 'Bonne nouvelle : votre réservation a été confirmée par le restaurant.',
        ],
        'cancelled' => [
            'label' => 'Réservation annulée',
            'color' => '#dc2626',
            'bg' => '#fef2f2',
            'text' => 'Votre réservation a été annulée par le restaurant.',
        ],
        'no_show' => [
            'label' => 'Réservation non honorée',
            'color' => '#b45309',
            'bg' => '#fffbeb',
            'text' => 'Votre réservation a été marquée comme non honorée.',
        ],
        default => [
            'label' => 'Réservation mise à jour',
            'color' => '#f97316',
            'bg' => '#fff7ed',
            'text' => 'Le statut de votre réservation a été mis à jour.',
        ],
    };
?>

<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title><?php echo e($statusConfig['label']); ?></title>
</head>
<body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="max-width:660px;margin:0 auto;padding:28px 14px;">
        <div style="overflow:hidden;background:#ffffff;border-radius:18px;border:1px solid #e5e7eb;box-shadow:0 18px 48px rgba(15,23,42,.08);">
            <div style="background:#111827;padding:26px 28px;color:#ffffff;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                    <tr>
                        <td style="vertical-align:middle;">
                            <img src="<?php echo e($message->embed($logoPath)); ?>" alt="<?php echo e($restaurantName); ?>" width="76" height="76" style="display:block;width:76px;height:76px;border-radius:16px;background:#ffffff;object-fit:contain;padding:6px;">
                        </td>
                        <td style="vertical-align:middle;text-align:right;">
                            <div style="font-size:12px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:#f97316;">Réservation</div>
                            <h1 style="margin:8px 0 0;font-size:26px;line-height:1.2;color:#ffffff;"><?php echo e($restaurantName); ?></h1>
                        </td>
                    </tr>
                </table>
            </div>

            <div style="padding:28px;">
                <div style="margin:0 0 18px;padding:18px;border-radius:14px;background:<?php echo e($statusConfig['bg']); ?>;border:1px solid <?php echo e($statusConfig['color']); ?>33;">
                    <div style="margin:0 0 8px;color:<?php echo e($statusConfig['color']); ?>;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;"><?php echo e($statusConfig['label']); ?></div>
                    <p style="margin:0;color:#111827;font-size:16px;line-height:1.6;"><?php echo e($statusConfig['text']); ?></p>
                </div>

                <p style="margin:0 0 18px;color:#374151;font-size:15px;line-height:1.6;">
                    Bonjour <?php echo e($reservation->name); ?>, voici les détails de votre réservation.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:18px;">
                    <tr>
                        <td style="padding:12px;border:1px solid #e5e7eb;border-radius:10px;color:#6b7280;font-size:13px;">
                            <strong style="display:block;margin-bottom:4px;color:#111827;font-size:15px;">Date</strong>
                            <?php echo e($date ?: 'Date non disponible'); ?>

                        </td>
                        <td style="width:12px;"></td>
                        <td style="padding:12px;border:1px solid #e5e7eb;border-radius:10px;color:#6b7280;font-size:13px;">
                            <strong style="display:block;margin-bottom:4px;color:#111827;font-size:15px;">Heure</strong>
                            <?php echo e($time); ?>

                        </td>
                    </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:18px;">
                    <tr>
                        <td style="padding:12px;border:1px solid #e5e7eb;border-radius:10px;color:#6b7280;font-size:13px;">
                            <strong style="display:block;margin-bottom:4px;color:#111827;font-size:15px;">Personnes</strong>
                            <?php echo e($reservation->guests); ?>

                        </td>
                        <td style="width:12px;"></td>
                        <td style="padding:12px;border:1px solid #e5e7eb;border-radius:10px;color:#6b7280;font-size:13px;">
                            <strong style="display:block;margin-bottom:4px;color:#111827;font-size:15px;">Table</strong>
                            <?php echo e($tableName ?: 'Attribuée par le restaurant'); ?>

                        </td>
                    </tr>
                </table>

                <?php if($reservation->status === 'cancelled' && $reservation->cancellation_reason): ?>
                    <div style="margin:0 0 18px;padding:14px 16px;border-radius:12px;background:#fef2f2;border:1px solid #fecaca;color:#374151;line-height:1.5;">
                        <strong style="display:block;margin-bottom:4px;color:#991b1b;">Motif d'annulation</strong>
                        <?php echo e($reservation->cancellation_reason); ?>

                    </div>
                <?php endif; ?>

                <?php if($reservation->special_requests): ?>
                    <div style="margin:0 0 18px;padding:14px 16px;border-radius:12px;background:#f9fafb;border:1px solid #e5e7eb;color:#374151;line-height:1.5;">
                        <strong style="display:block;margin-bottom:4px;color:#111827;">Demande spéciale</strong>
                        <?php echo e($reservation->special_requests); ?>

                    </div>
                <?php endif; ?>

                <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.5;">
                    À bientôt chez <?php echo e($restaurantName); ?>.
                </p>
            </div>

            <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-align:center;">
                &copy; <?php echo e(date('Y')); ?> <?php echo e($restaurantName); ?>. Email généré automatiquement par Restaurant Scan.
            </div>
        </div>
    </div>
</body>
</html>
<?php /**PATH C:\xampp\htdocs\PROJECT-RESTAURANT-SCAN\e-resto-backend\resources\views/emails/reservation_status.blade.php ENDPATH**/ ?>