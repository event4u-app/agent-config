<?php
// S0.5 fixture — TRUE F11: listener WITHOUT ShouldQueue doing catalog work
// (mail) — runs synchronously inside the request that fired the event.
namespace App\Listeners;

use App\Events\OrderShipped;
use App\Mail\ShipmentMail;
use Illuminate\Support\Facades\Mail;

class SendShipmentNotificationListener
{
    public function handle(OrderShipped $event): void
    {
        Mail::to($event->order->customer_email)->send(new ShipmentMail($event->order));
    }
}
