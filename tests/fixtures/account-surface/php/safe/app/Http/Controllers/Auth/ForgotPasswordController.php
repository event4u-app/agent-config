<?php

namespace App\Http\Controllers\Auth;

use App\Mail\ResetLink;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

/**
 * Safe twin of the `host-derived-reset` fixture. A detector must stay silent here.
 */
final class ForgotPasswordController
{
    public function store(Request $request)
    {
        $token = bin2hex(random_bytes(32));

        $link = rtrim(config('app.url'), '/') . '/reset/' . $token;

        Mail::to($request->input('email'))->send(new ResetLink($link));

        return back();
    }
}
