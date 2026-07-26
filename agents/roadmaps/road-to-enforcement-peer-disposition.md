---
complexity: lightweight
status: ready
---

# Road to enforcement-peer disposition — wire the fail-open gates, record what 9.8.0 already answered

> **Source:** a two-round source-level comparison intake plus follow-up
> (archived local-only in the processed-inbox archive; written against the
> 9.7.0 tree)
> with a ~12× smaller Python governance framework (**Source Q**) whose one
> strong axis is "prove a rule actually takes effect". ~15 recommendation
> clusters with pre-registered thresholds. **Every cluster was mapped
> against today's repo before this cut** — the headline result: 9.8.0
> already shipped the majority of the analysis's top recommendations.
> **Council:** AI council debate 2026-07-27 (anthropic/claude-sonnet-4-5 +
> openai/gpt-4o, 2 rounds; round 2 settled the chain/witness dispute:
> wire the gate, park the cryptographic mechanism). **Activated 2026-07-27 by maintainer decision.**

## Provenance

Anonymized per source-confidentiality; maintainer-recoverable link:

- Source Q: `ENC1:FhVINLo7CIflil4TWJtj7/6Iay7DmprxIKizeLxfEgTNd42GBq0Jj87syRLjWu4ljrDRDZyCabUFMtzOZyovkHoyhdyAXW+3uyIj70ZzBIFZ4TghoxWPHWAdekadQKhAsY5d`

## Goal

Close the intake honestly: record which recommendations 9.8.0 already
implemented (auditable disposition, so this analysis never gets
re-litigated), fix the small confirmed fail-open (an existing append-only
gate that no workflow invokes), extend two shipped lint families where the
contract already promises what the lint doesn't yet check, run two cheap
one-time measurements — and defer every new mechanism behind a named
trigger. A maintenance-hardening pass, not a feature sprint.

## Shipped disposition (verified against 9.8.0 — CLOSED, do not rebuild)

| Recommendation | 9.8.0 state | Note |
|---|---|---|
| `exec:` re-execution evidence for claims | SHIPPED — grammar + argv-prefix allowlist engine + CI gating + pre-registered feasibility threshold | Caveat accepted: the re-executing workflow is path-filtered to claims-adjacent files |
| `enforced_by:` + coverage report with honest `none` class | SHIPPED — resolution-over-declaration, 14/107 blocking, ratcheted, CI-wired | |
| Safety floor in subagent briefs | SHIPPED — generated floor spans in all worker prompt templates, drift-gated | Host-native spawns honestly not claimed; documented |
| Kernel-override shadowing (the analysis's own top security finding) | SHIPPED — replace-on-kernel hard-fail lint + exception registry + refuse-and-report docs | A programmatic consumer resolver is DELIBERATELY absent (agent-read layer); recorded, not a gap |
| ADR `review_trigger` lifecycle field | SHIPPED forward-only — validator + template; retrofit rejected as busywork | |
| Override refine mode + citation obligation | SHIPPED in the contract; lint covers kernel/safety-floor | Ordinary-override lint gap → Phase 1 |
| Risk-based discipline escalation (diff-risk axis) | EVIDENCE BANKED — risk-path classifier + shadow run over 99 merges (11 trust-boundary ≥ pre-registered 5); activation deliberately withheld | ROUTED: the trust-boundary escalation ADR is already scheduled in `road-to-feedback-9.8.0-followups.md` Phase 1 |
| Adversarial governance-pressure evals | SHIPPED — payload-free pressure corpus with per-fixture rule mapping, archived; live run operator-gated | User-coercion extension → deferred (below) |

## Non-goals — rejected or deferred with named triggers

- **Chain primitive + git-prefix witness (tamper evidence):** PARKED. Small
  but non-trivial new mechanism (canonical JSON, migration semantics,
  git-history witness) for a threat with zero observed instances at ~zero
  external users — unmeasurable insurance under the freeze. Design
  preserved in the source file (tmp.old) + this note. **Reopen trigger:**
  an external fork with ≥30 days of history, or a discovered append/tamper
  attempt in our own logs.
- **Deploy tiering (force-update / sidecar / wrapper):** DEFERRED — the
  premise ("users edit framework-authoritative files and silently lose
  security fixes") is unmeasurable at ~zero adopters and intersects the
  scheduled installer work. Only the drift-REPORT measurement ships
  (Phase 2). **Reopen trigger:** ≥3 external adopters, or an external
  user reports a missed security update, or the installer ADR requires it.
- **Local-model junior executor:** REJECTED. The provider-budget-balancer
  was killed by the maintainer (standing lock); a subscription-CLI
  transport (billable=false, budgeted) already exists and addresses the
  spend problem; a localhost-inference path is a new integration surface
  under the freeze. **Reopen trigger:** a real user request (issue), as a
  post-freeze contribution with maintainer-approved design.
- **Lifecycle scenario cost model (end-to-end per-task tokens as adoption
  number):** REJECTED here; it is a token-story item and that track is
  council-parked in `later/`. **Reopen trigger:** an external adopter
  explicitly asks for end-to-end cost numbers.
- **Disposition funnel / govern-audit meta-machinery:** REJECTED as
  governance-on-governance — the adversarial-review protocol
  (`road-to-self-critical.md`) already adopts the findings-ledger,
  verification obligation and measurement mandate. **Reopen trigger:** the
  protocol ships and ≥40% of its findings still lack verification/
  refutation after 60 days — then as an AMENDMENT to that protocol, never
  a parallel system.
- **User-coercion eval corpus** ("just commit it now" / "skip the gate"):
  genuine gap (only ~2 of 8 shipped pressure fixtures approximate it) but
  a new threat-model discovery effort — DEFERRED to post-freeze /
  first external adoption. **Immediate trigger:** any single observed
  successful coercion of the agent into a governance violation.
- **Phase-output compression:** no-op — already house style
  (`direct-answers` brevity laws).

## Phase 1 — Wire the fail-open, extend the shipped lints

- [ ] **Wire `check_memory --append-only`** into the workflow/taskfile
  chain that guards `agents/memory/intake/*.jsonl` — the check exists in
  code and NOTHING invokes it with the flag (confirmed fail-open;
  bug-fix tier).
  *Verify:* seeded non-append edit fails the gate (red/green); the
  invoking workflow/task is named.
- [ ] **Governed-writes lint:** static scan flagging direct write patterns
  to protected ledger/governance surfaces (claims ledger, bench index,
  chained/append-only files) that bypass the atomic-write/hook layer;
  extends the existing lint family, allowlist-free start.
  *Verify:* seeded direct-write fixture flagged; **pre-registered null:**
  zero findings across the codebase = SUCCESS (validates existing
  hygiene), recorded as such — not wasted work.
- [ ] **Ordinary-override citation lint:** extend the shipped
  kernel-override guard so the citation obligation the override contract
  already imposes on ALL overrides is linted on ordinary overrides too
  (today: doc-contract only).
  *Verify:* fixture override without `> Overrides: … — <reason>` flagged;
  kernel behavior unchanged.

## Phase 2 — Cheap one-time measurements

- [ ] **Installer drift report (measurement, not tiering):** on
  install/update, report which framework-authoritative files were locally
  modified — non-blocking telemetry folded into the release-install E2E
  work (`road-to-credible-install.md` Phase 0 owns that harness). This
  MEASURES the deploy-tiering premise instead of building on it.
  *Verify:* seeded local modification appears in the report on a test
  install.
- [ ] **Impossible-cycles one-time audit:** sweep for gates that require a
  state another rule forbids reaching (the analysis's deadlock class);
  document findings; NOT a recurring lint (governance-on-governance)
  unless a cycle is actually found.
  *Verify:* audit note committed; **pre-registered null:** "no cycles
  detected as of this sweep" is a useful negative result.

## Phase 3 — Intake honesty records

- [ ] **This disposition is the record** — the shipped table above +
  rejected/deferred triggers make the intake auditable; add one line to
  the enforcement/claims docs where the analysis's two honest caveats
  live on: the `exec:` workflow path-filter and the host-native-spawn
  floor gap are ACCEPTED, documented limitations, not silent ones.
  *Verify:* both caveats stated on the relevant doc surfaces.
- [ ] **"What you get" table format as adoption input:** every row names a
  PREVENTED FAILURE MODE (not a feature), every cell backed by a
  resolving ledger entry — filed as input to the adoption roadmap's
  exhibit set (`road-to-adoption-without-narrative-debt.md`), where the
  post-hardening line "N of 107 rules have a mechanical backstop, and the
  claim itself re-runs in CI" becomes claimable.
  *Verify:* input filed; no cell without a ledger entry.

## Acceptance criteria (roadmap-level)

1. The append-only gate actually fires in CI/workflow (no fail-open), and
   both new lints are wired with red/green fixtures (Phase 1).
2. The two measurements ran once with their pre-registered nulls honored
   (Phase 2).
3. Every intake cluster has exactly one recorded disposition — shipped /
   wired-now / measured / rejected-with-trigger / routed — and nothing
   parked was silently rebuilt (Phase 3 + this file).
4. All standing locks respected: provider-balancer stays killed,
   token-story stays parked, freeze unblock list unchanged, K1 activation
   stays with its scheduled ADR, consumer override resolver stays
   deliberately absent.
