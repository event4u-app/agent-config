<?php

namespace App\Http\Controllers\Auth;

use App\Mail\ResetLink;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

/**
 * Fixture for the `host-derived-reset` class. Planted defect, never shipped code.
 */
final class ForgotPasswordController
{
    public function store(Request $request)
    {
        $token = $this->issueToken($request->input('email'));

        // PLANTED: the reset link is built from the request Host, so an
        // attacker-controlled Host header sends the token to their own domain.
        $link = $request->getScheme() . '://' . $request->getHost() . '/reset/' . $token;

        Mail::to($request->input('email'))->send(new ResetLink($link));

        return back();
    }

    private function issueToken(string $email): string
    {
        return bin2hex(random_bytes(32));
    }
}
