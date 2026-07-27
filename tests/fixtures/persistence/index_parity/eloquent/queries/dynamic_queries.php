<?php

// Fixture for spike S0.2 (index parity) — road-to-scale-and-history-discipline.
// Expectations per query:
//   L15  where($column, ...)  -> dynamic column argument  => UNRESOLVED (never a Finding)
//   L20  whereRaw(...)        -> raw SQL fragment         => UNRESOLVED (never a Finding)

use App\Models\Post;
use App\Models\User;

function filter_users(string $column, string $value)
{
    return User::where($column, $value)->get();
}

function search_posts(string $title)
{
    return Post::whereRaw('LOWER(title) = ?', [$title])->get();
}
