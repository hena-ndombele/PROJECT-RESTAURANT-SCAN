<?php

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter(array_map('trim', explode(',', env(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:4200,http://127.0.0.1:4200,http://localhost:5173,http://127.0.0.1:5173,http://192.168.1.71:4200,http://192.168.1.71:5173,https://restaurascan.com,https://www.restaurascan.com,https://admin.restaurascan.com'
    )))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
