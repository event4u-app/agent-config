<?php
header('Content-Type: application/json');

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$file = __DIR__ . '/../data/items.json';
$items = is_file($file) ? json_decode(file_get_contents($file), true) : [];
$input = json_decode(file_get_contents('php://input'), true) ?: [];

if ($path === '/items' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(array_values($items));
    return;
}

if ($path === '/items' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $id = count($items) + 1;
    $items[$id] = ['id' => $id, 'title' => $input['title'] ?? '', 'done' => $input['done'] ?? false, 'owner' => 'unknown'];
    file_put_contents($file, json_encode($items));
    http_response_code(201);
    echo json_encode($items[$id]);
    return;
}

if (preg_match('#^/items/(\d+)$#', $path, $m)) {
    $id = (int) $m[1];
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        unset($items[$id]);
        file_put_contents($file, json_encode($items));
        http_response_code(204);
        return;
    }
    if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
        $items[$id] = array_merge($items[$id], $input);
    }
    file_put_contents($file, json_encode($items));
    echo json_encode($items[$id] ?? null);
    return;
}

http_response_code(404);
echo json_encode(['error' => 'not found']);
