<?php

use App\Http\Controllers\InvoiceLineController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->get('/invoice-lines', [InvoiceLineController::class, 'index']);
