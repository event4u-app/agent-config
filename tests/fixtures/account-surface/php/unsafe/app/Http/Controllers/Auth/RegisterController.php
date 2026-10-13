<?php

namespace App\Http\Controllers\Auth;

use App\Models\User;
use Illuminate\Http\Request;

/**
 * Fixture for the `fast-hash` class. Planted defect, never shipped code.
 */
final class RegisterController
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        $salt = bin2hex(random_bytes(16));

        User::create([
            'email' => $data['email'],
            'salt' => $salt,
            // PLANTED: a general-purpose fast hash, salted, used for credential storage.
            'password' => md5($data['password'] . $salt),
        ]);

        return redirect('/dashboard');
    }
}
