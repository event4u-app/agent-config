<?php

namespace Acme\Receivables\Tests\Invoicing;

use Acme\Receivables\Invoicing\InvoiceNumberer;
use PHPUnit\Framework\TestCase;

final class InvoiceNumbererTest extends TestCase
{
    public function testPadsTheSequence(): void
    {
        $this->assertSame('INV-2026-00042', (new InvoiceNumberer())->next(2026, 42));
    }
}
