<?php

namespace App\Services\Auth;

/**
 * Fixture for the `pepper-literal` class. Planted defect, never shipped code.
 *
 * The slow KDF below is deliberate: the only defect in this file is where the
 * pepper comes from, so a `fast-hash` finding here would be a cross-class
 * false positive rather than a second planted defect.
 */
final class PasswordPepper
{
    // PLANTED: the pepper is a source literal, so it lives in version control
    // and rotates only with a deploy.
    private const PEPPER = 'changeme-pepper'; // secret-allow -- audited fixture placeholder

    public function harden(string $password): string
    {
        $peppered = hash_hmac('sha256', $password, self::PEPPER);

        return password_hash($peppered, PASSWORD_ARGON2ID);
    }
}
