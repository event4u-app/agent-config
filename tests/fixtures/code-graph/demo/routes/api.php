<?php

use App\Http\Controllers\StockController;
use Illuminate\Support\Facades\Route;

Route::get('/api/stock/{sku}', [StockController::class, 'show']);
