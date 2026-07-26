# Roadmap Progress

> Auto-generated — do not edit. Regenerate with `task roadmap-progress` or by running the `update_roadmap_progress` script for your install; rewritten on every roadmap create / execute / completion change (timestamp lives in git history).
>
> 13 open roadmaps · [roadmaps/](roadmaps/) · [archive/](roadmaps/archive/) · [skipped/](roadmaps/skipped/) · [later/](roadmaps/later/) · **15** open blockers

## Overall

**107 / 216 steps done · 50%**

```text
████████████████████░░░░░░░░░░░░░░░░░░░░   50%
```

## Open roadmaps

| # | Roadmap | Phases | Steps | Open | Done | Deferred | Cancelled | Blocker | Progress |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | [road-to-ac-embeddable-gui.md](roadmaps/road-to-ac-embeddable-gui.md) | 4 | 30 | 28 | 2 | 0 | 0 | [2](#blockers-road-to-ac-embeddable-gui) | █░░░░░░░░░ 7% |
| 2 | [road-to-adoption-without-narrative-debt.md](roadmaps/road-to-adoption-without-narrative-debt.md) | 5 | 16 | 7 | 9 | 0 | 0 | [1](#blockers-road-to-adoption-without-narrative-debt) | ██████░░░░ 56% |
| 3 | [road-to-ci-native-release-first-run.md](roadmaps/road-to-ci-native-release-first-run.md) | 2 | 8 | 8 | 0 | 0 | 0 | 0 | ░░░░░░░░░░ 0% |
| 4 | [road-to-ecosystem-harvest-prose-authenticity.md](roadmaps/road-to-ecosystem-harvest-prose-authenticity.md) | 1 | 10 | 1 | 9 | 0 | 0 | 0 | █████████░ 90% |
| 5 | [road-to-gated-reach-followup.md](roadmaps/road-to-gated-reach-followup.md) | 1 | 12 | 12 | 0 | 0 | 0 | [1](#blockers-road-to-gated-reach-followup) | ░░░░░░░░░░ 0% |
| 6 | [road-to-maintainer-bus-factor.md](roadmaps/road-to-maintainer-bus-factor.md) | 4 | 12 | 5 | 7 | 0 | 0 | [1](#blockers-road-to-maintainer-bus-factor) | ██████░░░░ 58% |
| 7 | [road-to-orchestration-scope-decision.md](roadmaps/road-to-orchestration-scope-decision.md) | 4 | 10 | 6 | 4 | 0 | 0 | [1](#blockers-road-to-orchestration-scope-decision) | ████░░░░░░ 40% |
| 8 | [road-to-reciprocal-ecosystem.md](roadmaps/road-to-reciprocal-ecosystem.md) | 4 | 18 | 18 | 0 | 0 | 0 | [2](#blockers-road-to-reciprocal-ecosystem) | ░░░░░░░░░░ 0% |
| 9 | [road-to-request-scoped-rule-load.md](roadmaps/road-to-request-scoped-rule-load.md) | 7 | 37 | 2 | 34 | 0 | 1 | [1](#blockers-road-to-request-scoped-rule-load) | █████████░ 94% |
| 10 | [road-to-subagent-value-realization-followup.md](roadmaps/road-to-subagent-value-realization-followup.md) | 2 | 9 | 6 | 3 | 0 | 0 | [1](#blockers-road-to-subagent-value-realization-followup) | ███░░░░░░░ 33% |
| 11 | [road-to-surface-consolidation.md](roadmaps/road-to-surface-consolidation.md) | 2 | 13 | 5 | 6 | 2 | 0 | [3](#blockers-road-to-surface-consolidation) | ██████░░░░ 55% |
| 12 | [road-to-team-mode.md](roadmaps/road-to-team-mode.md) | 7 | 39 | 6 | 31 | 2 | 0 | [2](#blockers-road-to-team-mode) | ████████░░ 84% |
| 13 | [road-to-tier-removal.md](roadmaps/road-to-tier-removal.md) | 4 | 7 | 5 | 2 | 0 | 0 | 0 | ███░░░░░░░ 29% |

---

## Per-roadmap phase breakdown

### [road-to-ac-embeddable-gui.md](roadmaps/road-to-ac-embeddable-gui.md)

**Road to an embeddable AC GUI — host-ready without weakening a single security invariant** — 2 / 30 done (7%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Falsification spike | 🟡 in progress | 1 | 2 | 0 | 0 | 67% |
| 1 | Embed mode (`?embed=1`) | ⬜ not started | 5 | 0 | 0 | 0 | 0% |
| 2 | Framing stance + theme contract | ⬜ not started | 8 | 0 | 0 | 0 | 0% |
| 3 | Capability discovery + host lifecycle | ⬜ not started | 14 | 0 | 0 | 0 | 0% |

<a id="blockers-road-to-ac-embeddable-gui"></a>
**Blockers**

- **framing-security-verdict** (owner: maintainer (security role)) — blocks — (was: the framing half of Phase 2) - **Decision:** **no iframe framing — ship an explicit `frame-ancestors 'none'`.** Council convergence: framing is an engineering-economics question, not a security one (any same-user local process is already inside the trust boundary); the real cost is the three-webview CSP compatibility matrix, and the deterministic stance is the smallest surface. Hosts load the UI **top-level** (a host-managed child webview or separate window pointed at the same URL — `frame-ancestors` does not gate top-level loads), which keeps the embed-mode/theme/capability contract fully useful. Token transport: keep the existing `?token=` bootstrap, hardened by the SPA stripping the token from the URL after boot; the session-cookie endpoint was rejected as the costlier surface (CSRF assessed a non-issue for a loopback-only server, but the new endpoint + second credential type is avoidable entirely). Divergence recorded: one member preferred header-silence as "smallest surface" — rejected because this roadmap's acceptance criteria rule out silence; both members pick DENY when an explicit stance is required.
  - **What to do:**
  - **Resolved when:** ~~a decision record exists~~ — this entry is the record. The council transcript is not cited by path: council output is gitignored and auto-pruned, so the durable trace is the date + members above.
- **cross-platform-webview-verification** (owner: maintainer) — blocks — (was: scoping the top-level-load guidance per platform) - **Decision:** hosts use the stable separate `WebviewWindow` transport on all platforms (unstable child-webview API rejected — open upstream bugs on every engine); top-level plain-HTTP loopback is a secure context per spec and Tauri's own dev-flow precedent. The thin residual (live per-platform QA) lives in S0.1 as an ordinary verification item, not a blocker. Council transcript not cited by path (gitignored, auto-pruned); the date + composition above are the durable trace.
  - **What to do:**
  - **Resolved when:** ~~per-OS top-level-load behaviour is recorded~~ — decided; S0.1 records the QA pass.

### [road-to-adoption-without-narrative-debt.md](roadmaps/road-to-adoption-without-narrative-debt.md)

**Road to adoption without narrative debt — win users on the proof identity, not on unbacked headline numbers** — 9 / 16 done (56%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Quick wins already verified missing (autonomous, hours not weeks) | 🟡 in progress | 2 | 1 | 0 | 0 | 33% |
| 1 | One 30-second wedge, not the whole platform | 🟡 in progress | 1 | 3 | 0 | 0 | 75% |
| 2 | Discoverability where the category is browsed | 🟡 in progress | 2 | 1 | 0 | 0 | 33% |
| 3 | Turn the proof surface into the differentiator narrative | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 4 | Convert the wedge to the platform (measured, not assumed) | ⬜ not started | 2 | 0 | 0 | 0 | 0% |

<a id="blockers-road-to-adoption-without-narrative-debt"></a>
**Blockers**

- **real-external-participant** (owner: user) — blocks Phase 1 (B9 real session) and thereby the Phase 2 launch story's install-friction evidence
  - **What to do:**
    an agent) for a ~30-minute wedge-install session per
    `agents/recruit-sessions/_install-friction-runbook.md`. This cannot be
    produced by the repo itself — it is the single most-repeated open ask across
    all external reviews of 8.0.0.
  - **Resolved when:** ≥1 completed session record exists under `agents/recruit-sessions/` with findings distributed per `_findings-distribution.md`.

_2 blockers resolved._

### [road-to-ci-native-release-first-run.md](roadmaps/road-to-ci-native-release-first-run.md)

**Follow-up to CI-native release — first live run + drills** — 0 / 8 done (0%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Post-merge dry-run verification (carried from parent Phase 3) | ⬜ not started | 1 | 0 | 0 | 0 | 0% |
| 2 | First real release + live drills (carried from parent Phase 4 + Phase 7) | ⬜ not started | 7 | 0 | 0 | 0 | 0% |

### [road-to-ecosystem-harvest-prose-authenticity.md](roadmaps/road-to-ecosystem-harvest-prose-authenticity.md)

**Ecosystem-Harvest — Prose Authenticity** — 9 / 10 done (90%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Adopt-now plate (≤ 3 units) | 🟡 in progress | 1 | 9 | 0 | 0 | 90% |

### [road-to-gated-reach-followup.md](roadmaps/road-to-gated-reach-followup.md)

**Follow-up to Road to gated reach — exercise the YouTube channel** — 0 / 12 done (0%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | YouTube — exercise and score the channel | ⬜ not started | 12 | 0 | 0 | 0 | 0% |

<a id="blockers-road-to-gated-reach-followup"></a>
**Blockers**

- **legacy** (owner: user) — blocks entire roadmap
  - **What to do:**
    `yt-dlp` and a JavaScript runtime are installed **by a human** on
  - **Resolved when:** condition described above clears

### [road-to-maintainer-bus-factor.md](roadmaps/road-to-maintainer-bus-factor.md)

**Road to maintainer bus-factor — make the project reviewable and inheritable, and dogfood its own review machinery** — 7 / 12 done (58%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Dogfood the review machinery as a pre-merge gate | 🟡 in progress | 2 | 2 | 0 | 0 | 50% |
| 2 | CODEOWNERS + branch protection | 🟡 in progress | 1 | 2 | 0 | 0 | 67% |
| 3 | Make a release inheritable (the runbook) | 🟡 in progress | 1 | 2 | 0 | 0 | 67% |
| 4 | Lower bus-factor toward >1 (opportunistic, honest) | 🟡 in progress | 1 | 1 | 0 | 0 | 50% |

<a id="blockers-road-to-maintainer-bus-factor"></a>
**Blockers**

- **second-reviewer-availability** (owner: maintainer) — blocks Phase 4 (the >1 target only)
  - **What to do:**
    opportunistic and gated on real external interest (couples to the adoption
    roadmap). Phases 1–3 do NOT depend on it — reviewability and inheritability are
    achievable solo.
  - **Resolved when:** ≥1 non-maintainer has reviewed a merged PR, or the phase is explicitly deferred pending adoption.

_1 blocker resolved._

### [road-to-orchestration-scope-decision.md](roadmaps/road-to-orchestration-scope-decision.md)

**Road to orchestration scope decision — one falsifiable minimal claim, or an honest exit from the front** — 4 / 10 done (40%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Pre-commit the falsifiable minimal claim | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 2 | Accumulate real telemetry (inherits parent followup) | 🟡 in progress | 1 | 1 | 0 | 0 | 50% |
| 3 | Gate the claim: prove or drop | ⬜ not started | 3 | 0 | 0 | 0 | 0% |
| 4 | Position the minimalism (only after Phase 3 resolves) | ⬜ not started | 2 | 0 | 0 | 0 | 0% |

<a id="blockers-road-to-orchestration-scope-decision"></a>
**Blockers**

- **real-orchestration-usage** (owner: user) — blocks Phase 2 (and thereby Phase 3's decision)
  - **What to do:**
    telemetry. Use the agent on genuinely parallel/ordered multi-file tasks under
    the post-ADR-117 default (`subagents.auto: on`), then check
    `wc -l agents/runtime/state/audit/$(date +%Y-%m).jsonl`. Resume at ≥20.
  - **Resolved when:** the current-month audit log holds ≥20 orchestration lines.

### [road-to-reciprocal-ecosystem.md](roadmaps/road-to-reciprocal-ecosystem.md)

**Road to a reciprocal ecosystem — AC recommends AS the way AS already recommends AC** — 0 / 18 done (0%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Falsification spike | ⬜ not started | 1 | 0 | 0 | 0 | 0% |
| 1 | Detection + the single card | ⬜ not started | 4 | 0 | 0 | 0 | 0% |
| 2 | Behave correctly under AS (the part that is not promotion) | ⬜ not started | 4 | 0 | 0 | 0 | 0% |
| 3 | Symmetry in the docs | ⬜ not started | 9 | 0 | 0 | 0 | 0% |

<a id="blockers-road-to-reciprocal-ecosystem"></a>
**Blockers**

- **restraint-review** (owner: maintainer) — blocks — (was: Phase 1 shipping at all) - **Decision:** affirmed — the distribution value outweighs the surface cost. Phase 1 ships, under the unchanged hard bound: **one card, one surface, self-retiring, permanently dismissible, no second placement ever.**
  - **What to do:**
  - **Resolved when:** ~~the decision is recorded either way~~ — recorded here.
- **adoption-measurement** (owner: user) — blocks knowing whether reciprocal promotion moves anything
  - **What to do:**
  - **Resolved when:** ≥1 external user reports (issue/discussion/direct message) arriving at either package through the other.

### [road-to-request-scoped-rule-load.md](roadmaps/road-to-request-scoped-rule-load.md)

**Road to request-scoped rule load — ship only what the request needs** — 34 / 36 done (94%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Workspace/pack fields into the router (schema, additive) | ✅ done | 0 | 5 | 0 | 0 | 100% |
| 1 | Consumer-scoped rule projection (the ~50k lever) | ✅ done | 0 | 5 | 0 | 0 | 100% |
| 1b | Pipeline B: make scoping reach actual consumer installs | ✅ done | 0 | 5 | 0 | 0 | 100% |
| 2 | Host-native activation: populate globs (deterministic) | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 3 | Pack hygiene (two confirmed misfits + one sweep) | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 4 | PARKED: rules-as-skills falsification probe (Claude Code) | ⬜ not started | 1 | 0 | 0 | 0 | 0% |
| 5 | P4 rule-body migration batches (feedback-8.11 routing, 2026-07-12) | 🟡 in progress | 1 | 12 | 0 | 1 | 92% |

<a id="blockers-road-to-request-scoped-rule-load"></a>
**Blockers**

- **phase-0-golden-set (inherited)** (owner: maintainer) — blocks the held-quality verification arm of Phase 1's default flip — the flip therefore needs a DETERMINISTIC verification arm (anchor-scoring) instead of the retired LLM-judge batch; it stays evidence-blocked until one is built and run. Does **not** block Phases 0, 2, 3 or the opt-in build of Phase 1 (mechanical, CI-verified).
  - **What to do:**
    labelled golden set; the live 3-host canary tick stays as the second half.
  - **Resolved when:** `check_quality_regression --as-flip-gate` exits 0 on a real (non-dry-run) report — hardened criterion per `road-to-token-proof-and-story` Phase 0. - **Evidence update 2026-07-11 (real run landed — gate is RED, not just pending):** the consumer golden set is complete (PR #885) and a full sonnet n=90 `check_quality_regression --as-flip-gate` ran (PR #887). It **FAILS** (thin win-rate 36.2% < 48% floor; length-confound 60%, judge inconsistency 31%). CAVEAT: that run measured the **thin** projection (kernel bodies + non-kernel pointers), NOT this roadmap's **workspace-scoping** reduction — a milder, different cut with **no dedicated arm** in `bench_quality_run` yet. So the held-quality arm is **not** directly resolved, but the strongest same-class reduction failed the gate decisively → treat context-reduction-for-tokens as **quality-risky by prior** on this eval. **Disposition (maintainer, 2026-07-11): do NOT spend another ~$33 on a workspace-scoped arm** that shares the same verbosity confound and would most likely reconfirm the negative; the Phase-1 DEFAULT flip stays **evidence-blocked**. The opt-in build path is unaffected (per Blocks above). Revisit only with a length-normalised arm that kills the confound.

### [road-to-subagent-value-realization-followup.md](roadmaps/road-to-subagent-value-realization-followup.md)

**Follow-up to Subagent value realization** — 3 / 9 done (33%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Seed real telemetry | 🟡 in progress | 1 | 2 | 0 | 0 | 67% |
| 2 | Confirm or demote the ADR-117 `auto: on` default | 🟡 in progress | 5 | 1 | 0 | 0 | 17% |

<a id="blockers-road-to-subagent-value-realization-followup"></a>
**Blockers**

- **telemetry-sample-size** (owner: user) — blocks Phase 1 — Seed real telemetry
  - **What to do:**
    1. Use the agent with `subagents.enabled: true` under the post-ADR-117
    default (`subagents.auto: on`) during real work, long enough to
    accumulate real orchestrated dispatches — the build work is done;
    only real usage produces this.
    2. Check the current-month audit log line count:
    `wc -l agents/runtime/state/audit/$(date +%Y-%m).jsonl`.
    3. Once the count reaches ≥ 20, resume this roadmap
    (`/roadmap:process-full road-to-subagent-value-realization-followup.md`).
  - **Resolved when:** `agents/runtime/state/audit/YYYY-MM.jsonl` carries ≥ 20 orchestration lines for the current month.

### [road-to-surface-consolidation.md](roadmaps/road-to-surface-consolidation.md)

**Road to surface consolidation — collapse the proactive mental surface, remove don't add** — 6 / 11 done (55%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Collapse the proactive suggestion surface (the core) | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 2 | Supporting net-reductions (remove / fold, never add) | 🟡 in progress | 5 | 3 | 2 | 0 | 38% |

<a id="blockers-road-to-surface-consolidation"></a>
**Blockers**

- **launch-and-adoption** (owner: user) — blocks the product half of the review (post the drafted launch, distribute the wedge, run a first external session)
  - **What to do:**
  - **Resolved when:** the launch is posted and ≥1 external session is recorded.
- **repo-admin-and-usage** (owner: maintainer) — blocks branch-protection apply; utilization-driven MERGE/DEMOTE/HIDE/REMOVE of artefacts (needs loaded-vs-fired usage over the window); auto-tiering monitoring
  - **What to do:**
  - **Resolved when:** branch protection is on and the utilization window has produced a data-backed removal list.
- **benchmark-spend** (owner: user) — blocks lazy-catalog A/B, team/adversarial-council benchmarks, the Unified Verification Router decision (gated on those verdicts)
  - **What to do:**
  - **Resolved when:** the maintainer authorizes the specific run with an estimate.

### [road-to-team-mode.md](roadmaps/road-to-team-mode.md)

**Road to team mode — govern the official cross-model pair, don't rebuild it** — 31 / 37 done (84%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Facts, claims hygiene, boundary prose | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 1 | Detection + guided setup | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 2 | `/team` command family (Claude-Code path) | ✅ done | 0 | 6 | 0 | 0 | 100% |
| 3 | Multi-host fallback (the gap only we can fill) | ✅ done | 0 | 4 | 1 | 0 | 100% |
| 4 | Review-Gate governance | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 5 | Defect-finding benchmark (measure the marketing) | ✅ done | 0 | 4 | 1 | 0 | 100% |
| 6 | Close-out | 🟡 in progress | 6 | 5 | 0 | 0 | 45% |

<a id="blockers-road-to-team-mode"></a>
**Blockers**

- **model-id-verification** (owner: maintainer) — blocks Phase 2 config-doc examples, Phase 5 arm pinning
  - **What to do:**
    1. At execution, list the actual codex CLI model IDs (`codex /model` or CLI
    docs) and pin the benchmark arms to verified IDs.
    2. The trigger guide's `gpt-5.6-sol` is unverified marketing copy — the
    plugin's own prompting skill still targets `gpt-5-4`. Append the verified
    list here.
  - **Resolved when:** a dated model-ID list exists in this file. - **Resolution (2026-07-12, verified live):** codex-cli 0.134.0 on the maintainer machine, subscription-authed; model list read from the CLI's own server-fetched cache (`~/.codex/models_cache.json`, fetched_at 2026-07-12T09:54Z) and cross-checked by a live `codex exec` header: - `gpt-5.5` — GPT-5.5, the CLI's current default (live exec header shows `model: gpt-5.5`) - `gpt-5.4` — GPT-5.4 - `gpt-5.4-mini` — GPT-5.4-Mini - `codex-auto-review` — Codex Auto Review (review-specialised) A bogus id is rejected with "not supported when using Codex with a ChatGPT account" (HTTP 400) — so arm pinning MUST use ids from this list. The trigger guide's `gpt-5.6-sol` is confirmed NOT available. Benchmark arms: pin builder/reviewer arms to `gpt-5.5` (default) and consider `codex-auto-review` for the review arm; re-read the cache at Phase 5 execution time (model lists rotate).
- **benchmark-spend-authorization** (owner: user) — blocks Phase 5 execution (authoring fixtures is unblocked)
  - **What to do:**
    1. Approve the run once the fixture count is fixed; three arms × N fixtures
    land on the ChatGPT subscription quota (arms a/b) and the council budget
    (arm c). Estimate rendered before the first call.
  - **Resolved when:** the user confirms the run budget in-session.

### [road-to-tier-removal.md](roadmaps/road-to-tier-removal.md)

**Command `tier:` Alias Removal** — 2 / 7 done (29%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Evidence mechanism build-out | 🟡 in progress | 1 | 2 | 0 | 0 | 67% |
| 2 | Internal dependency audit (just-in-time) | ⬜ not started | 1 | 0 | 0 | 0 | 0% |
| 3 | External soak confirmation | ⬜ not started | 1 | 0 | 0 | 0 | 0% |
| 4 | Removal execution (blocked on Phases 1–3) | ⬜ not started | 2 | 0 | 0 | 0 | 0% |

---

## Ticket bundles

Materialised ticket bundles under [`agents/tickets/`](tickets/) (via `/roadmap:materialize`), counted from `agents/tickets/_registry.yml`.

| Bundle | Tickets | Status | Source roadmap |
|---|---:|---|---|
| road-to-ticket-bundles | 6 | in_progress | agents/roadmaps/archive/road-to-ticket-bundles.md |

