<?php
// FIXTURE: R-A9 ADVICE — handler fanning out to 4 side-effect domains inline.
namespace App\Http\Controllers;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class StatusController extends Controller
{
    public function update(int $id)
    {
        $order = \App\Models\Order::findOrFail($id);
        $order->update(['status' => 'shipped']);
        Mail::queue(new \App\Mail\ShippedMail($order));
        Http::post('https://erp.partner.example/api/status', ['id' => $id]);
        Cache::forget("order:{$id}");
        Log::info('order shipped', ['id' => $id]);
        return response()->json($order);
    }
}
