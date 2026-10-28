<?php
declare(strict_types=1);

namespace Brook\Controller;

use Brook\Auth\Throttle;
use Brook\Auth\UserStore;
use Brook\Http\Request;
use Brook\Http\Response;
use Brook\Security\Csrf;
use Brook\Security\Session;

final class AuthController
{
    private const DATA_DIR = __DIR__ . '/../../data';

    public function showLogin(Request $request): Response
    {
        Session::start();
        return new Response($this->form());
    }

    public function login(Request $request): Response
    {
        Session::start();
        if (!Csrf::valid($request->input('_token'))) {
            return new Response($this->form('Your session expired. Please try again.'), 419);
        }
        $email = strtolower(trim($request->input('email')));
        $throttle = new Throttle(self::DATA_DIR);
        if ($throttle->blocked($email)) {
            return new Response($this->form('Too many attempts. Try again later.'), 429);
        }
        if (!(new UserStore(self::DATA_DIR))->verify($email, $request->input('password'))) {
            $throttle->fail($email);
            return new Response($this->form('Invalid credentials.'), 401);
        }
        Session::rotate();
        unset($_SESSION['_token']);
        $_SESSION['user'] = $email;
        return Response::redirect('/account');
    }

    public function account(Request $request): Response
    {
        Session::start();
        if (!isset($_SESSION['user'])) {
            return Response::redirect('/login');
        }
        return new Response('<!doctype html><title>Account</title><p>Signed in as ' . htmlspecialchars((string) $_SESSION['user']) . '</p>');
    }

    private function form(string $message = ''): string
    {
        $token = htmlspecialchars(Csrf::token(), ENT_QUOTES);
        $note = $message === '' ? '' : '<p role="alert">' . htmlspecialchars($message) . '</p>';
        return '<!doctype html><title>Sign in</title><h1>Sign in</h1>' . $note
            . '<form method="post" action="/login">'
            . '<input type="hidden" name="_token" value="' . $token . '">'
            . '<label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username">'
            . '<label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password">'
            . '<button type="submit">Sign in</button></form>';
    }
}
