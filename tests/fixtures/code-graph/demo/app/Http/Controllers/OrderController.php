<?php

namespace App\Http\Controllers;

use App\Jobs\SyncStock;
use App\Models\Order;
use App\Services\PartnerClient;

class OrderController
{
    public function index()
    {
        return Order::where('status', 'open')->orderBy('created_at')->paginate(25);
    }

    public function show(int $id)
    {
        return Order::findOrFail($id);
    }

    public function store(PartnerClient $partner, string $sku, int $qty)
    {
        $placed = $partner->placeOrder($sku, $qty);
        SyncStock::dispatch($sku);

        return Order::create(['status' => 'placed', 'note' => $placed['id'] ?? null]);
    }
}
