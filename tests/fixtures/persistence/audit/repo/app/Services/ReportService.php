<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class ReportService
{
    public function markTenantsReported(array $ids): void
    {
        // DB::table() on a scoped model's table, no inline audit -> uncovered
        // (the registered TenantObserver never sees query-builder writes).
        DB::table('tenants')->whereIn('id', $ids)->update(['reported_at' => now()]); /* gt:uncovered */
    }
}
