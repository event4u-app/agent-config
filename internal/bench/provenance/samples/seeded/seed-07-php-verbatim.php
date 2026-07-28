<?php

declare(strict_types=1);

/**
 * @param array<string, mixed> $target
 * @param array<string, mixed> $source
 * @return array<string, mixed>
 */
function deepMerge(array $target, array $source): array
{
    $result = $target;

    foreach ($source as $key => $value) {
        if (
            is_array($value)
            && array_key_exists($key, $result)
            && is_array($result[$key])
            && !isListArray($value)
            && !isListArray($result[$key])
        ) {
            $result[$key] = deepMerge($result[$key], $value);
        } else {
            $result[$key] = $value;
        }
    }

    return $result;
}

function isListArray(array $value): bool
{
    return array_is_list($value);
}
