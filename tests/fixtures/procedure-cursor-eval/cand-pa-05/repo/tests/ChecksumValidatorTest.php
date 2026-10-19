<?php

namespace Acme\IbanNormaliser\Tests;

use Acme\IbanNormaliser\ChecksumValidator;
use PHPUnit\Framework\TestCase;

final class ChecksumValidatorTest extends TestCase
{
    public function testRejectsAWrongChecksum(): void
    {
        $this->assertFalse((new ChecksumValidator())->isValid('DE00123456780000000000'));
    }
}
