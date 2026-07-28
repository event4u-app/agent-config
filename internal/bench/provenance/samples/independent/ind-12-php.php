<?php

declare(strict_types=1);

/**
 * Parses a URL query string into an associative array without
 * relying on PHP's built-in parse_str (which mangles dotted keys).
 *
 * @return array<string, string>
 */
function parseQueryString(string $query): array
{
    $query = ltrim($query, '?');

    if ($query === '') {
        return [];
    }

    $result = [];

    foreach (explode('&', $query) as $pair) {
        if ($pair === '') {
            continue;
        }

        $parts = explode('=', $pair, 2);
        $key = rawurldecode($parts[0]);
        $value = isset($parts[1]) ? rawurldecode($parts[1]) : '';

        $result[$key] = $value;
    }

    return $result;
}
