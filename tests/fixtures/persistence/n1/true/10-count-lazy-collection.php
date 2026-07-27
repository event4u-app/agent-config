<?php
// FIXTURE: true-positive N+1 — php count() over a lazy relation collection per ticket.

namespace App\Services;

use App\Models\Ticket;

class TicketMetricsService
{
    public function commentCounts(): array
    {
        $counts = [];
        $tickets = Ticket::all();
        foreach ($tickets as $ticket) {
            $counts[$ticket->id] = count($ticket->comments);
        }

        return $counts;
    }
}
