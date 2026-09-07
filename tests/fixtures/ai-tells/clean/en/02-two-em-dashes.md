> Clean by construction: a real editorial paragraph carrying two em dashes over
> enough words to stay under the density cap. Near-miss for the dash rule.

The rollback took eleven minutes, which is longer than the runbook promises —
the runbook assumes the cache is warm, and after a cold start it is not. We
have two options. Either we warm the cache as part of the deploy, which costs
about ninety seconds on every release, or we change the number in the runbook
and stop pretending eleven minutes is a regression.

I would rather change the number. The eleven minutes are not the problem; the
promise was — and a promise nobody can keep is worse than a slower one that
holds. We will revisit it if a customer ever notices the difference, and so far
none has. The runbook edit is one line and the deploy change is not.
