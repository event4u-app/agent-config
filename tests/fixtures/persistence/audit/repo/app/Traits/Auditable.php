<?php

namespace App\Traits;

use App\Models\AuditLog;

// Project-local auditing trait (mechanism a, project variant).
trait Auditable
{
    public static function bootAuditable(): void
    {
        static::created(function ($model) {
            AuditLog::create(['event' => 'created', 'auditable_type' => get_class($model), 'auditable_id' => $model->id]);
        });
        static::updated(function ($model) {
            AuditLog::create(['event' => 'updated', 'auditable_type' => get_class($model), 'auditable_id' => $model->id]);
        });
        static::deleted(function ($model) {
            AuditLog::create(['event' => 'deleted', 'auditable_type' => get_class($model), 'auditable_id' => $model->id]);
        });
    }
}
