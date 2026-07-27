<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// NOT in the declared audit scope.
class Comment extends Model
{
    protected $fillable = ['body', 'user_id'];
}
