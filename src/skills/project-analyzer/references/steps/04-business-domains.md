# Phase 4: Business domains

- Identify domains from models, services, routes, and directory structure
- For each domain: map models → services → controllers → jobs → events
- Document business rules and data flows
- Document inter-domain dependencies
- **Output:** `agents/evidence/analysis/domains/{domain}.md` (one per domain)
- **No such layer**: write `agents/evidence/analysis/domains/not-applicable.md` naming why — the exit checks the output exists, and an absent layer is a finding, not a skipped step.
