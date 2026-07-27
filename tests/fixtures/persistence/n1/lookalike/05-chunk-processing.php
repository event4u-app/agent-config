<?php
// FIXTURE: look-alike — chunk() is the N+1 FIX (bounded batches); loop body is pure computation.

namespace App\Services;

use App\Models\Order;

class OrderArchiveService
{
    public function sumTotals(): float
    {
        $sum = 0.0;
        Order::chunk(100, function ($orders) use (&$sum) {
            foreach ($orders as $order) {
                $sum += $order->total;
            }
        });

        return $sum;
    }
}
