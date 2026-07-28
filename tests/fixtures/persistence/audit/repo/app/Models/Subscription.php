<?php

namespace App\Models;

use App\Observers\SubscriptionObserver;
use Illuminate\Database\Eloquent\Attributes\ObservedBy;
use Illuminate\Database\Eloquent\Model;

// Mechanism (b), attribute-registration variant.
#[ObservedBy(SubscriptionObserver::class)]
class Subscription extends Model
{
    protected $fillable = ['tenant_id', 'plan', 'status'];
}
