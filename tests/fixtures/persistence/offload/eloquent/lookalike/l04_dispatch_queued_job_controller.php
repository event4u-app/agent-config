<?php
// S0.5 fixture — LOOKALIKE: controller dispatching a ShouldQueue job — the right pattern, must NOT fire.
namespace App\Http\Controllers;

use App\Jobs\GenerateAnnualReport;

class ReportController extends Controller
{
    public function generate(int $year)
    {
        GenerateAnnualReport::dispatch($year);
        dispatch(new GenerateAnnualReport($year - 1));
        return response()->json(['queued' => true], 202);
    }
}
