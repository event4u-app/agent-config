> Clean by construction: an incident write-up with an inanimate grammatical
> subject used literally. Near-miss for the false-agency family.

The queue drained at 03:40 and the backlog cleared by 04:05. The alert fired
nine minutes after the first failed job, which is inside the target, and the
on-call engineer had the runbook open before the page finished escalating.

Root cause was a connection-pool limit we raised on the application side last
month and never raised on the database side. The database refused the extra
connections and the workers interpreted the refusal as a transient error and
retried, which made it worse.

Both limits now live in one config file.
