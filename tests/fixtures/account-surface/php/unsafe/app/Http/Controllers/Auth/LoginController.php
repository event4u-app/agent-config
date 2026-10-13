<?php

namespace App\Http\Controllers\Auth;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Fixture for the `account-disclosure` class. Planted defect, never shipped
 * code. Expected evidence state is `suspected`: the string alone does not
 * prove the route is public.
 */
final class LoginController
{
    public function store(Request $request)
    {
        $user = User::where('email', $request->input('email'))->first();

        if ($user === null) {
            // PLANTED: the response separates "no such account" from
            // "wrong password", which enumerates registered addresses.
            return back()->withErrors(['email' => 'No account with that email address.']);
        }

        if (! Auth::attempt($request->only('email', 'password'))) {
            return back()->withErrors(['password' => 'That password is incorrect.']);
        }

        return redirect('/dashboard');
    }
}
