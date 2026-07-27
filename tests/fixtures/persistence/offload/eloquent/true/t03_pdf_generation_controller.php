<?php
// S0.5 fixture — TRUE F9: PDF generation in the request path.
namespace App\Http\Controllers;

class InvoicePdfController extends Controller
{
    public function archive(string $id)
    {
        $invoice = Invoice::findOrFail($id);
        $pdf = PDF::loadView('invoices.show', ['invoice' => $invoice]);
        $pdf->save(storage_path("archive/invoices/{$invoice->number}.pdf"));
        return response()->json(['archived' => true]);
    }
}
