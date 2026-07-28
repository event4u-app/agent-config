<?php

namespace App\Observers;

use App\Models\AuditLog;
use App\Models\Payment;

// Tricky case: this observer is complete and audit-emitting, but it is
// NEVER registered (no ::observe(), no #[ObservedBy]). Payment mutations
// therefore stay UNCOVERED.
class PaymentObserver
{
    public function created(Payment $payment): void
    {
        AuditLog::create(['event' => 'created', 'auditable_type' => Payment::class, 'auditable_id' => $payment->id]);
    }

    public function updated(Payment $payment): void
    {
        AuditLog::create(['event' => 'updated', 'auditable_type' => Payment::class, 'auditable_id' => $payment->id]);
    }

    public function deleted(Payment $payment): void
    {
        AuditLog::create(['event' => 'deleted', 'auditable_type' => Payment::class, 'auditable_id' => $payment->id]);
    }
}
