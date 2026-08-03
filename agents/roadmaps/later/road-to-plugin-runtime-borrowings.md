---
complexity: structural
status: later
---

# Road to plugin-runtime borrowings — seven mechanisms from an external host-plugin reference (Source A)

> **Parked per
> [`ADR-206`](../../../docs/decisions/ADR-206-harvest-freeze-resume-conditions.md)
> (harvest freeze; council disposition 2026-08-03).** All seven borrows are
> purely additive with zero recorded internal failures cited — and the
> council's sharper point stands: "falsification spikes" means feasibility is
> itself unproven; the freeze does not admit borrows that *might* work.
> Re-audited item-granularly on 2026-08-03: 0 EXTRACT, 0 LATENT-CANDIDATE,
> 7 STAY (see ADR-206 § Consequences).
>
> **Resume when:** the ADR-206 exit fires (external adopter OR the internal
> arm), AND each resumed item satisfies ADR-206 Amendment C (pre-dating
> failure finding) or Amendment D (pre-registered red test) — or a fresh
> council pass admits it as deliberately additive post-freeze.
>
> **Source identity:** an external host-plugin runtime reference ("Source A",
> Apache-2.0 + NOTICE — pattern adoption free; verbatim code needs
> attribution). The raw analysis with the source name, pinned commit, and
> file-level evidence is maintainer-local and gitignored, per
> source-confidentiality.

## Verified borrow candidates (source-level evidence in the local analysis)

| ID | Mechanism | Verdict at analysis time | Freeze status |
|----|-----------|--------------------------|---------------|
| B1 | Stop-hook review gate — opt-in `Stop` hook adversarially reviews the previous turn; grounding rule: verify edits from repo state, never from assistant self-report; non-edit turns short-circuit to allow | Borrow, inverted: deterministic verifier first, council escalation capped (max 1/stop, 300 s vs the original 900 s) | frozen — additive |
| B2 | Tracked-jobs subsystem — workspace-scoped state dir, per-job JSON + append log, MAX_JOBS pruning, progress preview from log tail | Borrow — but primarily an agent-switch session-handoff need | frozen — additive (cross-project) |
| B3 | Broker lifecycle — detached app-server over Unix socket, PID file, readiness polling, reuse-if-alive, clean teardown | Borrow behind a latency spike (kill if median saving < 300 ms/call); spawn must go through `hardenedSpawnEnv()` — the reference's `env: process.env` passthrough is the exact inheritance pattern closed in 9.6.0 | frozen — additive; also touches the no-runtime boundary |
| B4 | Schema-enforced review output — JSON Schema 2020-12 as `outputSchema`; verdict enum, findings with severity/file/line/confidence, `additionalProperties: false` | Borrow: council findings become machine-checkable (Claims-Ledger-compatible); per-provider conformance gate ≥95% | frozen — additive |
| B5 | Prompt-block taxonomy as lintable artifact — fixed blocks (task / output contract / follow-through / verification loop / grounding rules / action safety) required per task class | Borrow as house lint | frozen — additive |
| B6 | Path-confined session import — `realpathSync` on source AND allowed root, then `path.relative` containment (symlink-escape-safe) | Borrow — CWE-22/59 adjacent; 4-case escape battery | frozen here — **note:** the repo-side portion was EXTRACTED in PR #1120 (`road-to-release-truth.md` Phase 3, symlink battery for the count/catalog walkers — closes the recorded PR #1105 finding); only the cross-project session-import surface stays parked |
| B7 | Thin-forwarding-wrapper subagent contract — exactly one tool call, no repo inspection, no commentary, routing flags stripped from task text | Borrow as template (anti-scope-creep, token saving) | frozen — additive |

**Rejected at analysis time (do not resurrect):** the reference's
`ALLOW:`/`BLOCK:` first-line text protocol (brittle prefix parsing —
superseded by B4's schema) and its permissive session-filter fallback (no
session ID → returns ALL jobs; the safe inversion is empty-set + warning).

## Plan sketch preserved for resume (re-plan against the then-current tree)

- Phase 0: four falsification spikes with pre-registered kill criteria —
  S1 broker latency (kill < 300 ms median saving), S2 per-provider
  `outputSchema` conformance (kill a lane < 95%/20 runs), S3 stop-gate
  dry-run on the last 10 real PRs (kill > 20% false blocks), S4
  symlink-escape battery 4/4.
- Phase 1: B2 + B6 job persistence & path confinement (agent-switch first).
- Phase 2: B4 schema-enforced council findings (`council-finding.schema.json`
  superset; non-conforming output discarded + counted, never coerced;
  honest-null path: no quality delta → keep for machine-readability only,
  labelled an interoperability win).
- Phase 3: B1 verifier-backed stop gate, default-off, pre-registered budget
  (≤30 s deterministic-only, ≤180 s with escalation, hard 300 s), acceptance
  ≥60% injected-defect block at ≤10% false-block — below either threshold the
  feature stays default-off permanently with published numbers.
- Phase 4: B3 broker (conditional on S1), `hardenedSpawnEnv()` as a hard
  review gate.
- Phase 5: B5 prompt-block lint + B7 thin-dispatch template (honest-null path:
  token saving < 5% → publish and keep only the scope-creep guarantee).

Blockers inherited at analysis time: model-id verification and
benchmark-spend authorization (open blockers of the team-mode track); NOTICE
propagation if any verbatim code is adopted (default: pattern
re-implementation).
