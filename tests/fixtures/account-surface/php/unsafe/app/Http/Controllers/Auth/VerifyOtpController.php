<?php

namespace App\Http\Controllers\Auth;

use Illuminate\Http\Request;

/**
 * Fixture for the `secret-compare` class. Planted defect, never shipped code.
 */
final class VerifyOtpController
{
    public function store(Request $request)
    {
        $expected = $request->user()->pending_otp;

        // PLANTED: a non-constant-time comparison on a one-time secret.
        if ($request->input('otp') === $expected) {
            return response()->json(['ok' => true]);
        }

        return response()->json(['ok' => false], 422);
    }
}
