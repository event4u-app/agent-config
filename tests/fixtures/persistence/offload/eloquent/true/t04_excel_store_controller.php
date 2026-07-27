<?php
// S0.5 fixture — TRUE F9: heavy Excel::store export generated in the handler.
namespace App\Http\Controllers;

use App\Exports\TransactionsExport;
use Maatwebsite\Excel\Facades\Excel;

class ReportController extends Controller
{
    public function generate(int $year)
    {
        Excel::store(new TransactionsExport($year), "reports/transactions-{$year}.xlsx");
        return response()->json(['queued' => false, 'stored' => true]);
    }
}
