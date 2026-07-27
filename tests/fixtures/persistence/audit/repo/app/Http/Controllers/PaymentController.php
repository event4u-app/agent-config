<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function store(Request $request)
    {
        $payment = Payment::create($request->validated()); /* gt:uncovered */
        return response()->json($payment, 201);
    }

    public function update(Request $request, int $id)
    {
        $payment = Payment::findOrFail($id);
        $payment->fill($request->validated());
        $payment->save(); /* gt:uncovered */
        return response()->json($payment);
    }

    public function destroy(int $id)
    {
        Payment::destroy($id); /* gt:uncovered */
        return response()->noContent();
    }
}
