<?php

declare(strict_types=1);

function uuidV4(): string
{
    $bytes = random_bytes(16);

    // Set version to 0100.
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    // Set variant to 10.
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

    $hex = bin2hex($bytes);

    return sprintf(
        '%s-%s-%s-%s-%s',
        substr($hex, 0, 8),
        substr($hex, 8, 4),
        substr($hex, 12, 4),
        substr($hex, 16, 4),
        substr($hex, 20, 12),
    );
}
