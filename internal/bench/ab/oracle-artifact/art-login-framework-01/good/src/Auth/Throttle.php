<?php
declare(strict_types=1);

namespace Brook\Auth;

final class Throttle
{
    private const MAX_ATTEMPTS = 5;
    private const WINDOW_SECONDS = 900;
    private string $file;

    public function __construct(string $dataDir)
    {
        $this->file = $dataDir . '/attempts.json';
    }

    public function blocked(string $email): bool
    {
        $recent = array_filter($this->all()[$this->key($email)] ?? [], fn (int $t): bool => $t > time() - self::WINDOW_SECONDS);
        return count($recent) >= self::MAX_ATTEMPTS;
    }

    public function fail(string $email): void
    {
        $all = $this->all();
        $all[$this->key($email)][] = time();
        file_put_contents($this->file, json_encode($all), LOCK_EX);
    }

    private function key(string $email): string
    {
        return hash('sha256', $email);
    }

    /** @return array<string, list<int>> */
    private function all(): array
    {
        return is_file($this->file) ? (json_decode((string) file_get_contents($this->file), true) ?: []) : [];
    }
}
