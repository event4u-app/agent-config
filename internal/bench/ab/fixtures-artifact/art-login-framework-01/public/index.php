<?php
declare(strict_types=1);

require __DIR__ . '/../src/autoload.php';

$kernel = new Brook\Kernel(require __DIR__ . '/../config/routes.php');
$kernel->handle(Brook\Http\Request::fromGlobals())->send();
