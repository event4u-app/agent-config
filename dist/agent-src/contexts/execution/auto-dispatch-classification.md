# Auto-Dispatch Classification (v1 — deterministic)

Decides whether a task is **delegable** to subagents, and to which
`subagent-orchestration` mode. v1 is **rule-based and deterministic** — no
per-turn LLM meta-call. Classification is the control plane for auto-dispatch;
keeping it cheap and predictable is the point.

## The Iron Law — ambiguity never spawns

```
A TASK IS DELEGABLE ONLY ON AN ENUMERATED SIGNAL BELOW.
AMBIGUITY DEFAULTS TO ask / no-op — NEVER SPECULATIVE SPAWN.
NO PER-TURN LLM CLASSIFICATION CALL IN v1.
```

## Delegable signals (v1)

A task is classified **delegable** when **any** of these holds:

1. **Declared parallel** — the skill/command in play carries
   `parallelizable: steps | files | independent` in its frontmatter.
   - `steps` → ordered plan → `do-in-steps`.
   - `files` / `independent` → independent slices → `do-in-parallel`.
2. **Ordered-plan structure** — the task is an explicit ordered plan (numbered
   steps / a roadmap phase / a checklist) → `do-in-steps`. Deterministic markers:
   - User message contains `1. … 2. … 3.` numbered list.
   - User message references a roadmap phase or checklist.
   - User message uses "first … then … finally" with distinct deliverables.
   - User message says "in N steps" or "phase by phase".
3. **Independent-slices structure** — N ≥ 3 independent targets of the same shape
   → `do-in-parallel`. Deterministic markers (N ≥ 3 of the same form):
   - N file paths listed where each is a separate analysis/edit target.
   - N named modules/components to perform the same action on.
   - N named test files, adapters, endpoints, or services to convert/review/audit.
   - "for each X in [list]" where list has ≥ 3 items and no cross-item dependency.
   Do **not** fire on lists where items are interdependent (e.g. "add these 3
   sequential migrations") — those are ordered plans (signal 2).

AND the **task-size floor** is cleared: the task's estimated size exceeds a
minimum (trivial one-line edits never delegate — the dispatch overhead
dwarfs the work). Below the floor → in-session.

## Not delegable (in-session)

- Trivial / single-step edits below the size floor.
- Tasks with cross-step shared mutable state that cannot be sliced.
- Anything that fails to match a signal above → **no-op** (in-session),
  or **ask** when `subagents.auto == ask` and the shape is borderline.

## Mode selection summary

| Signal | Mode |
|---|---|
| `parallelizable: steps` / ordered plan | `do-in-steps` |
| `parallelizable: files\|independent` / independent slices | `do-in-parallel` |
| change needing verification (any of the above) | implementer + cross-model judge per the `subagent-orchestration` Iron Law |

## Per-slice tier inference (v1.5 — deterministic, task-TYPE-keyed)

Once a slice is classified **delegable**, a second deterministic table infers
its `model_tier` (road-to-cost-aware-model-routing, council 2026-07-08). The
inference is keyed **exclusively on the classifier's task-TYPE outputs** —
never on raw size metrics; diff size anti-correlates with difficulty in
refactoring domains.

```
UNKNOWN / AMBIGUOUS → inherit (SESSION TIER). NEVER GUESS DOWN.
SIZE SIGNALS ARE NEGATIVE GUARDS ONLY — THEY REVOKE A lite CANDIDACY,
THEY NEVER CREATE ONE.
```

| Slice type (classifier output) | Inferred tier |
|---|---|
| Delegable + read-only fan-out (grep / inventory / discovery targets) | `lite` |
| Delegable + mechanical / template-driven transform WITH test coverage | `lite` (verify-fail escalates to `medium` per the steering cascade) |
| Delegable + mutating WITHOUT test coverage | `medium` |
| Delegable + synthesis / judgment (review, analysis slice) | `medium` — judge one tier up per the orchestration Iron Law |
| Any other / ambiguous shape | `inherit` — session tier, no downshift |

**Negative size guard:** a slice whose scope exceeds the mechanical envelope
(multi-file mutation, or a diff surface beyond a single responsibility) loses
its `lite` candidacy and resolves one row down — size never argues FOR a
downshift, only against one.

Every inferred decision records `tier_source: "inferred"` in the
orchestration telemetry (statically pinned tiers record `"static"`;
session-tier runs record `"inherit"`) so the evidence gate can score inferred
routing separately from static pinning.

## Dispatch-primitive output — fork vs. named subagent (road-to-cache-economy Phase 4)

A third, ORTHOGONAL classifier output — independent of form and tier — on a
host that exposes a fork primitive alongside named-subagent dispatch:

```
TOOL AND SCOPE FIT IS FIRST-ORDER. CACHE INHERITANCE IS SECOND-ORDER.
NEVER "ALWAYS FORK" — THE BENEFIT CANNOT BE PREDICTED BEFORE THE FORK HAPPENS.
```

| Slice shape | `dispatch_primitive` |
|---|---|
| Continues the parent's task under IDENTICAL tools and constraints (no isolation need, no nested dispatch) | `fork` — its first request reads the parent's cache |
| Needs isolation, a different tool set, or nested dispatch | `subagent` — a fork cannot nest and cannot change tools |
| Ambiguous / host has no fork primitive | `subagent` — the only primitive this suite's `Agent`-tool dispatch uses today |

A fork forces background mode, which changes the tool set and therefore
invalidates the very prefix that motivated the fork — so a slice that would
need a different tool set mid-flight is a `subagent` candidate even when it
started as a fork candidate. This output never downgrades the form or tier
decisions above; it only picks the primitive once a `parallel` / `steps` /
`judge` form has already been selected. See
[`subagent-orchestration/SKILL.md`](../../skills/subagent-orchestration/SKILL.md)
§ Form gate and
[`prompts/README.md`](../../skills/subagent-orchestration/prompts/README.md)
§ Prompt-cache discipline for the full rationale.

## Lookup-class rung (L0 — road-to-lean-agent-init, BELOW the tiers)

Before any spawn decision, a lookup-shaped task routes to a **deterministic
primitive** — no subagent, no tier. Live evidence (2026-07-28): four
`general-purpose` workers burned ~1.21M tokens on four lookup tasks a
primitive answers for <1k each.

```
LOOKUP-SHAPED TASK → DETERMINISTIC PRIMITIVE. NO SUBAGENT SPAWN.
INDEX-MISS OR GENUINE AMBIGUITY → REGULAR ESCALATION TO A SUBAGENT —
NEVER A SILENTLY DEGRADED ANSWER. NO LLM CLASSIFIER FALLBACK (CUT C3).
```

| Task pattern | Lookup class | Primitive |
|---|---|---|
| "where is X defined" / "confirm X's definition location" | `definition` | capped `rg` (definition-shaped patterns, `--max-count`); `code_graph query` only as an opportunistic accelerant when an index is present + fresh + `hooks.code_graph.enabled: true` |
| "who calls / imports X" / "confirm call sites" | `references` | capped `rg` (reference-shaped patterns); same optional `code_graph affected` accelerant clause |
| "does string Y exist" / "probe candidate strings" | `string-existence` | FTS one-shot (`memory_lookup` for the knowledge corpus) or capped `rg -n --max-count` for the codebase |
| "run report Z" / "run check_*" | `report-run` | direct script run, wrapped per the **measured** rtk allowlist (`internal/bench/rtk-savings/RESULTS.md` — wrap only the ~55%-savings class) |

**Why rg-first for definition/references** (council debate 2026-07-28,
claude-sonnet-4-5 + gpt-4o, 2 rounds): the pre-registered benchmark behind the
`code-graph-retrieval-null` claim (`docs/CLAIMS.md`) measured native-graph
recall 0.365 vs grep 0.797 on graph-shaped questions, root cause an **indexing
gap** (TS arrow-function exports produce no symbol nodes) that hits structured
lookups exactly as it hits NL retrieval — and the recorded consequence bound
keeps `code_graph.enabled` false permanently. The accelerant clause is the
escape hatch that bound names ("unless external evidence appears"); today it
is inert.

**Escalation, not degradation:** a primitive that returns nothing (index miss,
pattern too ambiguous, report script absent) — **or an unusable result**
(empty, ambiguous between candidates, or visibly off-target because the
lookup pattern matched a task that was not actually a lookup, e.g. a
dynamically constructed symbol name) — escalates to the regular
classification path above — the answer quality bar never drops. The
"primitive ran but the result is unusable" case escalates exactly like the
"class unknown" case. `unknown` resolves to the regular path (`inherit`
semantics), never down-guessed.

Correctness floor: the golden comparison in `internal/bench/lean-init/`
(primitive answer ≡ agent answer on ≥10 lookup tasks, including the four
observed shapes); any mismatch is a routing bug, not a rounding error.

## v2+ (deferred, gated on Phase 6 evidence)

LLM-based classification — only if the deterministic rules prove too coarse
**and** the Phase-6 benchmark justifies the meta-call cost. It must be
budgeted (consume part of the N=3 autonomous budget) and opt-in. Not in v1.

## Reference implementation

The deterministic rules are encoded in
[`src/scripts/_lib/auto_dispatch.ts`](../../../../src/scripts/_lib/auto_dispatch.ts)
(`classifyTask`, `classifyLookup` for the lookup-class rung), covered by
[`tests/scripts/_lib_auto_dispatch.test.ts`](../../../../tests/scripts/_lib_auto_dispatch.test.ts)
and the lookup corpus in
[`src/scripts/_lib/auto_dispatch.corpus.test.ts`](../../../../src/scripts/_lib/auto_dispatch.corpus.test.ts)
(`LOOKUP_CORPUS` — the four live-observed shapes + negative controls).

## Related

- [`auto-orchestration-activation`](auto-orchestration-activation.md) — the enable/auto/manifest gate that runs before classification.
- [`subagent-orchestration`](../../skills/subagent-orchestration/SKILL.md) — the modes this selects.
- [`autonomous-execution`](../../rules/autonomous-execution.md) — the N=3 budget any LLM-classification v2 must respect.
