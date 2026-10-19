<?php

namespace App\Http\Controllers;

use App\Models\InvoiceLine;

class InvoiceLineController extends Controller
{
    public function index()
    {
        return InvoiceLine::query()->paginate(50);
    }
}
