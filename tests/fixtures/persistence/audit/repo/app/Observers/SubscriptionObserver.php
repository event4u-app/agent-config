<?php

namespace App\Observers;

use App\Models\AuditLog;
use App\Models\Subscription;

// Registered via #[ObservedBy] on the Subscription model.
class SubscriptionObserver
{
    public function created(Subscription $subscription): void
    {
        AuditLog::create(['event' => 'created', 'auditable_type' => Subscription::class, 'auditable_id' => $subscription->id]);
    }

    public function updated(Subscription $subscription): void
    {
        AuditLog::create(['event' => 'updated', 'auditable_type' => Subscription::class, 'auditable_id' => $subscription->id]);
    }

    public function deleted(Subscription $subscription): void
    {
        AuditLog::create(['event' => 'deleted', 'auditable_type' => Subscription::class, 'auditable_id' => $subscription->id]);
    }
}
