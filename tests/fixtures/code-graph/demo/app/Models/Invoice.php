<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    protected $connection = 'tenant';

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
