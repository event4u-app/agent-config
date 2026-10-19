<?php

namespace App\Listeners;

use App\Events\TimesheetApproved;

class ArchiveTimesheetSnapshot
{
    public function handle(TimesheetApproved $event): void
    {
        logger()->info('timesheet archived', ['timesheet' => $event->timesheetId]);
    }
}
