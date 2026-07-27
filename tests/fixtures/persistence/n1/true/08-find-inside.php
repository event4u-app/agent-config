<?php
// FIXTURE: true-positive N+1 — Model::find() fired per project inside the loop.

namespace App\Services;

use App\Models\Project;
use App\Models\Task;

class ProjectDashboardService
{
    public function latestTasks(): array
    {
        $latest = [];
        $projects = Project::where('active', true)->get();
        foreach ($projects as $project) {
            $latest[$project->id] = Task::find($project->latest_task_id);
        }

        return $latest;
    }
}
