<?php

use Illuminate\Foundation\Application;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        then: function () {
            Route::prefix('partner')->group(base_path('routes/partner.php'));
        },
    )
    ->create();
