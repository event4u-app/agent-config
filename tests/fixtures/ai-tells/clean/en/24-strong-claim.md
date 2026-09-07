> Clean by construction: emphatic prose that carries its reason. Near-miss for
> `tell-emphasis-crutch` — the intensifiers here attach to a measured fact
> rather than standing in for one.

This one really did fail twice, which is why it is at the top of the list
rather than in the backlog. The difference is large: 40 milliseconds against
2.1 seconds on the same query.

That matters because the export runs inside the request. A user waiting two
seconds for a spinner will click again, and the second click doubles the load
that caused the delay. Fixing the query is a smaller change than adding a
queue, so we are fixing the query.
