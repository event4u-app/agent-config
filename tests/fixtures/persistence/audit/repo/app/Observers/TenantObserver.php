<?php

namespace App\Observers;

use App\Models\AuditLog;
use App\Models\Tenant;

// Registered in AppServiceProvider::boot() -> mechanism (b) for Tenant.
class TenantObserver
{
    public function created(Tenant $tenant): void
    {
        AuditLog::create(['event' => 'created', 'auditable_type' => Tenant::class, 'auditable_id' => $tenant->id]);
    }

    public function updated(Tenant $tenant): void
    {
        AuditLog::create(['event' => 'updated', 'auditable_type' => Tenant::class, 'auditable_id' => $tenant->id]);
    }

    public function deleted(Tenant $tenant): void
    {
        AuditLog::create(['event' => 'deleted', 'auditable_type' => Tenant::class, 'auditable_id' => $tenant->id]);
    }
}
