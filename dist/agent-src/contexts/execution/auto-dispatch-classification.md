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
- Anything that fails to match a signal above, once past the activation gate
  and the size floor, is **ambiguous** → **ask**, always — a verdict to the
  user, never a speculative spawn (always-on orchestration: there is no more
  `subagents.auto` setting to route this on).

## Mode selection summary

| Signal | Mode |
|---|---|
| `parallelizable: steps` / ordered plan | `do-in-steps` |
| `parallelizable: files\|independent` / independent slices | `do-in-parallel` |
| change needing verification (any of the above) | implementer + cross-model judge per the `subagent-orchestration` Iron Law |

## Judgment ladder (Phase 2 — road-to-always-on-orchestration)

One committed table replacing three scattered classification surfaces
(the delegable-signal rules above, ad-hoc "should this be a team" calls,
and the absence of any council-routing signal on the task side). Resolver:
[`judgment_ladder.ts`](../../../../src/scripts/_lib/judgment_ladder.ts)
(`classifyLadder`) — a WRAPPER around `classifyTask`, never a replacement:
rungs 1 and 2 ARE `classifyTask`'s existing dispatch verdict.

| Rung | Shape signals | Resolves to |
|---|---|---|
| 0 | mechanical transform, no semantics (rename / codemod / formatter-run / bulk search-and-replace), OR a lookup-class match (§ Lookup-class rung above) | deterministic script, no spawn |
| 1 | single bounded read-heavy slice (`classifyTask` structurally cannot see this — it requires ≥2 slices, an ordered plan, or a declared `parallelizable` value) | one subagent, `lite` tier |
| 2 | enumerable independent slices, or an ordered plan (`classifyTask` dispatch: `do-in-parallel` / `do-in-steps` both land here in this v1 — see the resolver's doc comment for why) | parallel subagents, downshifted |
| 3 | slices that must communicate (cross-layer work, a review-with-challenge shape, an explicit shared task list) | team — only when the host reports `agent_teams: true`; else degrades to whatever `classifyTask` resolves on the same signals (usually rung 2), with a recorded `degraded_from: 3` line — never a fabricated slice count |
| 4 | judgment under disagreement (a design decision, a proposed security downgrade, a release-gate escalation) | council |
| ∅ | interactive-approval-required (caller-stated), trivial (below the size floor), or ambiguous | in-session; ambiguity is an `ask` VERDICT, never a speculative spawn |

```
AMBIGUITY NEVER SPAWNS. RUNG 0 NEVER SPAWNS EITHER — IT NEVER NEEDED TO.
A MATCHED RUNG-3/4 SIGNAL WITHOUT ITS HOST PRECONDITION DEGRADES,
RECORDED — IT NEVER SILENTLY DROPS TO ∅.
```

**Resolution order is fixed and documented on `classifyLadder` itself**:
interactive-approval-required → rung 0 → recursive-dispatch guard →
activation gate → rung 4 → rung 3 (+ degrade) → rungs 1/2. Two signals
matching the same text resolve deterministically on this order, never on
evaluation-order accident.

**Recursive-dispatch guard (2.3) — honest scope.** No verified host
discriminator exists for "is this classification running inside a
subagent/teammate session", and no field in this repo's hook envelope carries
session lineage. The guard is therefore a CALLER-SUPPLIED fact
(`insideSubagentSession`), never a `process.env` probe for an unverified
variable name. When set, it resolves ∅ (in-session) for rungs 1-4; rung 0 is
exempt (it never spawns).

**Relationship to the council's own necessity gate.** Rung 4's three
signals (design decision / security downgrade / release-gate escalation)
are a deliberately narrow, TASK-side vocabulary — NOT an import of
`ai_council/necessity.ts`'s broader `NECESSARY_TRIGGERS`
(architecture/tradeoff/ambiguity/strategic). That module stays the
council's own necessity gate (its `off|educate|block|warn-only` modes are
the council-side surface); this resolver only decides whether a TASK
should route to rung 4 in the first place.

## Cheapest-sufficient-model table (Phase 2.4 — the ladder's tie-breaker)

Once a slice resolves to rung 1 or 2, this table is the tie-breaker
`classifyLadder`'s caller consults for the concrete tier — `lite` by
default, escalating only on a named criterion. Consolidates mechanisms that
already exist elsewhere in this contract set; this table is the ONE place
that lists them side by side.

| Escalation criterion | Tier | Basis |
|---|---|---|
| (none — default) | `lite` | the downshift default (`subagent-routing.md`) |
| Slice failed verification on its current tier | next tier up (`lite`→`medium`→`medium`→`high`) | [`subagent-steering`](subagent-steering.md) § Verify-fail escalation cascade |
| Slice touches ≥ 5 files (or > 200 lines) | `medium` | the ticket-bundle `lite` size floor (`docs/contracts/ticket-bundle-format.md`) |
| Architecture-shaped slice (structural/boundary decision — the same shape as rung 4's design-decision signal, one level down in stakes) | `medium` | [`subagent-modes-detail`](subagent-modes-detail.md) § Severity-conditioned team composition |
| Security-sensitive slice (auth, tenant, secrets, billing — `security-sensitive-stop`'s surface table) | `high` | [`subagent-modes-detail`](subagent-modes-detail.md) § Critical severity row |

Criteria are independent and additive in the obvious way (a slice matching
two rows takes the higher of the two tiers); this table never lowers a
tier `inferSliceTier` (§ below) already raised.

## Cross-vendor worker direction (declared, not implemented)

Deny-by-default — a direction not listed here is denied. Direction rules,
payload allow/deny lists, the report-only boundary, the no-recursion clause and
the human egress gate:
[`cross-vendor-worker-direction`](../../../../docs/contracts/cross-vendor-worker-direction.md).
Role pairs, never vendor names — `classifyLadder` carries no vendor identity
([`subagent-routing`](subagent-routing.md) § Why vendor-neutral).

Rung-1/2 slices only.

| # | Direction (role pair) | Resolves to |
|---|---|---|
| CV-1 | a worker on the **non-authoring** vendor reviews the **authoring** vendor's output | report-only worker |
| CV-2 | the mirror of CV-1 | report-only worker |

```
DIRECTION PERMITTED + PAYLOAD ALLOWED + HUMAN APPROVED = MAY SEND.
ANY ONE MISSING = MAY NOT.
A CROSS-VENDOR WORKER NEVER IMPLEMENTS, WRITES, COMMITS, ACTS,
OR DISPATCHES ONWARD.
```

Nothing reads CV-1/CV-2 at runtime: a contract surface a future implementation
must satisfy, replacing the phantom artefact the original survey cited.

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

**Why rg-first** (council 2026-07-28, 2 rounds): the pre-registered benchmark
behind the `code-graph-retrieval-null` claim (`docs/CLAIMS.md`) measured
native-graph recall 0.365 vs grep 0.797 on graph-shaped questions — an
indexing gap that keeps `code_graph.enabled` false BY DEFAULT — not
permanently: the 2026-08-15 withdrawal retracted that, and the figures predate
the 2026-08-22 extractor repair. The accelerant clause above is that bound's
escape hatch; `classifyLookup` reads the flag, so turning it on is the whole
change.

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

- `classifyTask` / `classifyLookup` —
  [`auto_dispatch.ts`](../../../../src/scripts/_lib/auto_dispatch.ts)
- `classifyLadder` + the rung-0/1/3/4 signal detectors —
  [`judgment_ladder.ts`](../../../../src/scripts/_lib/judgment_ladder.ts)
- First production caller —
  [`delegation_nudge_hook.ts`](../../../../src/scripts/hooks/delegation_nudge_hook.ts):
  its injected line cites the resolved rung, scoped to the dispatch rungs
  (1/2); a rung-0/3/4 verdict stays silent on this carrier.

Each has a sibling `*.test.ts` under `tests/scripts/` covering every rung, the
rung-3 degrade path, the recursive-dispatch guard and every ∅ case.

## Related

- [`auto-orchestration-activation`](auto-orchestration-activation.md) — the enable/auto/manifest gate that runs before classification.
- [`subagent-orchestration`](../../skills/subagent-orchestration/SKILL.md) — the modes this selects.
- [`autonomous-execution`](../../rules/autonomous-execution.md) — the N=3 budget any LLM-classification v2 must respect.
- [`orchestration-telemetry`](orchestration-telemetry.md) § Registered always-on metrics — the judgment-ladder precision metric this ladder feeds.
