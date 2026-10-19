<?php

namespace FleetOps\Domain\Fleet;

final class FleetRegistry
{
    /** @var array<string, Vehicle> */
    private array $vehicles = [];

    public function register(Vehicle $vehicle): void
    {
        $this->vehicles[$vehicle->plate] = $vehicle;
    }
}
