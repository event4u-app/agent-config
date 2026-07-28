<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    public function store(Request $request)
    {
        $invoice = Invoice::create($request->validated()); /* gt:covered */
        return response()->json($invoice, 201);
    }

    public function update(Request $request, Invoice $invoice)
    {
        $invoice->update($request->validated()); /* gt:covered */
        return response()->json($invoice);
    }

    public function destroy(Invoice $invoice)
    {
        $invoice->delete(); /* gt:covered */
        return response()->noContent();
    }
}
