<?php
// FIXTURE: R-A3 pass — raw query selecting named columns with a bound.
namespace App\Services;

use Illuminate\Support\Facades\DB;

class ReportService
{
    public function recent(): array
    {
        return DB::select('SELECT id, amount, created_at FROM transactions ORDER BY created_at DESC LIMIT 100');
    }
}
