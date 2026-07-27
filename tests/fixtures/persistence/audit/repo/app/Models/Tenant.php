<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Mechanism (b): covered via TenantObserver, registered in AppServiceProvider.
class Tenant extends Model
{
    protected $fillable = ['name', 'plan'];
}
