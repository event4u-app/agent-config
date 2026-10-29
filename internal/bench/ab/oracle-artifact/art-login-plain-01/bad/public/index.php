<?php
session_start();

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$users = json_decode(file_get_contents(__DIR__ . '/../data/users.json'), true);

if ($path === '/login' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    echo '<form method="post" action="/login"><input name="email"><input name="password" type="password"><button>Go</button></form>';
    return;
}

if ($path === '/login') {
    $email = $_POST['email'] ?? '';
    if (!isset($users[$email])) {
        http_response_code(404);
        echo 'No account for ' . $email;
        return;
    }
    if ($users[$email] !== ($_POST['password'] ?? '')) {
        http_response_code(401);
        echo 'Wrong password';
        return;
    }
    $_SESSION['user'] = $email;
    header('Location: /account');
    return;
}

if ($path === '/account') {
    if (!isset($_SESSION['user'])) {
        header('Location: /login');
        return;
    }
    echo 'Signed in as ' . $_SESSION['user'];
    return;
}

echo '<h1>Home</h1>';
