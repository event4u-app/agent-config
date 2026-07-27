<?php
// FIXTURE: look-alike — loop over a hardcoded 3-element array; query count is constant, not per-row.

namespace App\Services;

use App\Models\Task;

class PriorityCountService
{
    public function counts(): array
    {
        $counts = [];
        foreach ([1, 2, 3] as $priority) {
            $counts[$priority] = Task::where('priority', $priority)->count();
        }

        return $counts;
    }
}
