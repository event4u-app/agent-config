<?php
// FIXTURE: R-A3 violation — unbounded ->get() in a list endpoint.
namespace App\Http\Controllers;

use App\Models\Order;

class OrderController extends Controller
{
    public function index()
    {
        $orders = Order::where('status', 'open')->orderBy('created_at')->get();
        return response()->json($orders);
    }
}
