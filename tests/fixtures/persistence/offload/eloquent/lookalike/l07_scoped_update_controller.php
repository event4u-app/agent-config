<?php
// S0.5 fixture — LOOKALIKE: bounded, indexed bulk update scoped by ->where — must NOT fire.
namespace App\Http\Controllers;

use App\Models\Subscription;

class TeamPauseController extends Controller
{
    public function pause(int $teamId)
    {
        Subscription::query()->where('team_id', $teamId)->update(['status' => 'paused']);
        return response()->json(['ok' => true]);
    }
}
