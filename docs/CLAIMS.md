# Claims Ledger

> Every public-facing claim (README, docs, site, marketplace copy) that carries a
> `<!-- claim:<id> -->` marker binds here to resolvable evidence. `check_claims`
> (in `task ci`) fails the build if a markered claim has no `backed` ledger entry
> with a resolving evidence pointer. This is the package's falsifiability culture
> turned on its own marketing — **we sell honesty, so the selling is machine-checked.**
>
> Enforced by [`src/scripts/check_claims.ts`](../src/scripts/check_claims.ts).
> Roadmap: `road-to-final-state-and-market-readiness.md` Phase 1 / Track B (B1).

## How it works

- A public sentence that makes a capability or quantitative claim gets an HTML
  marker: `<!-- claim:my-claim-id -->` (invisible in rendered Markdown).
- The marker's `id` must match a `### claim: my-claim-id` block below with
  `status: backed` and a resolving `evidence` pointer.
- **Only markered claims are enforced.** Unmarkered prose is never checked — the
  ledger tightens as claims are bound over time, never retroactively breaking CI.
- `status: unbacked` entries are **inventory** (documented debt): they record a
  claim that is not yet bound. They do NOT fail the build, but markering their
  claim in prose does (forces the binding first).

## Entry schema

```
### claim: <kebab-id>
- claim: <the sentence, roughly as it appears publicly>
- kind: quant | qual | comparative
- evidence: <pointer>            # see grammar below
- status: backed | unbacked
- last_verified: <YYYY-MM-DD>
```

**Evidence-pointer grammar (v1):**

- `path/to/file.md` or `path/to/file.md:42` — the repo file exists (line advisory).
- `path/to/file.md#substring` — the file exists AND contains `substring`.
- `https://… (YYYY-MM-DD)` — external cite carrying a dated stamp (not fetched in CI).

---

## Backed claims

### claim: no-runtime-daemon
- claim: The whole layer is compiled into host agents with zero runtime daemon.
- kind: qual
- evidence: docs/contracts/no-runtime-boundary.md#file-first, no-runtime suite
- status: backed
- last_verified: 2026-07-04

### claim: surgical-uninstall
- claim: Removes only its own keys from a shared host config (matched by JSON-pointer + SHA-256), never a neighbour tool's entries.
- kind: qual
- evidence: docs/contracts/install-layout.md#JSON-pointer
- status: backed
- last_verified: 2026-07-04

### claim: discipline-lift-weak-host
- claim: On a weak host (claude-haiku-4-5) the package produces a significant, placebo-controlled discipline lift on scope/downstream traps; on a strong host the same measurement is a published null — the package transplants discipline a weak model lacks, not model intelligence.
- kind: quant
- evidence: docs/benchmark.md#weak-host-specific
- status: backed
- last_verified: 2026-07-05

---

## Unbacked inventory (documented debt — not yet markered in prose)

These are real README claims that need a durable binding before they may carry a
`<!-- claim: -->` marker. Counts are drift-prone: binding them requires a
count-source mechanism (a generated number the prose must match), which is
follow-up work (roadmap B1.2). Listed here so the debt is visible, not hidden.

### claim: skill-count
- claim: 258 skills (README hero + feature list).
- kind: quant
- evidence: needs a generated count-source binding (discovery manifest) — B1.2
- status: unbacked
- last_verified:

### claim: command-count
- claim: 162 commands.
- kind: quant
- evidence: needs a generated count-source binding (discovery manifest) — B1.2
- status: unbacked
- last_verified:

### claim: rule-count
- claim: 93 governed rules.
- kind: quant
- evidence: needs a generated count-source binding (discovery manifest) — B1.2
- status: unbacked
- last_verified:

### claim: host-agent-count
- claim: Compiled into 7+ host agents (Claude Code, Cursor, Augment, Cline, Windsurf, Copilot, Gemini).
- kind: quant
- evidence: needs binding to the projection targets list — B1.2
- status: unbacked
- last_verified:
