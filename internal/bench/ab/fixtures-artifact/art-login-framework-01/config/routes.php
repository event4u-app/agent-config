<?php
declare(strict_types=1);

use Brook\Controller\HomeController;

// 'METHOD /path' => [ControllerClass, 'method']
return [
    'GET /' => [HomeController::class, 'index'],
];
