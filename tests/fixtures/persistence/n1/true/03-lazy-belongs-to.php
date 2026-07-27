<?php
// FIXTURE: true-positive N+1 — lazy belongsTo access ($post->author) resolves one query per post.

namespace App\Services;

use App\Models\Post;

class PostFeedService
{
    public function bylines(): array
    {
        $bylines = [];
        $posts = Post::all();
        foreach ($posts as $post) {
            $bylines[] = $post->title . ' by ' . $post->author->name;
        }

        return $bylines;
    }
}
