<?php
declare(strict_types=1);

use Brook\Controller\AuthController;
use Brook\Controller\HomeController;

// 'METHOD /path' => [ControllerClass, 'method']
return [
    'GET /' => [HomeController::class, 'index'],
    'GET /login' => [AuthController::class, 'showLogin'],
    'POST /login' => [AuthController::class, 'login'],
    'GET /account' => [AuthController::class, 'account'],
];
