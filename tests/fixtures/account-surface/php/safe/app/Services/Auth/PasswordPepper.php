<?php

namespace App\Services\Auth;

/**
 * Safe twin of the `pepper-literal` fixture. A detector must stay silent here.
 *
 * The HMAC mixes the pepper in; the slow KDF on the next line is what stores
 * the credential. Both steps are visible in one method on purpose, so this
 * twin cannot be read as a fast digest standing in for password storage.
 */
final class PasswordPepper
{
    public function __construct(private readonly PepperStore $store)
    {
    }

    public function harden(string $password): string
    {
        $peppered = hash_hmac('sha256', $password, $this->store->current());

        return password_hash($peppered, PASSWORD_ARGON2ID);
    }
}
