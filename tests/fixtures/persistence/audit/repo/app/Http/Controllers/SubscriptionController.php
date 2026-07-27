<?php

namespace App\Http\Controllers;

use App\Models\Subscription;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    public function store(Request $request)
    {
        $subscription = Subscription::create($request->validated()); /* gt:covered */
        return response()->json($subscription, 201);
    }
}
