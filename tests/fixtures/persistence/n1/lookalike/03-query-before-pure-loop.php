<?php
// FIXTURE: look-alike — single query before the loop; loop body is pure scalar computation.

namespace App\Services;

use App\Models\Order;

class RevenueService
{
    public function total(): float
    {
        $total = 0.0;
        $orders = Order::where('status', 'paid')->get();
        foreach ($orders as $order) {
            $total += $order->amount * (1 - $order->discount_rate);
        }

        return $total;
    }
}
