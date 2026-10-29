<?php
declare(strict_types=1);

spl_autoload_register(static function (string $class): void {
    if (str_starts_with($class, 'Brook\\')) {
        $file = __DIR__ . '/' . str_replace('\\', '/', substr($class, strlen('Brook\\'))) . '.php';
        if (is_file($file)) {
            require $file;
        }
    }
});
