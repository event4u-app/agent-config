<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

// User is NOT audit-scoped: none of these mutations may fire F8.
class UserController extends Controller
{
    public function store(Request $request)
    {
        $user = User::create($request->validated()); /* gt:nonscoped */
        return response()->json($user, 201);
    }

    public function update(Request $request, User $user)
    {
        $user->fill($request->validated());
        $user->save(); /* gt:nonscoped */
        return response()->json($user);
    }
}
