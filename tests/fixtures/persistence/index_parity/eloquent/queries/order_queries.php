<?php

// Fixture for spike S0.2 (index parity) — road-to-scale-and-history-discipline.
// Expectations per query:
//   L16  orders.reference -> resolved + indexed (unique)   => OK
//   L21  orders.channel   -> resolved + NOT indexed        => VIOLATION (F2)
//   L26  orders.total     -> DB::table path, resolved + NOT indexed => VIOLATION (F2)

use App\Models\Order;
use Illuminate\Support\Facades\DB;

function find_order(string $reference): ?Order
{
    return Order::where('reference', $reference)->first();
}

function web_orders()
{
    return Order::where('channel', 'web')->get();
}

function big_orders()
{
    return DB::table('orders')->where('total', 100)->get();
}
