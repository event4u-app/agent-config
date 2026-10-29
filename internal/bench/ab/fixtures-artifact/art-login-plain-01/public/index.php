<?php
declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if ($path === '/') {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><title>Home</title><h1>Home</h1><p><a href="/login">Sign in</a></p>';
    return;
}

http_response_code(404);
echo 'Not found';
