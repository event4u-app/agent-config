<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class BillingService
{
    public function repriceTenantInvoices(int $tenantId, float $factor): void
    {
        // Tricky case: DB::table() on a scoped model's table bypasses the
        // Invoice trait, but the inline activity() call in the same
        // function covers it (mechanism c).
        DB::table('invoices')->where('tenant_id', $tenantId)->update(['amount_factor' => $factor]); /* gt:covered */
        activity()->log('invoices repriced for tenant ' . $tenantId);
    }
}
