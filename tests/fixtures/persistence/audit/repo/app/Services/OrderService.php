<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Facades\DB;

class OrderService
{
    public function place(array $data): Order
    {
        return Order::create($data); /* gt:covered */
    }

    public function importLegacy(array $rows): void
    {
        // Tricky case: raw query-builder insert bypasses the Order model
        // entirely, so the Auditable trait never fires -> uncovered.
        DB::table('orders')->insert($rows); /* gt:uncovered */
    }
}
