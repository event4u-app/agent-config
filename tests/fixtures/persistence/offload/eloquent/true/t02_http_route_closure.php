<?php
// S0.5 fixture — TRUE F9: outbound Http:: call inside a route closure handler.
use App\Models\Order;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;

Route::post('/orders/{id}/sync', function (string $id) {
    $order = Order::findOrFail($id);
    Http::timeout(30)->post('https://erp.partner.example/api/orders', $order->toArray());
    return response()->noContent();
});
