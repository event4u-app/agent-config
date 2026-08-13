---
complexity: structural
---

# Road to the August program — the four 2026-08-12 roadmaps, re-planned as one sequence

> **The ask (2026-08-12):** re-plan the four roadmaps produced today —
> [`road-to-subagent-lifecycle-integrity`](../road-to-subagent-lifecycle-integrity.md) (SLI),
> [`road-to-symptom-driven-harvest-loop`](road-to-symptom-driven-harvest-loop.md) (SHL — **fully executed and archived** at adoption),
> [`road-to-source-first-frontend`](../road-to-source-first-frontend.md) (SFF),
> [`road-to-design-system-onramp`](../road-to-design-system-onramp.md) (DSO) —
> in combination, with what each later roadmap learned that the earlier ones
> did not know. This file is the **program layer**: it does not repeat the
> children's evidence (their Context sections stay authoritative), it
> re-sequences their phases into waves, merges the steps that turned out to be
> the same step, and adds the cross-cutting items that only exist when the
> four are read together. Each child receives a short, explicit amendment
> list; nothing else in the children changes.

> All four children were written against pinned commit `ed76d224` (v10.1.0);
> this program inherits that pin. *(proposal)* marks program-level suggestions.

> **Source (consumed inbox):** the 2026-08-12 `optimize-agent-config` batch under
> [`agents/tmp.old/`](../../tmp.old/) — one chat transcript plus these five roadmap
> drafts, authored in a session that did not have this repo's source in context.
> Adopted by [`/analyze:inbox`](../../../src/domains/analysis-workbench/analyze/inbox/command.md);
> the verification that decided what survived is the next section.

## Verification at adoption (2026-08-12, tip `1432c7a45`)

The drafts were written against `ed76d224`; adoption re-verified every repo claim
against the tip **81 commits later**. Only two of those commits touch any surface
the drafts name, both `turn-end-gate` — so the pin was still fresh and the
drafts survive nearly intact. **36 claims checked: 32 `still-true`, 1
`already-fixed`, 2 `never-true` in a non-load-bearing detail, 1 new
cross-finding.** The deltas below are applied inline in the children; this
section is the record of why the text differs from what the author wrote.

| Claim | Verdict | Consequence, applied inline |
|---|---|---|
| **SLI V7** — `resolveSubagentRouting` has zero production callers | `already-fixed` | It now has its first: `src/scripts/hooks/delegation_nudge_hook.ts:342`, wired at `hook_manifest.yaml:432-433`. SLI **Phase 5 Step 1's "or record it as dead code" branch is resolved** — the caller exists; the phase collapses to re-measurement. One roadmap step prevented. |
| **SLI V1b** — `hooks/hooks.json` binds six native events | `never-true` (count only) | It binds **seven**, identically at the pin. The load-bearing half — none of them `SubagentStart`/`SubagentStop` — holds; the number is corrected. |
| **SLI V6** — blocker comment at `hook_manifest.yaml:536-540` | `still-true`, anchor moved | Now `:547-550`; quoted verbatim in the child. |
| **SFF W1c** — sole `screenshot` hit in `src/scripts` is a comment | `still-true`, detail drifted | Three hits now (`skill_linter.ts:3170` keyword bucket, `_lib/agent_settings.ts:920` unread-key comment, `_lib/reddit_thread_parse.ts:6`); **none is a matcher**, so the conclusion stands. |
| **SFF E1** — `road-to-frontend-skill-application` Phases 2–5 open, verdict table at `:46-56` | `never-true` in both details | Phase 3 is **fully closed**; open steps are Phase 2 `:80-82`, Phase 4 `:109`, Phase 5 `:123-124`. Lines 44-56 are a KEEP/CUT/FOLD gap table; the `no-selector` verdict is a step annotation at `:79`, canonical in `agents/settings/contexts/skill-catalogue-baseline.md:67`. |
| **SFF W3a/W3b** — `directives/ui/*.ts` | `still-true`, path longer | Resolves to `src/agent-src/templates/scripts/work_engine/directives/ui/`; line numbers 67/93/105/139 survived all 81 commits. |
| **SFF W5c** — lock in `design-system-capture/reference/` at `:64-65` | `still-true`, path moved | Directory is `references/`; the lock sits at `:7` and is restated at `:72-73`. |
| **DSO C2/C3** — machinery ported, unreachable; corpus drifted | `still-true` | No `/design-system` command exists anywhere; `design-intelligence` is `execution: type: manual` (`SKILL.md:16-17`); `motion.csv`, `google-fonts.csv` and the three dials are absent; pin is still `b7e3af80` (`ATTRIBUTION.md:8-11`). |
| Everything else (SLI V1–V6, V8, V9 · SFF W1a/W1b/W2/W3c/W3d/W4/W5a/W5b/W6 · DSO C1/C4/C5 · SHL context) | `still-true` | No change. |
| Host behaviour, upstream issue status (#58109, #20221, #55754, #68619), external tool pins | `unverifiable` from the repo | Already carried as Phase-0 spikes and watchlist entries — the drafts were right to gate on them. |

**X8 — the adopt-the-code duty collides with an existing Iron Law, and no child
noticed.** SFF Phase 2 Step 3 wants *"adaptation of the artifact's code is the
default; a from-scratch re-derivation is a deviation"*. But
[`code-provenance`](../../../src/rules/code-provenance.md) opens with
`NEVER ADOPT EXTERNAL CODE VERBATIM` and routes any conscious borrow through a
license check plus a ledger entry. Shipped as drafted, the two rules would
contradict each other on the same act. The resolution is a scope line, not a
weakening of either: a **user-supplied design artifact is the user's own
material**, not third-party external code — the same carve-out
[`content-quoting-floor`](../../../src/rules/content-quoting-floor.md) already makes
for user-owned text. SFF Phase 2 Step 3 carries that sentence; without it the
duty is unshippable.

**One downstream surface the drafts did not name.** The uupm pin `b7e3af80` is
replicated in **ten** places, not one — `ATTRIBUTION.md:8-11`,
`design-intelligence/data/manifest.json:3`, `references/design-languages.md:6`,
`design-tokens/SKILL.md:34`, `corpus-grounding/SKILL.md:29`,
`tailwind-engineer/scripts/tailwind_config_gen.ts:4`,
`react-shadcn-ui/scripts/shadcn_add.ts:4`, `ADR-061:170`, plus two watch notes.
DSO Phase 3 Step 1's "ATTRIBUTION SHA + date bump" is therefore a ten-file sweep;
the step says so now.

## What combination reveals — the cross-findings

**X1 — The two operator symptoms meet in the verifier subagent.** SFF cites
the async-verifier pattern approvingly (screenshots offloaded to a verifier
subagent, `design-review/references/verification-automation.md:44-57`) — but
that verifier **is** a subagent whose return channel SLI-V8 shows to be
unreliable (#58109: final `tool_use` block truncates the report). A verifier
that screenshots, grades, and never delivers is both operator reports in one
run. Consequence: SLI Phase 2 (return-channel integrity) protects SFF's
verification loop directly, and its worker-prompt contract addendum
("text-only final envelope; envelope also on disk") must explicitly cover the
verifier dispatch shape. Neither child says this; the program does.

**X2 — The source-first gate must not fire on the verifier.** SFF Phase 3's
`source-first-gate` warns on screenshot tools while the design source is
unread — but a **verifier subagent screenshotting for QA is the sanctioned
use** (SFF's own ladder: screenshots for validation). The clean exemption key
is the payload `agent_id`/`agent_type` field that SLI Phase 0 Step 4 spikes
and SLI Phase 4 binds the role axis on. Dependency, previously invisible:
**SFF Phase 3 consumes SLI Phase 0 Step 4's spike result** (and lands best
after SLI Phase 4). Shipping the gate before role-by-payload exists means
warning the one actor doing it right.

**X3 — Three roadmaps carry the same "when does a warn concern ship ON"
argument, separately.** SLI Phase 3 Step 1 (spawn-guard warn-first), SFF
Phase 3 Step 2 (source-first-gate default-ON proposal), and SFF Phase 6 /
SLI Phase 6's design-slop flip all re-litigate the same precedent
(turn-end-gate soak history, "a concern which is off cannot soak",
`hook_manifest.yaml:459-467`). *(proposal)* Write the **concern activation
policy** once — a half-page note: new warn-only concerns ship ON with a valve
and a pre-registered kill-number; blocking concerns ship warn-first for one
window with a pre-registered flip-number — and have all three cite it. One
argument, three consumers, no drift.

**X4 — The extraction artifact and the import adapter are one contract, not
two.** SFF Phase 4 invents "a file-carried extraction artifact under
`.claude/design-system/`"; DSO Phase 1 builds the adapter whose output is
`design-system.json` — same directory, same purpose, defined twice.
Resolution: **the extraction artifact IS `design-system.json`** (plus raw
source files beside it); SFF Phase 4 stops defining a shape and cites DSO's
adapter + the existing contract; the skip-if-exists persistence discipline is
stated once, in DSO Phase 2 where it already lives.

**X5 — The watchlist's true scope is "everything we pin upstream", not just
host issues.** SHL Phase 3 seeds four Claude-Code issues. The later roadmaps
added pins with the same maintenance shape: the uupm corpus pin (DSO Phase 3
exists *because* that pin drifted b7e3af80 → 97eb2a20 unnoticed for two
months), dembrandt/designlang versions (DSO survey), Playwright-MCP behaviour
SFF leans on, and the #58109 status SLI Phase 2 designs around. Amendment:
the watchlist entry schema gains a `kind: host-issue | vendored-corpus |
consumed-tool` field, and DSO Phase 3 becomes the first *scheduled outcome*
of a watchlist walk rather than a one-off.

**X6 — Three measurement phases are one release.** SLI Phase 1 (lifecycle
ledger + envelope-parse telemetry), SFF Phase 1 (ad-hoc port baseline +
screenshot-tool census + latch extension), and SHL Phase 1 (intake backfill —
now **three** operator reports, not one) are all capture-only, risk-free, and
mutually independent. Shipping them as one instrumentation release starts
every evidence clock on the same day, which every later evidence-gated flip
benefits from.

**X7 — SLI Phase 6 dissolves.** Its two frontend amendment steps were written
before SFF existed; SFF Phases 2–3 now carry the frontend enforcement story
with more evidence, and the changed-files-lint + design-slop-flip steps file
into `road-to-frontend-skill-application` exactly as SFF Phase 6 of SLI
described. Amendment: SLI Phase 6 is superseded-by-SFF (marked, not deleted —
the trail stays).

## Dependency spine

```
SLI P0 (spikes: SubagentStop payload, agent_id-in-payload, #58109 repro)
  ├─→ SLI P1 ─┐
  │           ├─ WAVE 1 (one instrumentation release)  ←─ SFF P1, SHL P1
  │           │
  ├─→ SLI P2 (return channel)  ←── X1: covers verifier dispatch shape
  ├─→ SLI P4 (role by payload) ──→ X2 ──→ SFF P3 (gate, verifier-exempt)
  │
SHL P2 (loop codified — its falsifier test is these very roadmaps)
SHL P3 (watchlist, X5 scope) ──→ schedules DSO P3 (corpus refresh)
DSO P1 (adapter) ──→ X4 ──→ SFF P4 (handover section cites, not defines)
DSO P2 (command) ──→ DSO P4 wiring written ONCE with SFF P4 (X4)
```

## The wave plan

**Wave 0 — Spikes (scratch-only).** SLI Phase 0 unchanged, plus SFF Phase 1
Step 2 (screenshot-tool census) pulled forward — it is spike-shaped and X2
needs its result next to the `agent_id` spike. Exit: host pins + payload
facts + #58109 repro verdict + tool census, all in one evidence file.

**Wave 1 — Instrument everything, change nothing (X6).** SLI Phase 1, SFF
Phase 1 Steps 1+3, SHL Phase 1 (backfill all three 2026-08 operator reports).
One release. Exit: baselines published — envelope-return rate, runaway
distribution, ad-hoc port behaviour, artifact-read-before-write rate.

**Wave 2 — Prose, contracts, pure transforms (no runtime risk).** The
concern activation policy note (X3) first, then: SFF Phase 2 (ladder, W2
contradiction fix, adopt-the-code duty, ad-hoc coverage duty), SLI Phase 2
Step 1 (worker-prompt contract addendum, extended per X1 to the verifier
dispatch shape), DSO Phase 1 (adapter + fixtures + contract section), DSO
Phase 3 (corpus refresh — first scheduled watchlist outcome per X5), SHL
Phase 2 (codify the loop; its Phase-2 falsifier now has three data points),
SHL Phase 3 (watchlist with X5's `kind` field).

**Wave 3 — Deterministic carriers, evidence-gated, in dependency order.**
SLI Phase 2 Steps 2–3 (return gate, gated on Wave-1 baseline), SLI Phase 3
(spawn guard, ledger-aware turn-end-gate, shadow stop-loss), SLI Phase 4
(role by payload), **then** SFF Phase 3 (source-first-gate, verifier-exempt
via payload per X2). All four cite the X3 policy instead of arguing
activation individually.

**Wave 4 — Reachability and product.** DSO Phase 2 (`/design-system`
cluster), DSO Phase 4 + SFF Phase 4 **merged per X4**: the browser-handover
section is written once, extraction artifact = `design-system.json`, producer
sentence (connected extractor MCP; Chrome-DevTools-MCP fallback) owned by the
SFF guideline section, adapter + persistence owned by DSO. SFF Phase 5
(interop precedence) rides along — one clause.

**Wave 5 — Re-measure and decide.** SFF Phase 6, SLI Phase 5 (tier routing
caller-or-null), DSO Phase 5, and the first release-review watchlist walk.
Every gated follow-up (ad-hoc coverage checker, gate strengthening,
design-slop flip, drift-gate adoption) is decided here on numbers, not
before.

## Amendments per child (the complete edit list)

- **SLI:** Phase 2 Step 1 gains the X1 sentence (verifier dispatch shape is
  in scope). Phase 3 Step 1 and Phase 2 Step 2 cite the X3 policy note.
  Phase 6 is marked *superseded by SFF Phases 2/3/6-destination* (X7).
- **SFF:** Phase 1 Step 2 moves to Wave 0. Phase 3 gains the verifier
  exemption keyed on payload `agent_id` and a dependency line on SLI P0.4/P4
  (X2); its Step 2 cites the X3 policy. Phase 4 stops defining the artifact
  shape and cites the `design-system.json` contract + DSO adapter (X4).
- **SHL:** Phase 1 backfill covers all three reports. Phase 3 entry schema
  gains `kind` (X5) and its first walk schedules the DSO corpus refresh
  cadence. Phase 2's falsifier ledger records runs 2 and 3.
- **DSO:** Phase 3 is re-labelled a recurring watchlist outcome (X5).
  Phase 4 Step 2 merges into SFF Phase 4's single write (X4). No other change.
- **New, program-owned:** the concern activation policy note (X3),
  `agents/settings/contexts/` *(proposal)* — half a page, written in Wave 2
  before any Wave-3 concern lands.

## Program falsifier and rollback

**Falsifier.** The wave structure exists to serialize dependencies (X2, X4)
and to co-time evidence clocks (X6). If Wave 1 ships fragmented anyway, or a
Wave-3 item lands before its dependency without harm, the coordination layer
is overhead: retire this file to the archive and let the four children run
independently — they are each self-sufficient by construction.

**Rollback.** This file plus five amendment commits; every child remains
executable stand-alone.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-12 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A coordination layer that only adds a read | product | Four self-sufficient roadmaps plus a fifth file that sequences them is a governance surface whose value is entirely in the two real dependencies (X2, X4) and the co-timed evidence clocks (X6). If those hold without it, every reader pays for a file that changes nothing | The falsifier is pre-registered and concrete: if Wave 1 ships fragmented anyway, or a Wave-3 item lands before its dependency without harm, this file goes to the archive and the four children run independently — they are standalone by construction | Program falsifier and rollback |
| 2 | Five roadmaps adopted at once into an estate of thirty-six | product | This adds five active roadmaps in one change. Estate weight is the failure mode the family cap and the solution-minimalism lens both police, and a batch adoption is exactly how a backlog stops being a plan and becomes an inventory | Every child carries per-phase falsifiers that delete or park it on its own evidence, and the only genuinely new artifact the program adds is the half-page X3 policy note; nothing here proposes a subsystem the children did not already argue for | Amendments per child |
| 3 | Inline amendments diverge from what the children argue | implementation | The program's amendment list was applied directly into the children's text at adoption rather than shipped as a diff to follow. That removes one drift risk and creates another: a child now contains sentences its own Context section did not derive, and a reader cannot tell adopted text from authored text | Every inline amendment names its cross-finding (X1–X8) at the point of insertion, and the verification section records each verdict delta with its anchor, so the provenance of every changed sentence is recoverable from this file | Verification at adoption |
| 4 | The X3 policy note is written and never cited | implementation | Its whole value is that three roadmaps stop re-litigating activation posture separately. A note that lands while the three keep their own arguments is a fourth place the argument lives, which is strictly worse than three | The three consuming steps were edited to cite the policy in the same adoption pass, before the note itself exists, so the citations are the specification the note has to satisfy rather than an afterthought | Amendments per child |
| 5 | Wave ordering is read as a schedule | product | Waves imply sequence, and sequence invites dates. The children's evidence gates are measured in dispatch counts and release windows, not weeks, and a wave read as a timeline will pull an evidence-gated flip forward on impression | Non-goals states it explicitly — waves order work and do not promise weeks — and every gated follow-up in Wave 5 is decided on a published number rather than on arrival at a wave | Non-goals |

## Non-goals

- No re-arguing the children's evidence — Context stays in the children.
- No new subsystems beyond what the children already propose; the only new
  artifact this program adds is the half-page X3 policy note.
- No schedule dates — waves order work; they do not promise weeks.
