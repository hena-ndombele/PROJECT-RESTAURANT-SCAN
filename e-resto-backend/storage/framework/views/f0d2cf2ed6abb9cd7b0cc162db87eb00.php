<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title><?php echo e($campaign->subject); ?></title></head>
<body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;background:#f4f6fb;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
<tr><td style="padding:26px 30px;background:linear-gradient(135deg,#ff7a1a,#d71920);color:#fff;"><div style="font-size:12px;font-weight:700;letter-spacing:.15em;">RESTAURANT SCAN</div><h1 style="margin:10px 0 0;font-size:28px;"><?php echo e($campaign->subject); ?></h1></td></tr>
<?php if(!empty($campaignImagePath)): ?><tr><td><img src="<?php echo e($message->embed($campaignImagePath)); ?>" alt="<?php echo e($campaign->title); ?>" style="display:block;width:100%;max-height:380px;object-fit:cover;"></td></tr><?php endif; ?>
<tr><td style="padding:30px;color:#374151;font-size:16px;line-height:1.75;"><?php echo nl2br(e($campaign->content)); ?>

<?php if($campaign->button_text && $campaign->button_url): ?><p style="margin:28px 0 4px;"><a href="<?php echo e($campaign->button_url); ?>" style="display:inline-block;padding:14px 20px;border-radius:10px;background:#ff7417;color:#fff;text-decoration:none;font-weight:700;"><?php echo e($campaign->button_text); ?></a></p><?php endif; ?>
</td></tr>
<tr><td style="padding:18px 30px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.6;">Vous recevez cet e-mail car vous êtes abonné à la newsletter Restaurant Scan.<br><a href="<?php echo e($unsubscribeUrl); ?>" style="color:#d71920;">Se désabonner</a></td></tr>
</table></td></tr></table></body></html>
<?php /**PATH C:\xampp\htdocs\PROJECT-RESTAURANT-SCAN\e-resto-backend\resources\views/emails/newsletter_campaign.blade.php ENDPATH**/ ?>