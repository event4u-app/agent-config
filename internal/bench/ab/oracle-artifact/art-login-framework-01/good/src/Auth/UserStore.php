<?php
declare(strict_types=1);

namespace Brook\Auth;

final class UserStore
{
    private string $file;

    public function __construct(string $dataDir)
    {
        $this->file = $dataDir . '/users.json';
        if (!is_file($this->file)) {
            // Seeded on first run; only the hash is written to disk.
            $this->write(['demo@example.test' => password_hash('changeme-bench', PASSWORD_DEFAULT)]);
        }
    }

    /** Constant-shape check: unknown emails verify against a throwaway hash. */
    public function verify(string $email, string $password): bool
    {
        $users = json_decode((string) file_get_contents($this->file), true) ?: [];
        $hash = $users[$email] ?? password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT);
        $ok = password_verify($password, $hash);
        return isset($users[$email]) && $ok;
    }

    /** @param array<string, string> $users */
    private function write(array $users): void
    {
        file_put_contents($this->file, json_encode($users), LOCK_EX);
    }
}
