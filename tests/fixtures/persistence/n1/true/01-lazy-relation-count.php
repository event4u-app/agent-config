<?php
// FIXTURE: true-positive N+1 — User::all() iterated with lazy $user->posts relation access per row.

namespace App\Http\Controllers;

use App\Models\User;

class UserReportController
{
    public function index(): array
    {
        $rows = [];
        $users = User::all();
        foreach ($users as $user) {
            $rows[] = [
                'name' => $user->name,
                'post_count' => $user->posts->count(),
            ];
        }

        return $rows;
    }
}
