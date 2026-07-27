<?php

namespace App\Services;

use App\Models\Comment;

// Comment is NOT audit-scoped: none of these mutations may fire F8.
class CommentService
{
    public function post(array $data): Comment
    {
        return Comment::create($data); /* gt:nonscoped */
    }

    public function remove(Comment $comment): void
    {
        $comment->delete(); /* gt:nonscoped */
    }
}
