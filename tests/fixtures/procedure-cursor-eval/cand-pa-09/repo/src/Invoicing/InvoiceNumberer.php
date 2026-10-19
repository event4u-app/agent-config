<?php

namespace Acme\Receivables\Invoicing;

final class InvoiceNumberer
{
    public function next(int $year, int $sequence): string
    {
        return sprintf('INV-%d-%05d', $year, $sequence);
    }
}
