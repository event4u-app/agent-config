<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;

class PayrollClosed
{
    use Dispatchable;

    public function __construct(public string $period)
    {
    }
}
