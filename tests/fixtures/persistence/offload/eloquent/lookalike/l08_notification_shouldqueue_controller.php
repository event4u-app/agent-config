<?php
// S0.5 fixture — LOOKALIKE: Notification::send with a ShouldQueue notification — queued, must NOT fire.
namespace App\Http\Controllers;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Notification as NotificationFacade;

class InvoicePaidNotification extends Notification implements ShouldQueue
{
    public function __construct(private readonly object $invoice) {}
}

class BillingController extends Controller
{
    public function markPaid(string $id)
    {
        $invoice = Invoice::findOrFail($id);
        NotificationFacade::send($invoice->team->users, new InvoicePaidNotification($invoice));
        return response()->json(['ok' => true]);
    }
}
