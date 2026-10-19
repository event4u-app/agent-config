<?php

namespace Acme\Receivables\Vouchers;

final class VoucherRedeemer
{
    public function redeem(int $balanceCents, int $voucherCents): int
    {
        return max(0, $balanceCents - $voucherCents);
    }
}
