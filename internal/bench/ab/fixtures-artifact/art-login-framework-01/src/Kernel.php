<?php
declare(strict_types=1);

namespace Brook;

use Brook\Http\Request;
use Brook\Http\Response;

final class Kernel
{
    /** @param array<string, array{0: class-string, 1: string}> $routes */
    public function __construct(private array $routes)
    {
    }

    public function handle(Request $request): Response
    {
        $route = $this->routes[$request->method . ' ' . $request->path] ?? null;
        if ($route === null) {
            return new Response('Not found', 404);
        }
        [$class, $method] = $route;
        return (new $class())->$method($request);
    }
}
