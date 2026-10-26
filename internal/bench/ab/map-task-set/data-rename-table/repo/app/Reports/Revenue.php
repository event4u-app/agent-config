<?php

namespace App\Reports;

use Illuminate\Support\Facades\DB;

class Revenue
{
    public function total(): int
    {
        return (int) DB::table('invoices')
            ->join('invoice_items', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->sum('invoice_items.amount');
    }
}
