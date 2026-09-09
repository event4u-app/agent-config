# Break-Glass Usage

Guideline for operating the agent under a controlled emergency state —
when a production incident requires faster stabilization than normal
verification allows.

Break-glass is **a narrowing, not a bypass**. The rules still apply; the
gate is just smaller. Never decide to "break glass" unilaterally.

## When break-glass is justified

All of the following must hold:

- **Active customer-impacting incident** — data loss, outage, security
  exposure, billing regression. Not "we have a deadline".
- **Explicit user invocation** — the user says "break-glass" or
  "hotfix, skip the full suite". Ambiguous wording is not enough; ask.
- **No viable rollback path** that would be faster than the forward fix.

Not a break-glass situation:

- Friday afternoon and you want to ship a feature.
- CI is slow and you want to skip tests.
- You can't reproduce a flaky test locally.
- A reviewer is asleep and you want to self-approve.

## How to invoke

The user sets one of:

1. **Conversation flag** — says "break-glass: true" or "this is a hotfix".
2. **PR label** — `break-glass` on the PR (optional; the agent still
   requires explicit invocation in the current turn).
3. **Commit trailer** — `Break-Glass: <incident-id>` in the commit
   message of the hotfix.

The agent confirms: "Entering break-glass — narrowing verification to
targeted test + smoke check. Follow-up PR required within 24h. Confirm?"
If the user agrees, proceed. If not, stay in the normal gate.

## What narrows

| Layer | Normal gate | Break-glass |
|---|---|---|
| Tests | Targeted + full suite | Targeted only — covering the regression |
| Quality tools | PHPStan + Rector + ECS | Deferred to follow-up PR |
| Migrations review | Full dry-run + rollback check | Dry-run only, rollback note mandatory |
| Code review | ≥ 1 reviewer from required roles | 1 reviewer, can be post-merge |
| Changelog | Required | Deferred to follow-up PR |

Zero tests is **never** acceptable. If the incident fix genuinely cannot
be tested in the available time, document that explicitly and attach a
reproducer to the follow-up ticket.

## What does NOT narrow

These rules stay fully in force, break-glass or not:

- [`minimal-safe-diff`](../../rules/minimal-safe-diff.md) — the hotfix is
  still the **smallest** change that stops the bleeding. No drive-by
  cleanups.
- [`security-sensitive-stop`](../../rules/security-sensitive-stop.md) — a
  security-relevant change still needs the threat-model pass.
- [`scope-control`](../../rules/scope-control.md) — never mix the
  hotfix with unrelated refactors from another branch.
- [`ask-when-uncertain`](../../rules/ask-when-uncertain.md) — more
  asking, not less, when the blast radius is live.

## Required artifacts

The hotfix PR must include, in the description:

1. **Incident link** — ticket, Sentry issue, or Statuspage entry.
2. **Skipped validations** — bullet list of what was deferred (e.g.
   "full PHPUnit suite", "PHPStan", "Rector").
3. **Evidence attached in-PR** — targeted test output, smoke-check log or
   curl response, migration dry-run if applicable.
4. **Follow-up commitment** — link to the follow-up ticket or PR that
   will run the full gate. Due within 24h.

## After the incident

Within 24 hours:

1. Open the **follow-up PR** — runs the full verification gate against
   the same branch or a rebase onto main.
2. Write a short **incident note** (2–5 lines) — what failed, what the
   hotfix did, what was deferred. Store in the project's postmortem
   location.
3. If the incident exposed a recurring failure mode, add an entry to
   `historical-bug-patterns.yml` (see
   [`review-routing-data-format`](review-routing-data-format.md)).

## Anti-patterns — reject them

- "Break-glass" used as a label for every urgent task — the word stops
  meaning anything.
- Shipping the hotfix **and** a refactor in the same commit "since the
  file was open".
- Skipping the follow-up PR because "the hotfix was fine". The gate
  runs once, not zero times.
- Logging the incident as "false alarm" when the hotfix actually
  changed behavior. If behavior changed, write the note.

## See also

- [`minimal-safe-diff`](../../rules/minimal-safe-diff.md) — break-glass
  exception section.
- [`verify-before-complete`](../../rules/verify-before-complete.md) —
  break-glass reduction section.
- [`security-sensitive-stop`](../../rules/security-sensitive-stop.md).
- [`review-routing-data-format`](review-routing-data-format.md) —
  where to register newly-discovered failure modes.
