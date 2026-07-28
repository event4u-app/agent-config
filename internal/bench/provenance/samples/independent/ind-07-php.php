<?php

declare(strict_types=1);

/**
 * Merges $overrides into $defaults. Associative sub-arrays are merged
 * recursively; any other value (including numeric-indexed arrays) is
 * replaced wholesale by the override.
 *
 * @param array<string, mixed> $defaults
 * @param array<string, mixed> $overrides
 * @return array<string, mixed>
 */
function combineConfig(array $defaults, array $overrides): array
{
    foreach ($overrides as $key => $value) {
        if (isAssociative($value) && isset($defaults[$key]) && isAssociative($defaults[$key])) {
            $defaults[$key] = combineConfig($defaults[$key], $value);
            continue;
        }

        $defaults[$key] = $value;
    }

    return $defaults;
}

function isAssociative(mixed $value): bool
{
    return is_array($value) && !array_is_list($value);
}
