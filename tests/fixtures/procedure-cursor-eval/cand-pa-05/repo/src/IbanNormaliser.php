<?php

namespace Acme\IbanNormaliser;

final class IbanNormaliser
{
    public function normalise(string $raw): string
    {
        $clean = \Normalizer::normalize($raw, \Normalizer::FORM_KC) ?: $raw;

        return strtoupper(preg_replace('/\s+/', '', $clean));
    }
}
