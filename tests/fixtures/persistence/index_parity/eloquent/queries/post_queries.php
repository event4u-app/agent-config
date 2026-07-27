<?php

// Fixture for spike S0.2 (index parity) — road-to-scale-and-history-discipline.
// Expectations per query:
//   L15  posts.status        (where)   -> resolved + indexed              => OK
//   L15  posts.published_at  (orderBy) -> resolved + NOT indexed          => VIOLATION (F2)
//   L20  posts.user_id       (whereIn) -> resolved + indexed (constrained FK) => OK

use App\Models\Post;

function published_posts()
{
    return Post::where('status', 'published')->orderBy('published_at', 'desc')->get();
}

function posts_by_authors(array $userIds)
{
    return Post::whereIn('user_id', $userIds)->get();
}
