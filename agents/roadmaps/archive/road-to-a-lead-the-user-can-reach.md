---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-12-31
tree_pin: c183b82358
estate_growth_exempt: "Operator asked for this roadmap to be made active and processed in the same invocation (2026-11-02, /analyze:inbox … then /roadmap:process-full, worktree, PR, merge). It closes and archives in the same PR, so the active count at merge is unchanged."
estate_offset_exempt: "grep -rlF -e security-audit-config -e security_audit_config -e no-session-persistence -e return_bytes -e source-first-gate over agents/roadmaps/*.md agents/roadmaps/later agents/roadmaps/stubs (whole roadmap tree) — no roadmap owns consumer reach of the config audit, bench session persistence or worker return bytes; the inline-suppression and ladder-measurement findings were routed to their existing owners instead (Phase 3)."
relates:
  - slug: later/road-to-adversarial-verification-and-long-runs
    relation: disjoint
    note: "Owns production-code suppressions in a consumer (Phase 12.2). The inline-suppression finding lands there as an arrival, not here."
  - slug: stubs/road-to-solution-minimalism-full-tier-run
    relation: disjoint
    note: "Owns the ladder measurement. The re-cut corpus and the cost line arrive there; this roadmap only lands the bench isolation flag the run needs."
  - slug: later/road-to-a-lead-the-user-can-reach-carried
    relation: blocks
    note: "Everything owner-gated, measurement-bound or spend-bearing from this round."
---

# Road to a lead the user can reach

> **Source:** `agents/tmp.old/inbox-2026-11-j/` — two agent drafts comparing this
> tree against two peer packages (three loops each), beside their owner
> transcripts. Re-verified at `tree_pin` on 2026-11-02; claims the tree overtook
> since the drafts' pins are marked *overtaken*.

## Goal

Hardening this package already built is **reachable by the person it protects**.
The consumer-config audit is runnable from a consumer project and can fail a CI
step. A benchmark run never writes into the transcript store the package's own
census reads. A worker's return into the orchestrator's context is measured in
bytes, so a later decision about return shapes reads a number instead of a guess.

Owner constraint (transcripts): *learn, use and adapt — selectively; no second
always-on governance layer.* Nothing here adds a hook concern, an always-on rule
or a default flip.

## Context — re-verified at `tree_pin`

| # | Claim | Status | Evidence |
|---|---|---|---|
| A6 | A consumer-config scanner exists | still-true | `src/scripts/security_audit_config.ts:1-20` |
| A7 | It is `visibility: internal`, maintainer workspace only, no CLI verb | still-true | `src/domains/engineering-base/security-audit-config/command.md:5,14-15`; `src/cli/registry.ts` has no entry |
| A7b | Its documented call is `./scripts-run …`, a wrapper only this repository has | still-true (new) | `command.md` § 1; the same reason `audit:deps` / `ci:settle` became verbs (`src/config/evaluator-budgets.json`, `cli_help_command_count` note) |
| A8 | `internal` has no documented reason | partly never-true | ADR-041 requires a visible command's leading token to be a controlled verb; `security` is not one. The reachable path is the `audit` cluster, which already is |
| — | The audit always exits 0 | still-true | `security_audit_config.ts` `main()` |
| A11 | No per-concern disable, only the global kill switch | still-true | `src/scripts/_lib/runtime_wiring_checks.ts:327` |
| A13 | `block-config-weakening` counts no inline suppression | still-true | 0 hits for `eslint-disable|phpstan-ignore|noqa|ts-ignore` in the hook — owned by `later/road-to-adversarial-verification-and-long-runs` 12.2 |
| A19 | `.claude-plugin/` carries no `plugin.json` | still-true | `ls .claude-plugin` |
| A20 | No supply-chain IOC watch | still-true | no workflow matches |
| A24 | `source-first-gate` may already cover fact-forcing before destructive commands | never-true | it is a shadow concern over frontend screenshot capture (`src/scripts/hooks/source_first_gate_hook.ts:1-8`) |
| P6.0 | Host parity gate covers rules only | still-true | `check_host_tree_parity.ts` seeds from `dist/agent-src/rules`; skills/commands drift is caught by the regenerate-and-diff step (`.github/workflows/consistency.yml:1010`) |
| D8 | Bench arms lack plugin pinning / strict MCP | overtaken | `--plugin-dir`, `--strict-mcp-config` landed (`src/scripts/bench_ab_task_runner.ts:259-264`) |
| D8b | Bench sessions persist into the host transcript store | still-true | no `--no-session-persistence` in `live_args` |
| D8c | `--disable-slash-commands` belongs in every arm | corrected-from-reproduction | `claude --help`: "Disable all skills and commands" — in the package arm it removes the thing measured |
| D11 | No subagent definition sets `effort` | still-true | `src/subagents/*.md`: 0 hits |
| D14 | The ledger records no return size | still-true | `subagent_ledger_hook.ts` stop line has no byte field |
| P1.1 | Three code-shape rules carry no Iron Law section | still-true | `minimal-safe-diff`, `improve-before-implement`, `test-first`: 0 `## The Iron Law` headings |

## Phase 1 — The consumer-config audit is reachable

- [x] **1.1 `--min-grade <A-F>` fails a CI step.** Below the grade the audit exits 1; <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/security_audit_config.ts -->
      without the flag it stays advisory and exits 0.
      verify: `npx vitest run tests/scripts/security_audit_config.test.ts` -> 0 — a fixture
      graded below the floor exits 1, at or above exits 0, an unknown grade exits 2.
- [x] **1.2 `audit:config` is a CLI verb.** Registered beside `audit:agents`, delegated <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/evaluator-budgets.json -->
      through `_dispatch.bash`, read-only and offline; the CLI budget moves in the same
      change with its reason.
      verify: `npx vitest run tests/cli/registry.test.ts tests/cli/help.test.ts` -> 0 green;
      `bash src/scripts/_dispatch.bash audit:config --root .` prints an overall grade.
- [x] **1.3 `/audit config` is a mode of the visible `/audit` command.** The maintainer <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      command keeps its name and points at the consumer path; no new slash command.
      verify: `grep -c 'audit config' src/domains/engineering-base/audit/command.md` -> /^[1-9]/ —
      the `config` mode is in the hint and has its own section;
      `task sync` leaves `dist/` byte-equal to `rewrite(src)`.

## Phase 2 — Measurements read clean data

- [x] **2.1 Bench sessions do not persist.** `live_args` takes `no_session_persistence`; <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bench_ab_task_runner.ts -->
      every claude arm of the v2 runner and the delivery pre-flight sets it.
      `--disable-slash-commands` is deliberately not added (D8c).
      verify: `npx vitest run tests/scripts/bench_ab_task_runner.test.ts` -> 0 — the flag is
      present when asked and absent otherwise.
- [x] **2.2 The ledger records return bytes.** The `subagent_stop` line carries <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/subagent_ledger_hook.ts -->
      `return_bytes`: the UTF-8 byte length of the final message, `null` when the host
      sent none. A number, never prose — the file's privacy contract holds.
      verify: `npx vitest run tests/hooks/subagent_ledger.test.ts` -> 0 — a known message
      yields its byte length, an absent one `null`, and no line carries message text.

## Phase 3 — Findings land on their owners

- [x] **3.1 Record the reading.** The disposition of every point of both sources, <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      the A24 reading and the parity census land under `agents/evidence/analysis/`.
      verify: the file exists and its ledger columns sum to their extracted counts.
- [x] **3.2 Arrivals on existing owners.** Inline suppressions → arrival on <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      `later/road-to-adversarial-verification-and-long-runs` 12.2; the ladder re-cut
      (graded corpus, terse arm, cost by cache bucket, difficulty strata) → arrival on
      `stubs/road-to-solution-minimalism-full-tier-run`.
      verify: both files carry an `Arrivals:` line naming `inbox-2026-11-j`.
- [x] **3.3 The remainder is parked, not dropped.** Owner-gated, measurement-bound and <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      spend-bearing items go to `later/road-to-a-lead-the-user-can-reach-carried` with
      their trigger.
      verify: every row of § Kill register and § Carried exists in exactly one place.

## Decisions

| # | Question | Resolution | Rung |
|---|---|---|---|
| E1 | Make `security-audit-config` visible? | No — ADR-041 forbids the name; reach goes through the `audit` cluster (1.2/1.3). The source's "no documented reason" is half wrong: the verb rule is the reason | agent |
| E2 | Hook presets + per-concern disable? | Parked — a per-concern disable weakens guards, which is the owner's call | carried |
| E3 | Inline suppressions blocking or warn? | Owned elsewhere (12.2); warn-first noted there | owner of 12.2 |
| E4 | Learned-lesson injection A/B? | Parked — measurement over weeks; default stays off | carried |
| E5 | Own stem or fold? | One active stem for the reachable items, everything else folded or parked | agent |
| E6 | Publish a head-to-head even at a loss? | Yes, recorded with the carried item | carried |
| E7 | Add `--disable-slash-commands` to bench arms? | No — it disables the package arm's skills (D8c) | agent |
| C1 | Closure scan: `typed-op` on the frontmatter exemption | Not an operation — the estate exemption is a recorded reason the estate gate reads | agent (closure pass) |
| C2 | Closure scan: `ambiguous-acceptance` on the P1.1 context row | The rule name `improve-before-implement`, not a criterion | agent (closure pass) |
| C3 | Closure scan: `unfalsifiable-verify` on 3.2 | Non-blocking listing; the verify names a grep-able line (`Arrivals:` + `inbox-2026-11-j`) in two named files | agent (closure pass) |

## Kill register

| # | Not adopted | Why |
|---|---|---|
| K1 | A peer's compiled control plane | Own runtime line (ADR-249); peer is alpha without CI |
| K2 | README translations | No defect; drift risk |
| K3 | Hand-copied host trees | Projection is generated and diff-gated |
| K5 | Compact / recycle nudge | Retired on purpose (`session_eol_hook.ts:1-25`) |
| K6–K8 | Catalog drift gate, fail-open runner, install ledger | Already present |
| K9 | A second profile knob for hooks | The preset axis exists; carried as a column, not a knob |
| K10 | Blocking every lint-config edit | Blocks legitimate edits; the session/NET semantics are sharper |
| K11 | Terse-speech voice | Measured −9.27 % against a terse control; the rule is dormant |
| K12 | Log/CSV compression of tool output | Traffic shape does not match; owned by the handle roadmap |
| K13 | Router-as-a-service | External account and trust boundary |
| K14 | Warm-cache pings | Unmeasured at the source |
| K17 | Compressing memory files | `condense-memory` exists |

## Risk register

| Risk | Mitigation |
|---|---|
| `--min-grade` turns an advisory audit into a false-red CI gate | Opt-in flag only; the default exit stays 0 |
| A new CLI verb grows the help surface | Budget moves with a reason in the same change, as every audit verb did |
| `no_session_persistence` hides a session a bench author wanted to inspect | Scoring reads stdout, never the store; stream traces stay available |

## Acceptance criteria

- AC-1 A consumer runs the config audit through `agent-config audit:config` and `/audit config`.
- AC-2 `--min-grade` exits 1 below the grade, 0 otherwise, 2 on a bad argument.
- AC-3 No bench claude arm persists its session.
- AC-4 Every `subagent_stop` ledger line carries `return_bytes` and no prose.
- AC-5 Every point of both sources has a disposition in the evidence file.
