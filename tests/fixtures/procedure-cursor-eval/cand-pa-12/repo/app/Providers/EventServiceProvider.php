<?php

namespace App\Providers;

use App\Events\PayrollClosed;
use App\Events\TimesheetApproved;
use App\Listeners\ArchiveTimesheetSnapshot;
use App\Listeners\RecalculateOvertimeBalance;
use App\Listeners\SendPayslipNotification;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        TimesheetApproved::class => [RecalculateOvertimeBalance::class, ArchiveTimesheetSnapshot::class],
        PayrollClosed::class => [SendPayslipNotification::class],
    ];
}
