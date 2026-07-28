<?php
// FIXTURE: look-alike — loop reads scalar attributes and formats a Carbon date; no query per row.

namespace App\Services;

use App\Models\Order;

class OrderCsvExporter
{
    public function rows(): array
    {
        $rows = [];
        $orders = Order::where('status', 'shipped')->get();
        foreach ($orders as $order) {
            $rows[] = [
                'number' => $order->number,
                'total' => $order->total,
                'shipped_on' => $order->created_at->format('Y-m-d'),
            ];
        }

        return $rows;
    }
}
