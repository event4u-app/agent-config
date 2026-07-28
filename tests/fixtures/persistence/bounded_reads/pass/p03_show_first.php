<?php
// FIXTURE: R-A3 pass — non-list method fetching a single row.
namespace App\Http\Controllers;

use App\Models\Ticket;

class TicketController extends Controller
{
    public function show(int $id)
    {
        return Ticket::where('id', $id)->first();
    }
}
