<?php
// FIXTURE: true-positive N+1 — query-builder loop with one profile lookup per user row.

namespace App\Services;

use Illuminate\Support\Facades\DB;

class ProfileExportService
{
    public function export(): array
    {
        $out = [];
        $users = DB::table('users')->get();
        foreach ($users as $user) {
            $profile = DB::table('profiles')->where('user_id', $user->id)->first();
            $out[] = ['email' => $user->email, 'bio' => $profile?->bio];
        }

        return $out;
    }
}
