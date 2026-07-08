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

### claim: essential-tier-cost-factor
- claim: The lift-carrying essential cut (kernel + downstream-changes) keeps a significant weak-host discipline lift at a fraction of the full load's tokens, and the lift is FAMILY- and HOST-SCOPED — measured on three hosts: claude-haiku-4-5 (weak) shows the family-scoped lift (trapE 0.533→1.000, 7/7 discordant, corpus cost 1.71x); claude-sonnet-4-6 (strong) is a ceiling null; gpt-5-mini (non-Claude weak, codex prompt-prepend surface) FAILED replication with headroom (corpus Δ=+0.024 p=0.70, capability trend n.s. — no harm claimed, injection-surface confound documented). Therefore discipline_profile: auto enables the lift only where measured (vendor-granular unknown_defaults). Non-claims — the balanced router profile was removed after a NULL measurement (p=0.81, n=24); no full-tier recommendation exists; no cross-vendor lift is claimed.
- kind: quant
- evidence: docs/benchmark.md#REPLICATION FAILED
- status: backed
- last_verified: 2026-07-07

### claim: downshift-cost-reduction
- claim: On the READ-ONLY FAN-OUT slice family, tier-downshifted subagent dispatch (lite/haiku vs session-tier-proxy sonnet) nets a ≥30% USD-weighted token-cost reduction at held quality — measured 2026-07-08 (n=10 paired live dispatches, 20 telemetry lines): 10/10 exact-match on BOTH arms, 29.4% fewer raw tokens, 76.5% USD-weighted cost reduction at the 3x haiku↔sonnet price ratio. FAMILY-SCOPED — the mechanical-edit family is unmeasured and its downshift (incl. the deferred tier downgrades of existing units) stays gated. Negative control held: an open-ended synthesis/unknown slice never resolves below the session tier (inferSliceTier → medium/inherit, never lite).
- kind: quant
- evidence: internal/bench/routing-downshift/results-2026-07-08.md#FAMILY-SCOPED PROVE
- status: backed
- last_verified: 2026-07-08

### claim: eval-coverage-ratcheted
- claim: Behavioural-eval coverage is measured per tier and CI-ratcheted so it can only rise; the current coverage and its gap are published, never implied as "264 evaluated skills".
- kind: qual
- evidence: src/scripts/skill_eval_coverage.ts#checkRatchet
- status: backed
- last_verified: 2026-07-08

### claim: domain-soundness-scoped
- claim: The non-coding domain skills (finance/founder/ops/content) are forged on TS/PHP and labeled unvalidated until they pass a sourced domain-truth fixture; no public prose implies proven domain correctness, and the validated count is CI-ratcheted.
- kind: qual
- evidence: src/scripts/domain_soundness_status.ts#checkRatchet
- status: backed
- last_verified: 2026-07-08

---

## Unbacked inventory (documented debt — not yet markered in prose)

These are real README claims that need a durable binding before they may carry a
`<!-- claim: -->` marker. Counts are drift-prone: binding them requires a
count-source mechanism (a generated number the prose must match). That
mechanism now exists (road-to-truth-and-reference-hygiene Phase 1):
`update_counts.ts` generates every prose count from source, and
`check_artefact_count_messaging.ts` fails CI on any count-shaped prose
mention that drifts or is internally inconsistent — so the three count
claims below are `backed`. Remaining entries are listed so the debt is
visible, not hidden.

### claim: skill-count
- claim: 264 skills (README hero + feature list).
- kind: quant
- evidence: src/scripts/check_artefact_count_messaging.ts#Artefact-count messaging gate
- status: backed
- last_verified: 2026-07-08

### claim: command-count
- claim: 172 commands.
- kind: quant
- evidence: src/scripts/check_artefact_count_messaging.ts#Artefact-count messaging gate
- status: backed
- last_verified: 2026-07-08

### claim: rule-count
- claim: 95 governed rules.
- kind: quant
- evidence: src/scripts/check_artefact_count_messaging.ts#Artefact-count messaging gate
- status: backed
- last_verified: 2026-07-08

### claim: host-agent-count
- claim: Compiled into 7+ host agents (Claude Code, Cursor, Augment, Cline, Windsurf, Copilot, Gemini).
- kind: quant
- evidence: stays unbacked pending a machine-readable projection-targets list — the concrete binding artifact is `src/config/surface-matrix.yml` (authored by road-to-install-path-convergence Phase 2, per the 2026-07-07 install-path council); once it exists, bind the count to that file and flip. Triaged 2026-07-08 (truth-and-reference-hygiene P3): do NOT bind to prose host tables (`docs/enforcement-by-host.md`) — a substring pointer cannot verify a count.
- status: unbacked
- last_verified:
