<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// The audit sink itself. Not audit-scoped (would recurse).
class AuditLog extends Model
{
    protected $fillable = ['event', 'auditable_type', 'auditable_id', 'payload'];
}
