<?php
// S0.5 fixture — LOOKALIKE: outbound Http:: call inside a queued job (ShouldQueue) — must NOT fire.
namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Http;

class SyncOrderToErp implements ShouldQueue
{
    public function __construct(private readonly array $order) {}

    public function handle(): void
    {
        Http::retry(3, 200)->post('https://erp.partner.example/api/orders', $this->order);
    }
}
