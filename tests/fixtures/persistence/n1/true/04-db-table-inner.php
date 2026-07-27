<?php
// FIXTURE: true-positive N+1 — DB::table() query fired per invoice inside the loop.

namespace App\Services;

use App\Models\Invoice;
use Illuminate\Support\Facades\DB;

class PaymentReconciler
{
    public function paymentsByInvoice(): array
    {
        $map = [];
        $invoices = Invoice::query()->get();
        foreach ($invoices as $invoice) {
            $map[$invoice->id] = DB::table('payments')->where('invoice_id', $invoice->id)->get();
        }

        return $map;
    }
}
