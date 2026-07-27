<?php
// FIXTURE: look-alike — posts are eager-loaded via with(); loop access hits memory, not the DB.

namespace App\Http\Controllers;

use App\Models\User;

class UserReportController
{
    public function index(): array
    {
        $rows = [];
        $users = User::with('posts')->get();
        foreach ($users as $user) {
            $rows[] = [
                'name' => $user->name,
                'post_count' => $user->posts->count(),
            ];
        }

        return $rows;
    }
}
