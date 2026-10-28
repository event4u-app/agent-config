<?php
declare(strict_types=1);

namespace Brook\Http;

final class Response
{
    /** @param array<string, string> $headers */
    public function __construct(public string $body = '', public int $status = 200, public array $headers = [])
    {
        $this->headers += ['Content-Type' => 'text/html; charset=utf-8'];
    }

    public static function redirect(string $to): self
    {
        return new self('', 302, ['Location' => $to]);
    }

    public function send(): void
    {
        http_response_code($this->status);
        foreach ($this->headers as $name => $value) {
            header($name . ': ' . $value);
        }
        echo $this->body;
    }
}
