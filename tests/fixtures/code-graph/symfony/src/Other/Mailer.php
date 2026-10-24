<?php

namespace App\Other;

/** A same-named class in another namespace: never the injected service. */
class Mailer
{
    public function list(): array
    {
        return [];
    }
}
