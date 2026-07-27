<?php
// S0.5 fixture — TRUE F9: external payment SDK call (Stripe) in the request path.
namespace App\Http\Controllers;

use Illuminate\Http\Request;

class CheckoutController extends Controller
{
    public function charge(Request $request)
    {
        $stripe = new \Stripe\StripeClient(config('services.stripe.secret'));
        $intent = $stripe->paymentIntents->create([
            'amount' => $request->integer('amount'),
            'currency' => 'eur',
        ]);
        return response()->json(['client_secret' => $intent->client_secret]);
    }
}
