# Deploiement Restaurant Scan

Domaines utilises dans cette configuration :

- API Laravel : `https://api.restaurascan.com`
- Admin restaurant : `https://admin.restaurascan.com`
- Menu client public : `https://restaurascan.com`

## 1. Backend Laravel

Copier le backend sur le serveur :

```bash
cd /var/www/e-resto-backend
cp .env.production.example .env
nano .env
composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan storage:link
php artisan migrate --force
php artisan l5-swagger:generate
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
```

Variables importantes dans `.env` :

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.restaurascan.com
CLIENT_FRONTEND_URL=https://restaurascan.com
RESTAURANT_ADMIN_URL=https://admin.restaurascan.com
CORS_ALLOWED_ORIGINS=https://restaurascan.com,https://www.restaurascan.com,https://admin.restaurascan.com
BROADCAST_CONNECTION=reverb
REVERB_HOST=api.restaurascan.com
REVERB_PORT=443
REVERB_SCHEME=https
REVERB_SERVER_HOST=0.0.0.0
REVERB_SERVER_PORT=8080
```

## 2. Services Laravel

Creer un service queue :

```ini
[Unit]
Description=Restaurant Scan Laravel Queue
After=network.target

[Service]
User=www-data
Group=www-data
Restart=always
WorkingDirectory=/var/www/e-resto-backend
ExecStart=/usr/bin/php artisan queue:work --sleep=3 --tries=3 --timeout=120

[Install]
WantedBy=multi-user.target
```

Creer un service Reverb :

```ini
[Unit]
Description=Restaurant Scan Reverb
After=network.target

[Service]
User=www-data
Group=www-data
Restart=always
WorkingDirectory=/var/www/e-resto-backend
ExecStart=/usr/bin/php artisan reverb:start --host=0.0.0.0 --port=8080

[Install]
WantedBy=multi-user.target
```

Activer :

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now e-resto-queue
sudo systemctl enable --now e-resto-reverb
```

## 3. Admin restaurant Angular

```bash
cd /var/www/e-resto-admin-restaurant
npm ci
npm run build
```

Le dossier a servir avec Nginx :

```text
/var/www/e-resto-admin-restaurant/dist/inapp/browser
```

## 4. App client React

```bash
cd /var/www/e-resto-client
cp .env.production.example .env.production
npm ci
npm run build
```

Le dossier a servir avec Nginx :

```text
/var/www/e-resto-client/dist
```

## 5. Nginx

Un exemple complet est disponible dans :

```text
nginx/production.conf
```

Apres installation SSL avec Certbot, copier/adaptez ce fichier :

```bash
sudo cp nginx/production.conf /etc/nginx/sites-available/restaurascan
sudo ln -s /etc/nginx/sites-available/restaurascan /etc/nginx/sites-enabled/restaurascan
sudo nginx -t
sudo systemctl reload nginx
```

## 6. Verification

```bash
curl https://api.restaurascan.com/api/saas/plans
curl https://api.restaurascan.com/api/documentation
```

Dans le navigateur :

- `https://admin.restaurascan.com`
- `https://restaurascan.com`
- `https://api.restaurascan.com/api/documentation`

## 7. Apres chaque mise a jour

Backend :

```bash
git pull
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan l5-swagger:generate
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
sudo systemctl restart e-resto-queue e-resto-reverb php8.2-fpm
```

Frontends :

```bash
npm ci
npm run build
sudo systemctl reload nginx
```
