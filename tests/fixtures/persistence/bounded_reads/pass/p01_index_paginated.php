<?php
// FIXTURE: R-A3 pass — paginated list endpoint.
namespace App\Http\Controllers;

use App\Models\User;

class UserController extends Controller
{
    public function index()
    {
        return response()->json(User::query()->paginate(25));
    }
}
