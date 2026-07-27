<?php
// FIXTURE: true-positive N+1 — one Item query fired per order inside the loop body.

namespace App\Services;

use App\Models\Item;
use App\Models\Order;

class OrderSummaryService
{
    public function firstItems(): array
    {
        $result = [];
        $orders = Order::where('status', 'paid')->get();
        foreach ($orders as $order) {
            $item = Item::where('order_id', $order->id)->first();
            $result[$order->id] = $item?->name;
        }

        return $result;
    }
}
