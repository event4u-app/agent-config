<?php

return [
    'default' => env('DB_CONNECTION', 'pgsql'),
    'connections' => [
        'pgsql' => [
            'driver' => 'pgsql',
            'database' => env('DB_DATABASE', 'forge'),
        ],
        'tenant' => [
            'driver' => 'pgsql',
            'database' => env('TENANT_DATABASE', 'tenant'),
        ],
    ],
];
