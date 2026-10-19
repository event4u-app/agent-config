<?php

namespace FleetOps\Domain\Maintenance;

final class WorkOrder
{
    public function __construct(public readonly string $plate, public readonly string $task)
    {
    }
}
