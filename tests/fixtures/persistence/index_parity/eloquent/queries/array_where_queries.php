<?php

// Fixture for spike S0.2 (index parity) — road-to-scale-and-history-discipline.
// Expectations per query:
//   L16  posts.status  (array where) -> resolved + indexed              => OK
//   L16  posts.user_id (array where) -> resolved + indexed (FK)         => OK
//   L21  orders.channel   (array where) -> resolved + NOT indexed       => VIOLATION (F2)
//   L21  orders.reference (array where) -> resolved + indexed (unique)  => OK

use App\Models\Order;
use App\Models\Post;

function published_by_author(int $userId)
{
    return Post::where(['status' => 'published', 'user_id' => $userId])->get();
}

function app_order(string $reference)
{
    return Order::where(['channel' => 'app', 'reference' => $reference])->first();
}
