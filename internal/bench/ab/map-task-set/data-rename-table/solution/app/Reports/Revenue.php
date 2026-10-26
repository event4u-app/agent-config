<?php

namespace App\Reports;

use Illuminate\Support\Facades\DB;

class Revenue
{
    public function total(): int
    {
        return (int) DB::table('invoices')
            ->join('invoice_lines', 'invoice_lines.invoice_id', '=', 'invoices.id')
            ->sum('invoice_lines.amount');
    }
}
