<?php

namespace App\Http\Controllers\Auth;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Safe twin of the `fast-hash` fixture. A detector must stay silent here.
 */
final class RegisterController
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'min:12'],
        ]);

        User::create([
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);

        return redirect('/dashboard');
    }
}
