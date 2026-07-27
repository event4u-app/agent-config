<?php
// S0.5 fixture — LOOKALIKE: dispatchAfterResponse for an acceptable-loss cache warm — must NOT fire.
namespace App\Http\Controllers;

use App\Jobs\WarmDashboardCache;

class DashboardController extends Controller
{
    public function refresh(int $teamId)
    {
        WarmDashboardCache::dispatchAfterResponse($teamId);
        return response()->json(['ok' => true]);
    }
}
