<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Audit-scoped but NO trait and NO observer: mutations are uncovered
// unless an inline audit write sits in the same function (mechanism c).
class Project extends Model
{
    protected $fillable = ['name', 'tenant_id', 'status'];
}
