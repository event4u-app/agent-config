<?php

namespace App\Listeners;

use App\Events\PayrollClosed;
use App\Jobs\GeneratePayslipBatch;

class SendPayslipNotification
{
    public function handle(PayrollClosed $event): void
    {
        GeneratePayslipBatch::dispatch($event->period);
    }
}
