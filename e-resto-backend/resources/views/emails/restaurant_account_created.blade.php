<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Bienvenue sur E-RESTO</title>
    <style>
        body { margin: 0; padding: 0; background: #f6f7fb; color: #1f2937; font-family: Arial, sans-serif; }
        .container { max-width: 620px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
        .header { background: #111827; color: #fff; padding: 28px; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 28px; line-height: 1.6; }
        .panel { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 16px; margin: 20px 0; }
        .button { display: inline-block; background: #d71920; color: #fff !important; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 700; }
        .footer { padding: 20px 28px; background: #f3f4f6; color: #6b7280; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Bienvenue sur E-RESTO</h1>
        </div>
        <div class="content">
            <p>Bonjour {{ $user->first_name }} {{ $user->last_name }},</p>
            <p>Votre compte restaurant a ete cree avec succes.</p>

            <div class="panel">
                <strong>Restaurant :</strong> {{ $restaurant->name }}<br>
                <strong>Email de connexion :</strong> {{ $user->email }}<br>
                <strong>Plan :</strong> {{ $restaurant->plan?->name ?? 'Plan E-RESTO' }}<br>
                <strong>Statut :</strong> {{ $restaurant->status }}
            </div>

            @if($restaurant->status === 'trial')
                <p>Votre essai gratuit est actif jusqu'au {{ optional($restaurant->trial_ends_at)->format('d/m/Y') }}.</p>
            @elseif($restaurant->status === 'active')
                <p>Votre espace restaurant est actif. Vous pouvez configurer votre menu, vos tables QR et vos commandes.</p>
            @else
                <p>Finalisez votre abonnement pour activer completement votre espace restaurant.</p>
            @endif

            <p>
                <a class="button" href="{{ config('app.url') }}">Ouvrir E-RESTO</a>
            </p>
        </div>
        <div class="footer">
            &copy; {{ date('Y') }} E-RESTO. Cet email confirme la creation de votre compte.
        </div>
    </div>
</body>
</html>
