<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Money formatting helper.
 *
 * The signature currently takes a bare number of cents:
 *   format(int $cents): string
 *
 * We need it to take a currency too, so the SAME helper can render
 * EUR and USD. The new signature must be:
 *   format(int $cents, string $currency): string
 *
 * NOTE: this helper is imported and called elsewhere in the app.
 * Changing the signature here without updating the caller leaves a
 * broken call site (a missing required argument).
 */
final class Money
{
    public static function format(int $cents): string
    {
        $value = number_format($cents / 100, 2);

        return "€{$value}";
    }
}
