<?php

namespace App\Jobs;

use App\Models\OrderItem;
use App\Services\PartnerClient;
use Illuminate\Contracts\Queue\ShouldQueue;

class SyncStock implements ShouldQueue
{
    public function __construct(private string $sku)
    {
    }

    public function handle(PartnerClient $partner): void
    {
        $level = $partner->warehouseStock($this->sku);
        OrderItem::where('sku', $this->sku)->update(['stock' => $level->Quantity ?? 0]);
    }
}
