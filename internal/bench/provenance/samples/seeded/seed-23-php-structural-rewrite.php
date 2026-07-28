<?php

declare(strict_types=1);

/**
 * @param array<string, mixed> $target
 * @param array<string, mixed> $source
 * @return array<string, mixed>
 */
function deepMerge(array $target, array $source): array
{
    $flatTarget = flatten($target);
    $flatSource = flatten($source);

    $merged = array_merge($flatTarget, $flatSource);

    return unflatten($merged);
}

/**
 * @param array<string, mixed> $data
 * @return array<string, mixed>
 */
function flatten(array $data, string $prefix = ''): array
{
    $flat = [];

    foreach ($data as $key => $value) {
        $path = $prefix === '' ? (string) $key : $prefix . '.' . $key;

        if (is_array($value) && !array_is_list($value)) {
            $flat = array_merge($flat, flatten($value, $path));
        } else {
            $flat[$path] = $value;
        }
    }

    return $flat;
}

/**
 * @param array<string, mixed> $flat
 * @return array<string, mixed>
 */
function unflatten(array $flat): array
{
    $result = [];

    foreach ($flat as $path => $value) {
        $segments = explode('.', $path);
        $cursor = &$result;

        foreach ($segments as $index => $segment) {
            $isLast = $index === count($segments) - 1;

            if ($isLast) {
                $cursor[$segment] = $value;
            } else {
                if (!isset($cursor[$segment]) || !is_array($cursor[$segment])) {
                    $cursor[$segment] = [];
                }
                $cursor = &$cursor[$segment];
            }
        }

        unset($cursor);
    }

    return $result;
}
