<?php

namespace App\Http\Controllers\Auth;

use Illuminate\Http\Request;

/**
 * Safe twin of the `secret-compare` fixture. A detector must stay silent here.
 */
final class VerifyOtpController
{
    public function store(Request $request)
    {
        $expected = (string) $request->user()->pending_otp;

        if (hash_equals($expected, (string) $request->input('otp'))) {
            return response()->json(['ok' => true]);
        }

        return response()->json(['ok' => false], 422);
    }
}
