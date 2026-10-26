<?php

namespace App\Http\Controllers;

use App\Services\PartnerClient;

class StockController
{
    public function show(PartnerClient $partner, string $sku)
    {
        return $partner->stock($sku);
    }
}
