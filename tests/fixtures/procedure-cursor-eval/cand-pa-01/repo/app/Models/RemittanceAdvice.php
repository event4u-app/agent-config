<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RemittanceAdvice extends Model
{
    protected $fillable = ['payer_reference', 'amount_cents', 'received_at'];

    protected $casts = ['received_at' => 'datetime'];
}
