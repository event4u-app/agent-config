<?php
declare(strict_types=1);

namespace Brook\Security;

final class Csrf
{
    public static function token(): string
    {
        if (empty($_SESSION['_token'])) {
            $_SESSION['_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['_token'];
    }

    public static function valid(string $sent): bool
    {
        return $sent !== '' && hash_equals(self::token(), $sent);
    }
}
