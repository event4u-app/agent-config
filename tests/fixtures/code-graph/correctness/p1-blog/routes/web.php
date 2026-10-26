<?php

use App\Http\Controllers\CommentController;
use Illuminate\Support\Facades\Route;

Route::get('/posts/{post}/comments', [CommentController::class, 'index']);
