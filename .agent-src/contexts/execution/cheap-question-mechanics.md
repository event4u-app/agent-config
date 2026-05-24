# Cheap Question Mechanics

Catalog material for [`no-cheap-questions`](../../rules/no-cheap-questions.md) — Iron Laws 3, 4, 5, 6 and the cheap-class catalog. The rule states the laws; this context carries the prose.

## Cheap classes — full catalog

Sequencing · format-only · commit / CI / test asks · fenced re-ask · Iron-Law option · context-derived · dominant option · re-ask after decline · paternalistic (IL 3) · continuation under mandate (IL 4) · prereq-for-authorized-action (IL 5) · destination-already-stated (IL 6). Extended examples: [`asking-and-brevity-examples`](../../../docs/guidelines/agent-infra/asking-and-brevity-examples.md#cheap-question-class-catalog--extended-examples).

## Iron Law 3 — No Paternalistic State-Assuming Options

```
NEVER FABRICATE USER STATE TO JUSTIFY AN OPTION.
"TAKE A BREAK", "SLEEP ON IT", "COME BACK FRESH" — FORBIDDEN.
THE USER DECIDES WHEN TO STOP.
```

## Iron Law 4 — halt conditions under autonomous mandate

### Mandate triggers

A standing autonomous mandate is active when any of these fire:

- `/roadmap:process-full` invocation.
- `/roadmap:process-phase` invocation.
- Explicit "entscheide selbst / decide and don't ask" in the current or a recent un-revoked turn.

### Halt conditions

The only halts named in the invoking command:

- **Hard Floor trigger** — bulk deletion, infra change, prod-trunk merge.
- **Council-off + ambiguity** — host can't resolve without input.
- **Security-sensitive** — auth, secrets, tenancy, public endpoints (`security-sensitive-stop`).
- **Scope out of roadmap** — work crosses the roadmap's stated bounds.
- **Test / quality RED** — failure that cannot be auto-fixed.

A clean edit-batch is not a halt condition — pick the next item.

## Iron Law 5 — prereq examples (silent execution, never a question)

When the user authorizes a top-level action ("commit", "push", "open PR", "run tests", "deploy"), the following prereq work is execution, not a decision point — never raise a numbered-options block about it:

- compression / `task sync-check-hashes` before commit
- code formatting / linter auto-fix before commit
- type-check / quality-tool repairs to clear CI gates
- test repair when the user said "commit and the tests pass"
- symlink / index regeneration after edits
- `marketplace.json` / discovery-manifest refresh
- branch-base inventory when user named the destination
- pre-push hook fix when it blocks an authorized push and the fix is obvious (gate-script update, stale pattern removal)

### Halt conditions during prereq execution

Stop and surface only on:

- **Hard Floor trigger** — bulk deletion, infra change, prod-trunk merge.
- **Test / quality RED** that cannot be auto-fixed → surface + ask.
- **Genuine ambiguity in WHAT to do** (not HOW to do it).

Everything else stays silent execution.

## Iron Law 6 — destination triggers (never re-ask)

The user has already named the destination — branch-base inventory does not fire:

- "commit in this PR" / "commit auf diesem branch"
- "commit in PR #218" / explicit PR number
- "push to `<branch>`"
- **Implicit**: user is currently ON the branch and says "commit" without a qualifier → the current branch IS the destination.

No "which branch?", no "should I open a new PR?", no branch-base inventory. `scope-control`'s branch inventory applies only when the destination is **unstated**.

## When asking IS allowed

Real architectural / scope trade-off · vague-request trigger ([`ask-when-uncertain`](../../rules/ask-when-uncertain.md)) · security-sensitive ([`security-sensitive-stop`](../../rules/security-sensitive-stop.md)) · Hard Floor ([`non-destructive-by-default`](../../rules/non-destructive-by-default.md)) · two genuinely-equivalent paths where user preference is the tiebreaker.

## See also

- [`no-cheap-questions`](../../rules/no-cheap-questions.md) — the rule.
- [`commit-policy`](../../rules/commit-policy.md) — when commit IS authorized.
- [`scope-control § git-ops`](../../rules/scope-control.md) — branch / PR permission gate (fires only when destination unstated).
