<?php
declare(strict_types=1);

namespace Brook\Http;

final class Request
{
    /** @param array<string, string> $post */
    public function __construct(public string $method, public string $path, public array $post)
    {
    }

    public static function fromGlobals(): self
    {
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        return new self($_SERVER['REQUEST_METHOD'] ?? 'GET', $path, array_map('strval', $_POST));
    }

    public function input(string $key): string
    {
        return $this->post[$key] ?? '';
    }
}
