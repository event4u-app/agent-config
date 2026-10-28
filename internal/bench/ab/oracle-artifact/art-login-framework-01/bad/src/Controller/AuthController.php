<?php
declare(strict_types=1);

namespace Brook\Controller;

use Brook\Http\Request;
use Brook\Http\Response;

final class AuthController
{
    public function showLogin(Request $request): Response
    {
        return new Response('<form method="post" action="/login"><input name="email"><input name="password" type="password"><button>Go</button></form>');
    }

    public function login(Request $request): Response
    {
        session_start();
        $users = json_decode((string) file_get_contents(__DIR__ . '/../../data/users.json'), true);
        $email = $request->input('email');
        if (!isset($users[$email])) {
            return new Response('No account for ' . $email, 404);
        }
        if (md5($request->input('password')) !== md5($users[$email])) {
            return new Response('Wrong password', 401);
        }
        $_SESSION['user'] = $email;
        return Response::redirect('/account');
    }

    public function account(Request $request): Response
    {
        session_start();
        if (!isset($_SESSION['user'])) {
            return Response::redirect('/login');
        }
        return new Response('Signed in as ' . $_SESSION['user']);
    }
}
