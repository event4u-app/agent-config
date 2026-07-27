<?php
// FIXTURE: R-A3 violation — SELECT * in a raw query string.
namespace App\Services;

use Illuminate\Support\Facades\DB;

class ReportService
{
    public function everything(): array
    {
        return DB::select('SELECT * FROM transactions WHERE created_at > ?', [now()->subYear()]);
    }
}
