<?php
// S0.5 fixture — TRUE F9: synchronous Mail::send inside a controller handler.
namespace App\Http\Controllers;

use App\Mail\WelcomeMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class RegistrationController extends Controller
{
    public function store(Request $request)
    {
        $user = $this->users->create($request->validated());
        Mail::to($user->email)->send(new WelcomeMail($user));
        return response()->json($user, 201);
    }
}
