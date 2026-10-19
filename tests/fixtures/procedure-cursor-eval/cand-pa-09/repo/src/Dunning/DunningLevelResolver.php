<?php

namespace Acme\Receivables\Dunning;

final class DunningLevelResolver
{
    public function levelFor(int $daysOverdue): int
    {
        return match (true) {
            $daysOverdue > 60 => 3,
            $daysOverdue > 30 => 2,
            $daysOverdue > 14 => 1,
            default => 0,
        };
    }
}
