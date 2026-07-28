<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use OwenIt\Auditing\Auditable;

// Mechanism (a): vendor auditing trait directly on the model.
class Invoice extends Model
{
    use Auditable;

    protected $fillable = ['number', 'tenant_id', 'amount', 'status'];
}
