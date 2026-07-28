<?php
// S0.5 fixture — LOOKALIKE: cheap allowed calls (single indexed insert + cache ops) — must NOT fire.
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class PostController extends Controller
{
    public function store(Request $request)
    {
        $post = $request->user()->posts()->create($request->validated());
        Cache::put("post.{$post->id}", $post, 3600);
        return response()->json($post, 201);
    }
}
