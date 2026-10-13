<?php

namespace App\Services\Auth;

/**
 * Safe twin of the `pepper-literal` fixture. A detector must stay silent here.
 */
final class PasswordPepper
{
    public function __construct(private readonly PepperStore $store)
    {
    }

    public function apply(string $password): string
    {
        return hash_hmac('sha256', $password, $this->store->current());
    }
}
