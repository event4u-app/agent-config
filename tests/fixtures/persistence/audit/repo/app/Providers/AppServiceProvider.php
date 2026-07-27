<?php

namespace App\Providers;

use App\Models\Tenant;
use App\Observers\TenantObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // NOTE: only TenantObserver is registered. PaymentObserver is not.
        Tenant::observe(TenantObserver::class);
    }
}
