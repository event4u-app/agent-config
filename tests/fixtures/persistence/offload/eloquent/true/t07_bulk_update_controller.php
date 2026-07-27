<?php
// S0.5 fixture — TRUE F9: unbounded bulk mutation over a whole table in the handler.
namespace App\Http\Controllers;

use App\Models\Subscription;

class GracePeriodController extends Controller
{
    public function extendAll()
    {
        Subscription::query()->update(['grace_period_ends_at' => now()->addDays(3)]);
        return response()->json(['ok' => true]);
    }
}
