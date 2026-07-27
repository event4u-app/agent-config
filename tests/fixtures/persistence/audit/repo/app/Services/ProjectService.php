<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Project;

class ProjectService
{
    public function archive(Project $project): void
    {
        // Mechanism (c): explicit inline audit write in the same function.
        $project->update(['status' => 'archived']); /* gt:covered */
        AuditLog::create(['event' => 'archived', 'auditable_type' => Project::class, 'auditable_id' => $project->id]);
    }

    public function bulkClose(): void
    {
        // Mass update: bypasses model events AND has no inline audit.
        Project::query()->where('status', 'stale')->update(['status' => 'closed']); /* gt:uncovered */
    }
}
