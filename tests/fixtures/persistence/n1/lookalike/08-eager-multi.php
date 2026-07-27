<?php
// FIXTURE: look-alike — multiple relations eager-loaded via with([...]); loop access is in-memory.

namespace App\Services;

use App\Models\User;

class ActivitySummaryService
{
    public function summary(): array
    {
        $summary = [];
        $users = User::with(['posts', 'comments'])->get();
        foreach ($users as $user) {
            $summary[$user->id] = [
                'posts' => $user->posts->count(),
                'comments' => $user->comments->count(),
            ];
        }

        return $summary;
    }
}
