<?php

namespace App\Service;

class Clock
{
    public function now(): int
    {
        return time();
    }
}
