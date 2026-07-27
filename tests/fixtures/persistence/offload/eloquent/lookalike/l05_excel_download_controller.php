<?php
// S0.5 fixture — LOOKALIKE: Excel::download streams the response itself — allowed, must NOT fire.
namespace App\Http\Controllers;

use App\Exports\TransactionsExport;
use Maatwebsite\Excel\Facades\Excel;

class ExportController extends Controller
{
    public function download(int $year)
    {
        return Excel::download(new TransactionsExport($year), 'transactions.xlsx');
    }
}
