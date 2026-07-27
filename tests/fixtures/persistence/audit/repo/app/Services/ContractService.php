<?php

namespace App\Services;

use App\Models\Contract;

class ContractService
{
    public function open(array $data): Contract
    {
        return Contract::create($data); /* gt:covered */
    }

    public function amend(Contract $contract, array $data): Contract
    {
        $contract->update($data); /* gt:covered */
        return $contract;
    }
}
