<?php

namespace FleetOps\Domain\Maintenance;

final class ServiceInterval
{
    public function isDue(int $odometerKm, int $lastServiceKm): bool
    {
        return $odometerKm - $lastServiceKm >= 30000;
    }
}
