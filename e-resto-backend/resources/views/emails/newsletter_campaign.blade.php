<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>{{ $campaign->subject }}</title></head>
<body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;background:#f4f6fb;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
<tr><td style="padding:26px 30px;background:linear-gradient(135deg,#ff7a1a,#d71920);color:#fff;"><div style="font-size:12px;font-weight:700;letter-spacing:.15em;">RESTAURANT SCAN</div><h1 style="margin:10px 0 0;font-size:28px;">{{ $campaign->subject }}</h1></td></tr>
@if(!empty($campaignImagePath))<tr><td><img src="{{ $message->embed($campaignImagePath) }}" alt="{{ $campaign->title }}" style="display:block;width:100%;max-height:380px;object-fit:cover;"></td></tr>@endif
<tr><td style="padding:30px;color:#374151;font-size:16px;line-height:1.75;">{!! nl2br(e($campaign->content)) !!}
@if($campaign->button_text && $campaign->button_url)<p style="margin:28px 0 4px;"><a href="{{ $campaign->button_url }}" style="display:inline-block;padding:14px 20px;border-radius:10px;background:#ff7417;color:#fff;text-decoration:none;font-weight:700;">{{ $campaign->button_text }}</a></p>@endif
</td></tr>
<tr><td align="center" style="padding:22px 30px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.6;">
    <p style="margin:0 0 8px;">Vous recevez cet e-mail car vous êtes abonné à la newsletter Restaurant Scan.</p>
    <p style="margin:0 0 14px;">Ceci est un message automatique. Merci de ne pas répondre à cet e-mail.</p>
    <a href="{{ $unsubscribeUrl }}" style="display:inline-block;padding:10px 16px;border:1px solid #d71920;border-radius:8px;color:#d71920;background:#ffffff;text-decoration:none;font-weight:700;">Se désabonner</a>
</td></tr>
</table></td></tr></table></body></html>
