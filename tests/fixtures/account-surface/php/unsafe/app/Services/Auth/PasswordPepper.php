<?php

namespace App\Services\Auth;

/**
 * Fixture for the `pepper-literal` class. Planted defect, never shipped code.
 */
final class PasswordPepper
{
    // PLANTED: the pepper is a source literal, so it lives in version control
    // and rotates only with a deploy.
    private const PEPPER = 'changeme-pepper'; // secret-allow -- audited fixture placeholder

    public function apply(string $password): string
    {
        return hash_hmac('sha256', $password, self::PEPPER);
    }
}
