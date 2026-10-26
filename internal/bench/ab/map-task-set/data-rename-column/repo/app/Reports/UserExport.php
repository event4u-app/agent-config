<?php

namespace App\Reports;

use Illuminate\Support\Facades\DB;

class UserExport
{
    public function rows(string $since): array
    {
        return DB::select('SELECT id, email FROM users WHERE created_at > ?', [$since]);
    }
}
