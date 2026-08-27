<!-- evidence-type: analysis -->
# What actually refuses a resident process: three artefacts out of 129

**Measured 2026-08-27** at base commit `830e31aa3ca7329b513b53328eadad4a92d471f7`,
discharging Phase 0 of `road-to-runtime-governance-flip`.

The owner decided Zero Runtime is no longer the goal. Before any public surface
is rewritten, this establishes **what in the tree would refuse a resident
process if read literally** — separated from what merely mentions the phrase.
The answer is **three artefacts**, and the reduction from 129 is the useful part.

## 0.1 — The enumeration, mechanically

Pinned expression, reproduced verbatim:

```
$ grep -rlniIE 'zero.runtime|no.runtime|no daemon|runtime daemon' src/ docs/ README.md | wc -l
129
$ grep -rniIE  'zero.runtime|no.runtime|no daemon|runtime daemon' src/ docs/ README.md | wc -l
205
```

**129 files, 205 matching lines**, at base `830e31aa3`. This reproduces the count
the roadmap carried, which was measured on a different day — so the population is
stable, not coincidental.

Per top-level directory:

| Directory | Files |
|---|---|
| `src/scripts` | 32 |
| `docs/decisions` | 28 |
| `docs/contracts` | 13 |
| `src/skills` | 9 |
| `src/agent-src` | 8 |
| `src/config` | 7 |
| `src/domains` | 4 |
| `docs/guidelines` · `docs/distribution` | 3 each |
| `src/rules` · `src/cli` · `docs/archive` | 2 each |
| 20 further single-file locations (`README.md`, `docs/proof.md`, `docs/threat-model.md`, …) | 1 each |

## 0.2 — The read set: five classes that can refuse, 49 of 129

Skills, commands, evidence records and archived roadmaps are **out of scope by
construction**: a skill using the phrase incidentally cannot block anything.
What can refuse is a rule, a contract, a schema, a gate, or an accepted ADR.

| Class | In the read set | Basis |
|---|---|---|
| rules | 2 | `src/rules/*.md` |
| contracts | 13 | `docs/contracts/*.md` |
| schemas | 3 | `*/schemas/*` |
| gates | 7 | `src/scripts/{check,lint,validate,verify}_*.ts` |
| accepted ADRs | 24 | `docs/decisions/*.md` with `status: accepted` |
| **read set** | **49** | |
| out of scope | 80 | skills, commands, config, domains, docs prose, archives |
| non-accepted ADRs | (4, inside the 80) | 1 `superseded`, 1 `proposed`, 2 non-ADR records |

**49 of 129 — a 62 % reduction before a single judgement is made.**

## 0.3 — The test, written before the classification

> **Active** — the artefact, read literally by an agent or a gate, **refuses an
> action this reversal permits**.
> **Historical** — it describes the old state and refuses nothing.
> **Incidental** — the word "runtime" appears in another sense entirely
> (runtime cost, runtime errors, a runtime override, a runtime resolver).

Two further classes were forced by the corpus rather than chosen, and naming
them is part of the finding:

> **Derivative** — refuses nothing itself, but its *reasoning* cites a floor that
> is moving, so its conclusion silently loses its premise. Not a blocker; a
> re-read list.
> **Not-reopened** — a genuine prohibition on a *different* subject that this
> reversal explicitly does not touch (the agent-memory / Layer-2 sunset).
> Distinguishing these from Active is the single most important line in this
> document, because collapsing them would read as a general relaxation.

### Three worked examples, one per original class

| Line | Class | Why |
|---|---|---|
| `ADR-124:111` — Class B "Resident service / daemon … **PROHIBITED in core**" | **Active** | A gate or an agent reading this refuses the collector outright. It is the prohibition. |
| `ADR-040:36` — "`agent-config` ships no agent loop, no LLM dispatcher, no daemon" | **Historical** | A description of what the package shipped in 2026. It permits and forbids nothing. |
| `docs/contracts/config-presets.md:78` — "NO RUNTIME OVERRIDE. NO 'JUST THIS ONCE' FLAG." | **Incidental** | "Runtime" here means *at invocation time*, about config precedence. Nothing to do with a resident process. |

## 0.4 — The classification

### ACTIVE — three artefacts, and only three

| Artefact | Line | What it refuses | Handled by |
|---|---|---|---|
| `docs/decisions/ADR-124-embedded-engine-doctrine.md` | `:111` | Class B "Resident service / daemon — anything with a lifecycle beyond one command … PROHIBITED in core" | Phase 1.1 — scoped supersession of that row |
| `docs/decisions/ADR-109-subagent-v1-contract.md` | `:28` | "the no-runtime identity floor (no daemon, no auto-write…)" — `status: accepted`, `superseded_by: —` | Phase 1.2 — amended in the same change |
| `docs/contracts/no-runtime-boundary.md` | Prohibited table | "**Background processes / daemons** — No spawned subprocesses that outlive the current agent turn" | Phase 4.1 — replaced by a governance contract |

**No active blocker was found that nobody can remove.** Phase 0.4's contingency —
"if discovery finds an active blocker nobody can remove, that is a Phase 4 input
and possibly a new blocker" — does not fire. All three are owned by phases that
already exist in the roadmap.

### Two findings about the boundary contract that change Phase 4.1's input

**1. Its literal scope is Mission-Mode, not the suite.** Its own header reads
*"Audience: Every Mission-Mode decision, skill author, and recipe reviewer"* and
*"This contract makes that boundary explicit **for the Mission-Mode layer**"*
(`:8-13`). The Prohibited row bans *"spawned subprocesses that outlive the
current agent turn"* — a statement about mission steps. The document is
nonetheless cited across the tree as the general no-runtime authority, including
by a gate (`src/scripts/validate_reach_prescriptions.ts:13`, "The Class A
boundary (`docs/contracts/no-runtime-boundary.md` …)").

This is not a new observation, and that is what makes it credible:
`ADR-124:34` already recorded that *"the 'no runtime' identity rests on
instruments whose literal scope is narrower"*. The successor contract must
therefore decide its own scope explicitly rather than inheriting an ambiguity.

**2. Its beta window expired.** Frontmatter reads
`keep-beta-until: 2026-08-17` — **ten days before this measurement**. The
contract is being cited as settled authority while its own metadata says it was
never promoted out of beta.

### NOT-REOPENED — the agent-memory sunset, deliberately untouched

Five accepted ADRs carry a prohibition that reads like the one being reversed and
is a different decision: the 2026-06-14 Layer-2 / agent-memory sunset —
*"no daemon, no vector DB, no writable per-user store"*.

`ADR-098:31,113-114` · `ADR-099:29,66` · `ADR-100:36,47,92,137` ·
`ADR-138:195` · and the cross-reference at `ADR-124:164`.

`ADR-100:137` states the relationship exactly: *"The 2026-06-14 Layer-2 sunset
decision (no runtime) — **reconciled, not reversed**."* Phase 1.3 requires the
new ADR to say the same of ADR-094. These are listed here so that a later reader
grepping for "no daemon" and finding nine hits does not conclude the repeal was
incomplete.

### DERIVATIVE — 14 artefacts whose argument loses its premise

None refuses the collector. Each reasons *from* the floor, so each states
something that stops being true once the floor moves. This is a re-read list for
Phase 4.2, not a blocker list.

| Artefact | The premise that moves |
|---|---|
| `ADR-126:45` | "The reach layer is Class A … no resident process, no daemon" — scoped to reach tooling, but derives from ADR-124's class table |
| `ADR-059:92` | "No TTL, no cron, no daemon (would violate the shell-first constraint)" |
| `ADR-125:49,84,122,130` | four appeals to "the no-runtime-floor" as a reason to reject a bundled capture engine |
| `ADR-118:43-44,160` | "Constraint frame: … no runtime daemon (ADR-088 / no-runtime-boundary)" |
| `ADR-105:74` | "no daemon" inside the constraint frame |
| `ADR-117:25` | "**non-producible** in this package's harness (no runtime executes model …)" |
| `ADR-122:95,115` | "orchestration value measured in a **no-runtime harness** — not claimed" |
| `ADR-134:30,92` | "a no-runtime package where posting is a maintainer Hard-Floor act" |
| `ADR-137:45,67` | "telemetry infeasible in a no-runtime / file-first package: there is no server" |
| `ADR-231:37` | "impossible by construction in a no-runtime, file-first package" |
| `docs/contracts/command-surface-tiers.md:174` | "structurally impossible in a no-runtime package" |
| `docs/contracts/ui-authority.md:120` | "the resolver is a pure function; nothing here owns a process" |
| `src/scripts/validate_reach_prescriptions.ts:13` | a **gate** reasoning from the boundary contract's Class-A definition |
| `src/scripts/schemas/mission.schema.json:5` | "Missions add NO control-flow primitives" — derives from the mission boundary |

`ADR-137:45` is the sharpest of these: it declares telemetry *infeasible* in this
package because *"there is no server"*. The dependent roadmap
`road-to-supervised-telemetry-collector` exists to build exactly that. Two
accepted records will disagree until one is amended, and neither Phase 1 nor
Phase 4 currently names ADR-137.

### HISTORICAL and INCIDENTAL — 29 artefacts, no action

Historical (describes the past, refuses nothing): `ADR-040:36` ·
`ADR-055:191` · `ADR-057:115` · `ADR-088:141` · `ADR-097:117` · `ADR-212:42` ·
`ADR-220:86` · `ADR-227:48`, plus the non-`:111` lines of `ADR-124`.

Incidental (a different sense of the word): `src/rules/ui-audit-gate.md:143` and
`src/rules/design-review-after-ui-write.md:126` ("no runtime *consumer*" of a
keyword) · `config-presets.md:78` (a config override) ·
`design-artifact-verification.md:37,93` ("no runtime JS *errors*") ·
`adr-install-user-type-axis.md:57` ("no runtime *filter*") ·
`ai-council-config.md:874` · `command-clusters.md:393` ·
`reasoning-discipline-protocol.md:46` and `src/server/schemas/settings.ts:299`
("no runtime model→band *lookup*") · `release-pr-gating.md:86` ("no runtime
*code* in the package") · `rule-router.md:212,300` ("no runtime *resolver*") ·
`trust-and-safety.md:125` · `write-engine.md:160` · `skill.schema.json:42-43` ·
and four gates whose comments say "no runtime *cost*" or "no runtime *behaviour*"
(`check_source_size_budget.ts:110`, `lint_design_slop.ts:16`,
`lint_documented_commands.ts:37`, `lint_governed_writes.ts:36`).

**Both `src/rules/` hits are incidental.** No rule in this suite refuses a
resident process — worth stating, because rules are the class most likely to be
assumed guilty.

`src/scripts/check_claims.ts:487-488` is neither: it is a **comment recording an
interaction** the retirement must not break, and Phase 2.2 owns it.

## Summary

| Class | Count |
|---|---|
| Active — refuses the reversal | **3** |
| Not-reopened — a different prohibition, deliberately untouched | 5 ADRs |
| Derivative — argument loses its premise, re-read in Phase 4.2 | 14 |
| Historical | ~9 |
| Incidental | ~18 |
| Out of the read set entirely | 80 |

## What this does NOT establish

This is the **bounded** discovery Phase 0 asks for, not the exhaustive census
Phase 4.2 owns. The 80 out-of-scope files were classified by *artefact class*,
not read — the claim is that a skill or a command cannot refuse an action, not
that none of them says something that will need rewriting. Phase 4.2 reads them.

The derivative list is also a judgement about *reasoning*, not a mechanical
result: a reader who disagrees that `ADR-134`'s "no-runtime package" premise is
load-bearing for its conclusion would move that row to historical. The rows are
listed with their quoted premise so that disagreement is possible without
re-deriving the set.
