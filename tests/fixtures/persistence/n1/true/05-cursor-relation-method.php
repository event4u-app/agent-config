<?php
// FIXTURE: true-positive N+1 — cursor() source with a relation-method count query per customer.

namespace App\Services;

use App\Models\Customer;

class CustomerAuditService
{
    public function orderCounts(): array
    {
        $counts = [];
        foreach (Customer::cursor() as $customer) {
            $counts[$customer->id] = $customer->orders()->count();
        }

        return $counts;
    }
}
