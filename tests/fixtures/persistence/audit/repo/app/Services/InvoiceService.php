<?php

namespace App\Services;

use App\Models\Invoice;

class InvoiceService
{
    public function purgeDrafts(): void
    {
        // Tricky case: Invoice carries the auditing trait, but a mass
        // query-builder delete never fires model events -> uncovered.
        Invoice::query()->where('status', 'draft')->delete(); /* gt:uncovered */
    }
}
