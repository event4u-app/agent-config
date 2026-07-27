<?php
// S0.5 fixture — TRUE F11: dispatchAfterResponse for a must-not-lose job +
// register_shutdown_function carrying webhook delivery (both lost on process death).
namespace App\Http\Controllers;

use App\Jobs\SendInvoiceMail;
use Illuminate\Support\Facades\Http;

class InvoiceController extends Controller
{
    public function finalize(string $id)
    {
        $invoice = Invoice::findOrFail($id);
        $invoice->finalize();
        SendInvoiceMail::dispatchAfterResponse($invoice);
        register_shutdown_function(function () use ($invoice) {
            Http::post('https://webhooks.billing.example/invoice-final', $invoice->toArray());
        });
        return response()->json($invoice);
    }
}
