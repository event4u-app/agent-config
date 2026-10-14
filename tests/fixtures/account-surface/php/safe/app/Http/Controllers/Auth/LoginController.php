<?php

namespace App\Http\Controllers\Auth;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Safe twin of the `account-disclosure` fixture. A detector must stay silent
 * here: one outcome for both the unknown-address and the wrong-secret path.
 */
final class LoginController
{
    public function store(Request $request)
    {
        if (! Auth::attempt($request->only('email', 'password'))) {
            return back()->withErrors(['email' => 'Those credentials do not match our records.']);
        }

        $request->session()->regenerate();

        return redirect('/dashboard');
    }
}
