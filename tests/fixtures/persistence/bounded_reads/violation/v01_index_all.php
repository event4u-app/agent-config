<?php
// FIXTURE: R-A3 violation — Model::all() in a list endpoint.
namespace App\Http\Controllers;

class UserController extends Controller
{
    public function index()
    {
        return response()->json(\App\Models\User::all());
    }
}
