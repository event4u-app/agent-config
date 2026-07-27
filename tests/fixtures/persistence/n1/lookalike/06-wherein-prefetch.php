<?php
// FIXTURE: look-alike — whereIn batch prefetch, then keyed in-memory lookup inside the loop.

namespace App\Services;

use App\Models\Profile;
use App\Models\User;

class ProfileMergeService
{
    public function merged(): array
    {
        $users = User::all();
        $profiles = Profile::whereIn('user_id', $users->pluck('id'))->get()->keyBy('user_id');
        $out = [];
        foreach ($users as $user) {
            $profile = $profiles[$user->id] ?? null;
            $out[] = ['email' => $user->email, 'bio' => $profile?->bio];
        }

        return $out;
    }
}
