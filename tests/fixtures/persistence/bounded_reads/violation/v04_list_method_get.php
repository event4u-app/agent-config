<?php
// FIXTURE: R-A3 violation — listAll() method returning unbounded ->get().
namespace App\Http\Controllers;

use App\Models\Ticket;

class TicketController extends Controller
{
    public function listAll()
    {
        return Ticket::query()->with('assignee')->get();
    }
}
