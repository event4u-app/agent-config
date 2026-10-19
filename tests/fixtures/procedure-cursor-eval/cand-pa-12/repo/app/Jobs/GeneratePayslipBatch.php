<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;

class GeneratePayslipBatch implements ShouldQueue
{
    use Dispatchable, Queueable;

    public function __construct(public string $period)
    {
    }

    public function handle(): void
    {
        logger()->info('payslips generated', ['period' => $this->period]);
    }
}
