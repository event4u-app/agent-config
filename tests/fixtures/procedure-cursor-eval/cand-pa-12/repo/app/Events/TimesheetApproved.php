<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;

class TimesheetApproved
{
    use Dispatchable;

    public function __construct(public int $timesheetId, public int $employeeId)
    {
    }
}
