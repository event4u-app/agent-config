<?php
declare(strict_types=1);

namespace Brook\Controller;

use Brook\Http\Request;
use Brook\Http\Response;

final class HomeController
{
    public function index(Request $request): Response
    {
        return new Response('<!doctype html><title>Home</title><h1>Home</h1><p><a href="/login">Sign in</a></p>');
    }
}
