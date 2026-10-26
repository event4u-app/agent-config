<?php

namespace App\Services;

use App\Models\Order;

class OrderSync
{
    public function payload(Order $order): array
    {
        return [
            'id' => $order->id,
            'total' => $order->total,
            'reference' => $order->legacy_ref,
        ];
    }
}
