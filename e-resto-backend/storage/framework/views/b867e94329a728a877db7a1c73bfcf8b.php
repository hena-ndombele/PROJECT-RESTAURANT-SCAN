<!-- resources/views/emails/otp.blade.php -->
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Votre code OTP</title>
    <style>
        /* Reset */
        body, html {
            margin: 0;
            padding: 0;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background-color: #f7f7f7;
            color: #333;
        }
        .container {
            width: 100%;
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .header {
            background-color: #F9A11B; /* Couleur principale du restaurant */
            text-align: center;
        }
        .header img {
            max-width: 150px;
        }
        .content {
            padding: 30px 20px;
            text-align: center;
        }
        .content h2 {
            color: #F9A11B;
            font-size: 24px;
            margin-bottom: 20px;
        }
        .otp-code {
            font-size: 36px;
            font-weight: bold;
            color: #2c3e50;
            margin: 20px 0;
            letter-spacing: 5px;
        }
        .content p {
            font-size: 16px;
            color: #555;
            margin: 10px 0;
        }
        .footer {
            background-color: #f1f1f1;
            text-align: center;
            padding: 20px;
            font-size: 14px;
            color: #888;
        }
        .button {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 25px;
            background-color: #e74c3c;
            color: #fff !important;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
        }
        @media only screen and (max-width: 600px) {
            .otp-code {
                font-size: 28px;
            }
            .content h2 {
                font-size: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header avec logo -->
        <div class="header">
           <img src="cid:logo.png" alt="Restaurant XYZ Logo"  width="130" height="130">
        </div>

        <!-- Contenu principal -->
        <div class="content">
            <h2>Votre code OTP </h2>
            <p>Utilisez ce code pour confirmer votre connexion</p>
            <div class="otp-code"><?php echo e($otp); ?></div>
            <p>Ce code expire dans <strong>10 minutes</strong>. Veuillez ne pas le partager avec quelqu'un d'autre.</p>
            <a href="<?php echo e(url('/')); ?>" class="button">Visitez notre site</a>
        </div>

        <!-- Footer -->
        <div class="footer">
            &copy; <?php echo e(date('Y')); ?> E-resto. Tous droits réservés.<br>
             <a href="mailto:e.resto2025@gmail.com">support@eresto.com</a>
        </div>
    </div>
</body>
</html>
<?php /**PATH C:\xampp\htdocs\PROJECT-E-RESTO\e-resto-backend\resources\views/emails/otp.blade.php ENDPATH**/ ?>