<?php

namespace Acme\Receivables\Tests\Ledger;

use Acme\Receivables\Ledger\LedgerPosting;
use PHPUnit\Framework\TestCase;

final class LedgerPostingTest extends TestCase
{
    public function testKeepsTheAmount(): void
    {
        $this->assertSame(1250, (new LedgerPosting('4000', 1250))->amountCents);
    }
}
