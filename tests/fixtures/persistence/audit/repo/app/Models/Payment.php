<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Tricky case: PaymentObserver EXISTS in app/Observers but is never
// registered (no ::observe() call, no #[ObservedBy]) -> uncovered.
class Payment extends Model
{
    protected $fillable = ['invoice_id', 'amount', 'status'];
}
