<?php
// FIXTURE: look-alike — iterable is a hardcoded 3-element array; query count is bounded constant.

namespace App\Services;

use App\Models\Invoice;

class InvoiceStatusBoard
{
    public function counts(): array
    {
        $counts = [];
        $statuses = ['draft', 'sent', 'paid'];
        foreach ($statuses as $status) {
            $counts[$status] = Invoice::where('status', $status)->count();
        }

        return $counts;
    }
}
