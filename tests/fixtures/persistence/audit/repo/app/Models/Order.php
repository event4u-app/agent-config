<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;

// Mechanism (a), project-local trait variant.
class Order extends Model
{
    use Auditable;

    protected $fillable = ['tenant_id', 'total', 'status'];
}
