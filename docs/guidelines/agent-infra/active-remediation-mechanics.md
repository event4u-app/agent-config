# Active Remediation — Mechanics

> Ladder detail, version-gated modernization, and anti-nagging guardrails for the `active-remediation` rule

_Origin: migrated from `src/rules/active-remediation.md` per the P4 pattern of `road-to-kernel-and-router.md`. The Iron Law, the ladder tier names, and the live-security carve-out stay in the rule; this file carries the per-tier criteria and the modernization gates._

## The ladder — classify, then act

### Fix now (autonomous, inline) — a bounded amendment to `minimal-safe-diff`

Allowed **only** when ALL hold — this is the testable "small + task-aligned" definition:

- **Same request path / module** as the current task (not an unrelated feature).
- **≤ ~10 changed lines** in one production file plus its test file — no wider cross-file ripple.
- **No public-API / response-shape change**, no new parameter.
- **No dependency bump, no migration, no data change.**
- **Its verification ships in the same commit** — e.g. the security fix's negative test, or the correctness fix's case.

Under those constraints the fix is auditable in the same diff and is *not* scope creep — it corrects a boundary the agent touched. Anything outside them → the fix is **note + ask**, never auto. (`minimal-safe-diff` still governs everything else: no reformatting, no opportunistic refactor, no drive-by rename.)

### Note + ask (batched)

Bigger, or diverges from the task → do **not** refactor inline, do **not** interrupt the flow. Note the site (file:line + the issue). Surface the batch as **one** numbered-options prompt (per `user-interaction`, one recommendation line) **after the task is delivered** — or mid-work only when the flow makes it natural. Each option must carry a real trade-off (`no-cheap-questions`). Refactor only on an explicit yes, as a separate scoped change (`scope-control`, `downstream-changes`).

### Propose a follow-up PR (many spots)

When the issues are too many to fold in without blowing the current diff's scope, propose **one or more separate follow-up PRs** (or a roadmap under `agents/roadmaps/`, using the shared-prefix convention) so the user reviews the changes before merge. Creating the PR/roadmap is **permission-gated** — propose, get a yes, then create (`scope-control`, `commit-policy`).

## Version-gated modernization

Update stale idioms to the version the project **actually runs** — but only when that version is **verified**:

- **Establish the version first** from the manifest constraint (`composer.json` `require`, `package.json` `engines`, `.tool-versions`, lockfile) — use the **lowest** bound; on an ambiguous/monorepo range, ask once. **Unknown version → do not touch** (must fit the project structure — this is the `source-discovery` gate).
- **Syntax-only, behavior-preserving idioms** (e.g. `array()` → `[]`, `isset($x)?$x:$d` → `$x ?? $d`, string concat → template) that are provably equivalent → treat as a small fix (auto per the ladder).
- **Behavioral changes** (`readonly`/typed properties, new language semantics) and **any dependency/version bump** → **ask only**, never auto (a version bump stays under `minimal-safe-diff`'s no-dependency-bump prohibition; a pure syntax idiom is categorically different).

## Guardrails — don't become a nagging machine

- Subordinate to `no-cheap-questions` (self-check items 3 & 14 — real trade-off, not a disguised continuation/commit ask), `autonomous-execution` (the end-of-session batch must not read as "shall I continue?"), `user-interaction`, `ask-when-uncertain` (one batched prompt = one question).
- Threshold to surface at all: a **real, nameable** improvement with a concrete benefit. Cosmetic nitpicks with no trade-off → drop silently. The live-security carve-out is the only case that interrupts or overrides autonomy.

## See also

- [`active-remediation`](../../../src/rules/active-remediation.md) — the rule this file details (Iron Law + ladder + live-security carve-out).
- [`minimal-safe-diff`](minimal-safe-diff-mechanics.md) — the diff-shape mechanics the fix-now tier amends.
