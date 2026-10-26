<?php

namespace App\Console\Commands;

use App\Models\Coupon;
use Illuminate\Console\Command;

class PruneCoupons extends Command
{
    protected $signature = 'coupons:prune';

    public function handle(): int
    {
        Coupon::where('expires_at', '<', now())->delete();

        return self::SUCCESS;
    }
}
