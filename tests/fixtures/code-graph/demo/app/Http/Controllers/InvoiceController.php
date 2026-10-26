<?php

namespace App\Http\Controllers;

use App\Models\Invoice;

class InvoiceController
{
    public function index()
    {
        return Invoice::orderBy('created_at')->paginate(25);
    }
}
