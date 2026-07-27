<?php
// S0.5 fixture — LOOKALIKE: waivered synchronous mail — must be reported waived, not counted.
namespace App\Http\Controllers;

use App\Mail\OtpMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class OtpController extends Controller
{
    public function send(Request $request)
    {
        $code = $this->otp->issue($request->user());
        // sync-required: OTP code must be delivered before the response returns (auth UX contract)
        Mail::to($request->user()->email)->send(new OtpMail($code));
        return response()->json(['sent' => true]);
    }
}
