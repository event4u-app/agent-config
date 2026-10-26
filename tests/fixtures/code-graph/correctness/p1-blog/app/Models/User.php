<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    public function posts()
    {
        return $this->hasMany(Post::class);
    }
}
