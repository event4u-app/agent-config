<?php

namespace App\Reports;

use Illuminate\Support\Facades\DB;

class UserExport
{
    public function rows(string $since): array
    {
        return DB::select('SELECT id, email_address FROM users WHERE created_at > ?', [$since]);
    }
}
