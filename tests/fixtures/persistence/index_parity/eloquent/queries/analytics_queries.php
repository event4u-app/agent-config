<?php

// Fixture for spike S0.2 (index parity) — road-to-scale-and-history-discipline.
// Expectations per query:
//   L16  analytics_events.session_id -> resolved + NOT indexed, but WAIVED
//        via the `no-index` comment directly above           => WAIVED (no gate)
//   L21  analytics_events.event_type -> resolved + indexed   => OK

use App\Models\AnalyticsEvent;

function events_for_session(string $sessionId)
{
    // no-index: read-heavy analytics column
    return AnalyticsEvent::where('session_id', $sessionId)->get();
}

function click_events()
{
    return AnalyticsEvent::where('event_type', 'click')->get();
}
