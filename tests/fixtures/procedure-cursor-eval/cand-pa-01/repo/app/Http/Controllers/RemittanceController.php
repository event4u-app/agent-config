<?php

namespace App\Http\Controllers;

use App\Models\RemittanceAdvice;
use Illuminate\Http\Request;

class RemittanceController extends Controller
{
    public function store(Request $request)
    {
        return RemittanceAdvice::create($request->validate([
            'payer_reference' => 'required|string',
            'amount_cents' => 'required|integer|min:1',
        ]));
    }
}
