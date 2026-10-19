<?php

namespace Acme\Receivables\Ledger;

final class LedgerPosting
{
    public function __construct(public readonly string $account, public readonly int $amountCents)
    {
    }
}
