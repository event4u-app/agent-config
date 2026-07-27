<?php
// FIXTURE: true-positive N+1 — relation-method query ($user->roles()->pluck()) per user.

namespace App\Services;

use App\Models\User;

class RoleMatrixService
{
    public function matrix(): array
    {
        $matrix = [];
        $users = User::all();
        foreach ($users as $user) {
            $matrix[$user->id] = $user->roles()->pluck('name');
        }

        return $matrix;
    }
}
