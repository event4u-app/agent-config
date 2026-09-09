# `guarded-baseline` — a sub-state of `[ ]`, never a fifth glyph

> Migrated out of [`roadmap-progress-mechanics`](roadmap-progress-mechanics.md)
> on 2026-08-31, on arrival: that file measured 15,873 of the 16,000-char
> depth ceiling, leaving 127 characters, so the section could not live there.
> The ceiling is a growth ratchet, and hitting it is the signal to split rather
> than to raise it. The glyph-semantics table there points here.

A step whose `verify:` asserts a property of a mechanism that **does not yet exist** may not close `[x]`: an executable guard proven to go RED under a named sabotage is evidence about the *guard*, not about the *absent mechanism*, and `[x]` would claim the acceptance criterion was satisfied. Such a step keeps its `[ ]` box and carries an annotation plus a structured evidence record (AI council 2026-08-31, 2/2 convergent — `anthropic/claude-sonnet-4-5` + `openai/codex-default`, option C):

~~~md
- [ ] <!-- roadmap-status: guarded-baseline -->
      **12.1** …step text…
      ```yaml
      guarded_baseline:
        category: future-mechanism   # or absence-assertion — no other value
        scope: <surfaces examined>
        command: <reproducible green command>
        red_proof: <commit, fixture, or recorded sabotage run>
        sabotage_model: <exact violation introduced>
        recheck_when: <mechanism / symbol / path trigger>
        discharged_ac: <clauses actually completed>
        pending_ac: <clauses still unexercisable>
      ```
~~~

The two categories are the discriminator, not decoration. An **`absence-assertion`** step asserts something directly observable today ("the schema has no field capable of holding prompt text") and MAY close `[x]` once sabotage-verified. A **`future-mechanism`** step asserts a property of something that does not exist ("a probe-resolvable fixture never enters the selector") and is what this sub-state exists for. No third value is accepted, and an absent `category` is a rejection rather than a default.

Tooling, all of it in `guarded_baseline.ts` and enforced by both consumers:

| Behavior | Where |
|---|---|
| Counted as **open**, never as done — the canonical box stays `[ ]` | `count_checkboxes` |
| Reported **separately**: a `## 🛡️ Guarded baselines` dashboard section plus a per-step stderr line | `update_roadmap_progress` |
| **Rejected** — exit 1, on both `--check` and a plain regen — when `red_proof` is absent, when `category` is absent or illegal, when there is no evidence block, or when the annotation sits on anything but `- [ ]` | `update_roadmap_progress` |
| Treated as **incomplete**: archival refused and the reason named | `archive_completed_roadmaps` |
| Marked **stale** once a path-shaped `recheck_when` trigger resolves in the tree. A trigger carrying **no** path token at all is reported as not machine-checkable rather than as not-stale; a trigger carrying at least one path token is decided by that path and is **not** reported, even when a companion symbol token sits beside it — a checked trigger that looks unchecked is the mirror of the failure the report exists to prevent (measured 2026-09-01: 3 of 4 reported lines were already decidable) | `guardedBaselineStaleness` |

Only verification against the real mechanism permits `[x]`. **A baseline that has not demonstrably gone RED is an ordinary open item** and must not carry the annotation at all — the sabotage-and-restore proof is the entry price, not a nice-to-have.
