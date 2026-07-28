<?php

declare(strict_types=1);

final class SemVer
{
    /** @var int[] */
    private array $core;
    private ?string $prerelease;

    public function __construct(string $raw)
    {
        $pieces = explode('-', $raw, 2);
        $this->prerelease = $pieces[1] ?? null;
        $this->core = array_map(
            static fn (string $segment): int => (int) $segment,
            array_pad(explode('.', $pieces[0]), 3, '0'),
        );
    }

    public function compareTo(self $other): int
    {
        foreach ($this->core as $index => $value) {
            $otherValue = $other->core[$index];
            if ($value !== $otherValue) {
                return $value <=> $otherValue;
            }
        }

        return $this->comparePrerelease($other);
    }

    private function comparePrerelease(self $other): int
    {
        if ($this->prerelease === $other->prerelease) {
            return 0;
        }

        if ($this->prerelease === null) {
            return 1;
        }

        if ($other->prerelease === null) {
            return -1;
        }

        return $this->prerelease <=> $other->prerelease;
    }
}

function compareSemver(string $a, string $b): int
{
    return (new SemVer($a))->compareTo(new SemVer($b));
}
