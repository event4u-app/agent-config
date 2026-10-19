<?php

use App\Http\Controllers\RemittanceController;
use Illuminate\Support\Facades\Route;

Route::post('/remittances', [RemittanceController::class, 'store']);
