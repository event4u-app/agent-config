<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Money;

/**
 * Downstream caller of Money::format(). When the signature gains a
 * required `currency` parameter, THIS call site must be updated too,
 * or the new required argument is missing and the call is wrong.
 */
final class CheckoutController
{
    public function lineItem(string $label, int $cents): string
    {
        return "{$label}: " . Money::format($cents);
    }
}
