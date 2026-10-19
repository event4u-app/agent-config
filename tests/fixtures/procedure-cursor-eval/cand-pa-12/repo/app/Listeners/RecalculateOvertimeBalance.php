<?php

namespace App\Listeners;

use App\Events\TimesheetApproved;

class RecalculateOvertimeBalance
{
    public function handle(TimesheetApproved $event): void
    {
        logger()->info('overtime recalculated', ['employee' => $event->employeeId]);
    }
}
