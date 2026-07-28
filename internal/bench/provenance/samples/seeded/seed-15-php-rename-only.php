<?php

declare(strict_types=1);

/**
 * @param array<string, mixed> $base
 * @param array<string, mixed> $overrides
 * @return array<string, mixed>
 */
function mergeRecursive(array $base, array $overrides): array
{
    $merged = $base;

    foreach ($overrides as $prop => $val) {
        if (
            is_array($val)
            && array_key_exists($prop, $merged)
            && is_array($merged[$prop])
            && !isSequential($val)
            && !isSequential($merged[$prop])
        ) {
            $merged[$prop] = mergeRecursive($merged[$prop], $val);
        } else {
            $merged[$prop] = $val;
        }
    }

    return $merged;
}

function isSequential(array $val): bool
{
    return array_is_list($val);
}
