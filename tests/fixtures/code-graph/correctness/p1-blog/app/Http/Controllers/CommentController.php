<?php

namespace App\Http\Controllers;

use App\Models\Comment;

class CommentController
{
    public function index(int $postId)
    {
        return Comment::where('post_id', $postId)->orderBy('created_at')->get();
    }
}
