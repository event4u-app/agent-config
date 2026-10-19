<?php

namespace FleetOps\Domain\Rostering;

final class RestTimeRule
{
    public function allows(DriverShift $previous, DriverShift $next): bool
    {
        return $next->start->getTimestamp() - $previous->end->getTimestamp() >= 11 * 3600;
    }
}
