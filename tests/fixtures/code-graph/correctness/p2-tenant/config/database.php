<?php

return [
    'default' => env('DB_CONNECTION', 'mysql'),
    'connections' => [
        'mysql' => [
            'driver' => 'mysql',
        ],
        'tenant' => [
            'driver' => 'pgsql',
        ],
    ],
];
