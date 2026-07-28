<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// NOT in the declared audit scope: mutations must never fire F8.
class User extends Model
{
    protected $fillable = ['name', 'email'];
}
