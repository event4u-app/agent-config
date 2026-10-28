<?php
declare(strict_types=1);

const DATA_DIR = __DIR__ . '/../data';
const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 900;

ini_set('session.use_strict_mode', '1');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
session_start();

function users(): array
{
    $file = DATA_DIR . '/users.json';
    if (!is_file($file)) {
        // Seeded on first run; only the hash is written to disk.
        $seed = ['demo@example.test' => password_hash('changeme-bench', PASSWORD_DEFAULT)];
        file_put_contents($file, json_encode($seed), LOCK_EX);
    }
    return json_decode((string) file_get_contents($file), true) ?: [];
}

function attempts(): array
{
    $file = DATA_DIR . '/attempts.json';
    return is_file($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : [];
}

function record_failure(string $key): void
{
    $all = attempts();
    $all[$key][] = time();
    file_put_contents(DATA_DIR . '/attempts.json', json_encode($all), LOCK_EX);
}

function throttled(string $key): bool
{
    $recent = array_filter(attempts()[$key] ?? [], fn (int $t): bool => $t > time() - WINDOW_SECONDS);
    return count($recent) >= MAX_ATTEMPTS;
}

function csrf_token(): string
{
    if (empty($_SESSION['_token'])) {
        $_SESSION['_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['_token'];
}

function login_form(string $message = ''): string
{
    $token = htmlspecialchars(csrf_token(), ENT_QUOTES);
    $note = $message === '' ? '' : '<p role="alert">' . htmlspecialchars($message) . '</p>';
    return '<!doctype html><title>Sign in</title><h1>Sign in</h1>' . $note
        . '<form method="post" action="/login">'
        . '<input type="hidden" name="_token" value="' . $token . '">'
        . '<label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username">'
        . '<label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password">'
        . '<button type="submit">Sign in</button></form>';
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
header('Content-Type: text/html; charset=utf-8');

if ($path === '/') {
    echo '<!doctype html><title>Home</title><h1>Home</h1><p><a href="/login">Sign in</a></p>';
    return;
}

if ($path === '/login' && $method === 'GET') {
    echo login_form();
    return;
}

if ($path === '/login' && $method === 'POST') {
    $sent = (string) ($_POST['_token'] ?? '');
    if (!hash_equals(csrf_token(), $sent)) {
        http_response_code(419);
        echo login_form('Your session expired. Please try again.');
        return;
    }
    $email = strtolower(trim((string) ($_POST['email'] ?? '')));
    $password = (string) ($_POST['password'] ?? '');
    $key = hash('sha256', $email);
    if (throttled($key)) {
        http_response_code(429);
        echo login_form('Too many attempts. Try again later.');
        return;
    }
    $users = users();
    // Verify against a dummy hash for unknown emails so both paths cost the same.
    $hash = $users[$email] ?? password_hash('dummy-' . bin2hex(random_bytes(8)), PASSWORD_DEFAULT);
    if (isset($users[$email]) && password_verify($password, $hash)) {
        session_regenerate_id(true);
        unset($_SESSION['_token']);
        $_SESSION['user'] = $email;
        header('Location: /account', true, 302);
        return;
    }
    password_verify($password, $hash);
    record_failure($key);
    http_response_code(401);
    echo login_form('Invalid credentials.');
    return;
}

if ($path === '/account') {
    if (!isset($_SESSION['user'])) {
        header('Location: /login', true, 302);
        return;
    }
    echo '<!doctype html><title>Account</title><p>Signed in as ' . htmlspecialchars((string) $_SESSION['user']) . '</p>';
    return;
}

http_response_code(404);
echo 'Not found';
