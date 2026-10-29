<?php
declare(strict_types=1);

const DATA_DIR = __DIR__ . '/../data';

header('Content-Type: application/json');

function respond(int $status, mixed $body = null): void
{
    http_response_code($status);
    if ($body !== null) {
        echo json_encode($body);
    }
}

function caller(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(\S+)$/', $header, $m)) {
        return null;
    }
    $tokens = json_decode((string) file_get_contents(DATA_DIR . '/tokens.json'), true) ?: [];
    return isset($tokens[$m[1]]) ? (string) $tokens[$m[1]] : null;
}

/** @return array<int, array{id:int,title:string,done:bool,owner:string}> */
function load_items(): array
{
    $file = DATA_DIR . '/items.json';
    return is_file($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : [];
}

function save_items(array $items): void
{
    file_put_contents(DATA_DIR . '/items.json', json_encode($items), LOCK_EX);
}

/** @return array<string, string> field => message; empty when valid */
function validate(array $input, bool $partial): array
{
    $errors = [];
    if (!$partial || array_key_exists('title', $input)) {
        $title = $input['title'] ?? null;
        if (!is_string($title) || trim($title) === '' || mb_strlen($title) > 120) {
            $errors['title'] = 'title must be a string of 1-120 characters';
        }
    }
    if (array_key_exists('done', $input) && !is_bool($input['done'])) {
        $errors['done'] = 'done must be a boolean';
    }
    return $errors;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($path === '/health') {
    respond(200, ['ok' => true]);
    return;
}

if (!preg_match('#^/items(?:/(\d+))?$#', $path, $route)) {
    respond(404, ['error' => 'not found']);
    return;
}

$user = caller();
if ($user === null) {
    respond(401, ['error' => 'unauthenticated']);
    return;
}

$input = json_decode((string) file_get_contents('php://input'), true);
$input = is_array($input) ? $input : [];
$items = load_items();
$id = isset($route[1]) ? (int) $route[1] : null;

if ($id === null && $method === 'GET') {
    respond(200, array_values(array_filter($items, fn (array $i): bool => $i['owner'] === $user)));
    return;
}

if ($id === null && $method === 'POST') {
    $errors = validate($input, false);
    if ($errors !== []) {
        respond(422, ['errors' => $errors]);
        return;
    }
    $next = $items === [] ? 1 : max(array_keys($items)) + 1;
    $items[$next] = ['id' => $next, 'title' => $input['title'], 'done' => $input['done'] ?? false, 'owner' => $user];
    save_items($items);
    respond(201, $items[$next]);
    return;
}

if ($id === null) {
    respond(405, ['error' => 'method not allowed']);
    return;
}

// Another user's item is reported exactly like a missing one: existence stays hidden.
$item = $items[$id] ?? null;
if ($item === null || $item['owner'] !== $user) {
    respond(404, ['error' => 'not found']);
    return;
}

if ($method === 'GET') {
    respond(200, $item);
    return;
}

if ($method === 'PATCH') {
    $errors = validate($input, true);
    if ($errors !== []) {
        respond(422, ['errors' => $errors]);
        return;
    }
    $items[$id] = array_merge($item, array_intersect_key($input, ['title' => 1, 'done' => 1]));
    save_items($items);
    respond(200, $items[$id]);
    return;
}

if ($method === 'DELETE') {
    unset($items[$id]);
    save_items($items);
    respond(204);
    return;
}

respond(405, ['error' => 'method not allowed']);
