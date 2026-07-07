# Roadmap Progress

> Auto-generated — do not edit. Regenerate with `task roadmap-progress` or by running the `update_roadmap_progress` script for your install; rewritten on every roadmap create / execute / completion change (timestamp lives in git history).
>
> 6 open roadmaps · [roadmaps/](roadmaps/) · [archive/](roadmaps/archive/) · [skipped/](roadmaps/skipped/) · [later/](roadmaps/later/) · **8** open blockers

## Overall

**81 / 128 steps done · 63%**

```text
█████████████████████████░░░░░░░░░░░░░░░   63%
```

## Open roadmaps

| # | Roadmap | Phases | Steps | Open | Done | Deferred | Cancelled | Blocker | Progress |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | [road-to-discipline-profile-tiering.md](roadmaps/road-to-discipline-profile-tiering.md) | 5 | 16 | 4 | 12 | 0 | 0 | [1](#blockers-road-to-discipline-profile-tiering) | ████████░░ 75% |
| 2 | [road-to-golden-set-coverage.md](roadmaps/road-to-golden-set-coverage.md) | 4 | 18 | 4 | 14 | 0 | 0 | [2](#blockers-road-to-golden-set-coverage) | ████████░░ 78% |
| 3 | [road-to-request-scoped-rule-load.md](roadmaps/road-to-request-scoped-rule-load.md) | 5 | 25 | 5 | 20 | 0 | 0 | [1](#blockers-road-to-request-scoped-rule-load) | ████████░░ 80% |
| 4 | [road-to-subagent-value-realization-followup.md](roadmaps/road-to-subagent-value-realization-followup.md) | 2 | 9 | 9 | 0 | 0 | 0 | [1](#blockers-road-to-subagent-value-realization-followup) | ░░░░░░░░░░ 0% |
| 5 | [road-to-token-proof-and-story.md](roadmaps/road-to-token-proof-and-story.md) | 5 | 26 | 14 | 12 | 0 | 0 | [2](#blockers-road-to-token-proof-and-story) | █████░░░░░ 46% |
| 6 | [road-to-token-saving.md](roadmaps/road-to-token-saving.md) | 7 | 36 | 11 | 23 | 0 | 2 | [1](#blockers-road-to-token-saving) | ███████░░░ 68% |

---

## Per-roadmap phase breakdown

### [road-to-discipline-profile-tiering.md](roadmaps/road-to-discipline-profile-tiering.md)

**Road to discipline-profile tiering — the ~3x lift as the default shape, host-gated** — 12 / 16 done (75%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Tier mechanism, built inert (no default change) | ✅ done | 0 | 5 | 0 | 0 | 100% |
| 2 | Retire the measured-dead `balanced` cut | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 3 | Evidence gate P1: essential on the full corpus (weak host) | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 4 | Evidence gate P2 + default flip | 🟡 in progress | 2 | 1 | 0 | 0 | 33% |
| 5 | Full-tier disposition (open-source hypothesis, gated) | ⬜ not started | 2 | 0 | 0 | 0 | 0% |

<a id="blockers-road-to-discipline-profile-tiering"></a>
**Blockers**

- **non-claude-host-adapter** (owner: maintainer) — blocks Phase 4 (P2 replication run + default flip), Phase 5
  - **What to do:**
    run needs one of: (a) a fresh interactive `codex login` (stored ChatGPT
    token expired), or (b) approving non-interactive codex runs for the agent
    session (the auto-mode permission classifier blocks `codex exec` variants),
    using the isolated API-key home (`CODEX_BENCH_HOME`). Then:
    `CODEX_BENCH_HOME=<home> npx tsx src/scripts/bench_ab_v2_run.ts --host codex
    --arms vanilla,rules-kernel-dc --seeds 3 --model gpt-5-nano --budget 3.5`.
  - **Resolved when:** the harness completes a paired vanilla-vs-essential run on a non-Claude host with the deterministic scorer.

_1 blocker resolved._

### [road-to-golden-set-coverage.md](roadmaps/road-to-golden-set-coverage.md)

**Road to golden-set coverage — make every flip verdict mean something** — 14 / 18 done (78%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Scope-aware coverage accounting | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 1 | Trigger-anchored stub drafting (consumer rules, autonomous) | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 2 | Operator labelling sprint (the human gate) | ⬜ not started | 3 | 0 | 0 | 0 | 0% |
| 3 | Prompt↔trigger falsifiability linter | 🟡 in progress | 1 | 8 | 0 | 0 | 89% |

<a id="blockers-road-to-golden-set-coverage"></a>
**Blockers**

- **operator-labelling-capacity** (owner: maintainer) — blocks Phase 2 (and thus the consumer-scope `--require-complete` flip + the live judge run at full consumer coverage)
  - **What to do:**
    (est. 2–4 h focused work; stub `notes` carry each rule's Iron-Law line as
    raw material). Batch with the operator sitting defined in
    `road-to-token-proof-and-story` Phase 1.
  - **Resolved when:** `check_token_quality_golden --require-complete --scope consumer` exits 0.
- **paid-judge-run-sequencing (soft)** (owner: maintainer) — blocks only the PAID judge run (labelling proceeds in parallel).
  - **What to do:**
    consumer-scoping default flip shrinks the eager arm (~3× cheaper,
    est. US$3–4 instead of US$8–12) — batch it into the operator sitting
    from `road-to-token-proof-and-story` § Program tracking step 2.
  - **Resolved when:** a non-dry-run `quality-run.json` from a consumer-scoped arm exists and `check_quality_regression --as-flip-gate` exits 0.

### [road-to-request-scoped-rule-load.md](roadmaps/road-to-request-scoped-rule-load.md)

**Road to request-scoped rule load — ship only what the request needs** — 20 / 25 done (80%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Workspace/pack fields into the router (schema, additive) | ✅ done | 0 | 5 | 0 | 0 | 100% |
| 1 | Consumer-scoped rule projection (the ~50k lever) | 🟡 in progress | 1 | 4 | 0 | 0 | 80% |
| 2 | Host-native activation: populate globs (deterministic) | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 3 | Pack hygiene (two confirmed misfits + one sweep) | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 4 | PARKED: rules-as-skills falsification probe (Claude Code) | 🟡 in progress | 4 | 4 | 0 | 0 | 50% |

<a id="blockers-road-to-request-scoped-rule-load"></a>
**Blockers**

- **phase-0-golden-set (inherited)** (owner: maintainer) — blocks the held-quality verification arm of Phase 1's default flip. Does **not** block Phases 0, 2, 3 or the opt-in build of Phase 1 (mechanical, CI-verified).
  - **What to do:**
    § Program tracking step 2 — label the golden stubs, run the live judge
    at `--scope consumer`, tick the live canary on 3 hosts.
  - **Resolved when:** `check_quality_regression --as-flip-gate` exits 0 on a real (non-dry-run) report — hardened criterion per `road-to-token-proof-and-story` Phase 0.

### [road-to-subagent-value-realization-followup.md](roadmaps/road-to-subagent-value-realization-followup.md)

**Follow-up to Subagent value realization** — 0 / 9 done (0%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Seed real telemetry | ⬜ not started | 3 | 0 | 0 | 0 | 0% |
| 2 | Re-gate the `auto: on` flip | ⬜ not started | 6 | 0 | 0 | 0 | 0% |

<a id="blockers-road-to-subagent-value-realization-followup"></a>
**Blockers**

- **telemetry-sample-size** (owner: user) — blocks Phase 1 — Seed real telemetry
  - **What to do:**
    1. Use the agent with `subagents.enabled: true` and `subagents.auto: ask`
    (or `on`) during real work, long enough to accumulate real orchestrated
    dispatches — the build work is done; only real usage produces this.
    2. Check the current-month audit log line count:
    `wc -l agents/runtime/state/audit/$(date +%Y-%m).jsonl`.
    3. Once the count reaches ≥ 20, resume this roadmap
    (`/roadmap:process-full road-to-subagent-value-realization-followup.md`).
  - **Resolved when:** `agents/runtime/state/audit/YYYY-MM.jsonl` carries ≥ 20 orchestration lines for the current month.

### [road-to-token-proof-and-story.md](roadmaps/road-to-token-proof-and-story.md)

**Road to token proof and story — orchestrate, prove, activate, adopt** — 12 / 26 done (46%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Harden the flip gate (small, verified, do first) | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 1 | One critical path for six tracks (the program table) | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 2 | Field evidence: replay + session telemetry | 🟡 in progress | 3 | 2 | 0 | 0 | 40% |
| 3 | Public proof refresh (benchmark, claims, release story) | ⬜ not started | 4 | 0 | 0 | 0 | 0% |
| 4 | Spend the story: one named external pilot (N=1) | 🟡 in progress | 7 | 2 | 0 | 0 | 22% |

<a id="blockers-road-to-token-proof-and-story"></a>
**Blockers**

- **flip-gates-upstream (inherited)** (owner: maintainer) — blocks Phase 2 post-flip arms and Phase 3 (need the flips landed); Phases 0, 1 and the Phase 2 corpus/tooling build are unblocked now.
  - **What to do:**
    (consumer-scoping default → discipline_profile default → thin
    un-deferral decision), each behind its own hardened gate.
  - **Resolved when:** the consumer-scoping default flip and the discipline_profile default flip have landed (thin optional — arms can run with the "modelled, not shipped" label for the thin arm).
- **field-corpus-privacy** (owner: maintainer) — blocks Phase 2 replay arms (need the exported, privacy-reviewed corpus from Galawork/event4u sessions).
  - **What to do:**
    --history <repo>/agents/runtime/.agent-chat-history --limit 200` per
    repo, then review the `.local.yaml` output under the low-impact-corpus
    privacy floor (drop/redact anything client- or person-identifying).
    Progress 2026-07-07: agent-config's own history exported (30 prompts →
    `internal/bench/corpora/field-prompts.local.yaml`, gitignored, awaiting
    review). Still needed: exports from the Galawork consumer repos (their
    history files are outside this checkout — operator run) to reach N≥100.
  - **Resolved when:** a reviewed corpus file exists and the low-impact-corpus privacy floor checklist for it is signed off.

### [road-to-token-saving.md](roadmaps/road-to-token-saving.md)

**Road to token saving — measure, then cut, at constant quality** — 23 / 34 done (68%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Measurement substrate (the prerequisite to every cut) | 🟡 in progress | 2 | 4 | 0 | 0 | 67% |
| 1 | RTK everywhere (un-gate the scope) | 🟡 in progress | 1 | 2 | 0 | 1 | 67% |
| 2 | Close the RTK trigger gap | 🟡 in progress | 1 | 2 | 0 | 0 | 67% |
| 3 | Deterministic RTK wrap hook + install verification | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 5 | Cache-aware ordering as a CI invariant (D5) | ✅ done | 0 | 2 | 0 | 1 | 100% |
| 8 | Always-loaded budget linter (D6) | 🟡 in progress | 1 | 2 | 0 | 0 | 67% |
| 10 | Token-saving backlog (extensible umbrella) | 🟡 in progress | 6 | 7 | 0 | 0 | 54% |

<a id="blockers-road-to-token-saving"></a>
**Blockers**

- **phase-0-golden-set** (owner: maintainer) — blocks Phase 0 Steps 1 + 2 (golden set + host-compliance probe), Phase 1 Step 1 (RTK golden-set run), Phase 8 Step 2 (quality-elbow threshold), and Phase 10 Step 1 (tier-conditional loading)
  - **What to do:**
    1. Build the held-out golden set of ~30 tasks spanning all 88 rules (see Phase 0 Step 1 comment — run the LIVE paired judge with `ANTHROPIC_API_KEY` set, estimated cost US$3–5).
    2. Run: `task bench:ab:value:quick` (or the full bench target) to produce `internal/bench/reports/quality-run.json`.
    3. Verify the paired judge output has the expected shape (model A vs model B, per-task scores, aggregate win rate).
    4. The hardened gate is the unlock — once it exits 0 on the real report, Phase 1 Step 1 + Phase 8 Step 2 can proceed.
  - **Resolved when:** `./scripts-run src/scripts/check_quality_regression --as-flip-gate` exits 0 AND `npx tsx tests/scripts/bench_ab_integrity.test.ts` exits 0. (Hardened 2026-07-07 per `road-to-token-proof-and-story` Phase 0 — a dry-run mock or an inconclusive report is NOT an unlock; the old "file exists" criterion was fakeable.)

---

## Ticket bundles

Materialised ticket bundles under [`agents/tickets/`](tickets/) (via `/roadmap:materialize`), counted from `agents/tickets/_registry.yml`.

| Bundle | Tickets | Status | Source roadmap |
|---|---:|---|---|
| road-to-ticket-bundles | 6 | in_progress | agents/roadmaps/archive/road-to-ticket-bundles.md |

