<?php
declare(strict_types=1);

namespace Brook\Security;

final class Session
{
    public static function start(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            ini_set('session.use_strict_mode', '1');
            session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
            session_start();
        }
    }

    /** New id on privilege change, so a planted session id is worthless. */
    public static function rotate(): void
    {
        session_regenerate_id(true);
    }
}
