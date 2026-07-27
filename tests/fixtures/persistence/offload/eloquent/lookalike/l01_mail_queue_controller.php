<?php
// S0.5 fixture — LOOKALIKE: Mail::queue in a controller — properly offloaded, must NOT fire.
namespace App\Http\Controllers;

use App\Mail\WelcomeMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class RegistrationController extends Controller
{
    public function store(Request $request)
    {
        $user = $this->users->create($request->validated());
        Mail::to($user->email)->queue(new WelcomeMail($user));
        return response()->json($user, 201);
    }
}
