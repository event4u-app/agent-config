<?php

namespace Acme\IbanNormaliser;

use Brick\Math\BigInteger;

final class ChecksumValidator
{
    public function isValid(string $iban): bool
    {
        $rearranged = substr($iban, 4).substr($iban, 0, 4);
        $digits = '';
        foreach (str_split($rearranged) as $char) {
            $digits .= ctype_alpha($char) ? (string) (ord($char) - 55) : $char;
        }

        return BigInteger::of($digits)->mod(97)->toInt() === 1;
    }
}
