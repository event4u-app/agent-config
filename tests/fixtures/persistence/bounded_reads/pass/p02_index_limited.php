<?php
// FIXTURE: R-A3 pass — bounded ->limit() chain in a list endpoint.
namespace App\Http\Controllers;

use App\Models\Order;

class OrderController extends Controller
{
    public function index()
    {
        $orders = Order::where('status', 'open')->limit(100)->get();
        return response()->json($orders);
    }
}
