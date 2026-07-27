<?php

// Fixture for spike S0.2 (index parity) — road-to-scale-and-history-discipline.
// Expectations per query:
//   L14  users.email      -> resolved + indexed (unique)           => OK
//   L17  users.name       -> resolved + NOT indexed                => VIOLATION (F2)
//   L21  posts.view_count -> relation query, resolved, NOT indexed => VIOLATION (F2)

use App\Models\User;

function find_user_by_email(string $email): ?User
{
    return User::where('email', $email)->first();
}

function find_users_by_name(string $name)
{
    return User::where('name', $name)->get();
}

function popular_posts_for(User $user)
{
    return $user->posts()->where('view_count', 1000)->get();
}
