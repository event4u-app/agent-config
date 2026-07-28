<?php
// FIXTURE: look-alike — relations eager-loaded via ->load() before the loop; no per-row query.

namespace App\Services;

use App\Models\User;

class PostDigestService
{
    public function digest(): array
    {
        $digest = [];
        $users = User::all();
        $users->load('posts');
        foreach ($users as $user) {
            $digest[$user->id] = $user->posts->count();
        }

        return $digest;
    }
}
