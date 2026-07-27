<?php

namespace App\Services;

use App\Models\Payment;

class PaymentService
{
    public function refund(int $id): Payment
    {
        $payment = Payment::findOrFail($id);
        $payment->update(['status' => 'refunded']); /* gt:uncovered */
        return $payment;
    }
}
