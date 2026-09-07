<!-- evidence-type: analysis -->

# Round `inbox-2026-09-u` — claim verification and step reproduction

Round consumed 2026-09-07 to `agents/tmp.old/inbox-2026-09-u/`. Twelve files in two topic
folders, both owner-directed: a standing-payload package (three roadmaps, one owner
instruction, one causal analysis, one chat transcript) and a code-graph package (two
roadmaps, two draft ADRs, one owner prompt, one chat transcript).

Verified against `0918def55` (v14.20.0, `origin/main`). Every figure below was re-derived
with the repository's own instruments; nothing was carried over from the artifacts.

## Triage

| file | genre | drafted-against | lineage | recurrence | disposition |
|---|---|---|---|---|---|
| `force-token-saving/road-to-delivery-for-every-host.md` | feature-spec | `6a98e0e` | n/a | first-seen | adopted, corrected |
| `force-token-saving/road-to-delivery-on-hook-hosts.md` | feature-spec | `6a98e0e` | n/a | first-seen | adopted, corrected |
| `force-token-saving/road-to-skill-menu-economy.md` | feature-spec | `6a98e0e` | n/a | first-seen | adopted, corrected |
| `force-token-saving/OWNER-INSTRUCTION-delivery-drain.md` | prompt | `6a98e0e` | n/a | first-seen | authorization record; rulings folded into the roadmaps |
| `force-token-saving/00-warum-es-nicht-passiert-ist.md` | external-review | `6a98e0e` | n/a | recurrence-marked | causes verified; see § Why it had not happened |
| `force-token-saving/chat.txt` | transcript | `6a98e0e` | n/a | first-seen | context only |
| `force-graph/road-to-a-graph-that-is-shipped.md` | feature-spec | `4c24be50` | ghost: `road-to-eleven` | first-seen | adopted, corrected |
| `force-graph/road-to-a-graph-that-wins.md` | feature-spec | `4c24be50` | ghost: `road-to-eleven` | first-seen | adopted, corrected, parked |
| `force-graph/ADR-257-…ship-with-the-package.md` | council-artifact | `4c24be50` | n/a | first-seen | adopted as **ADR-259** |
| `force-graph/ADR-258-…proposal-form.md` | council-artifact | `4c24be50` | n/a | first-seen | adopted as **ADR-260** |
| `force-graph/OWNER-PROMPT-2026-09-07.md` | prompt | `4c24be50` | n/a | first-seen | authorization record; § 5 unreceived, see below |
| `force-graph/chat.txt` | transcript | `4c24be50` | n/a | first-seen | context only |

Both source folders arrived under speaking names (`force-token-saving`, `force-graph`).
They were nested under the opaque round id `inbox-2026-09-u` before any tracked file quoted
a path, so no readable source name reaches the tree.

## Standing-payload package — claims

Reproduced directly: `./scripts-run src/scripts/check_preamble_payload_budget` at
`0918def55` reports project-scope rules **122,608 tok**, preloaded skills catalog **14,846
tok**, CLAUDE.md hierarchy **746 tok**, measured total **138,200 tok** against baseline
102,520 and design ceiling 107,646. Exit code 1 locally; CI passes only because the
workflow reads `--ceiling` from `ci_delivery.grace_ceiling` (138,273, measured 2026-09-02,
expiring **2026-11-10**). **73 tokens of headroom.** The artifact's total was exact.

| Claim | Verdict | Where |
|---|---|---|
| `mode ∈ {eager-all, thin, delivery}`, default `eager-all` | still-true | `_lib/lean_projection_mode.ts:19,21`; template `agent-settings.template.yml:198-199` |
| Mode read from `.agent-settings.yml` | still-true, line drift | body is `_lib/hook_settings.ts:90-112`; the drafted `:82-104` spans doc comment + signature |
| No host axis exists | still-true | zero hits for a `hosts:` key under `lean_projection:` anywhere in `src/` |
| Stub branch is host-independent | still-true | `condense.ts:741-745` (`TOOL_DIRS`), write at `:1187-1188` inside the `Object.entries` loop and before the `.claude/rules` branch |
| Stale parking comment ties delivery to the thin null | still-true | `condense.ts:1131-1134`, verbatim "parked behind the thin-projection honest null (thin win-rate 36.2% < the 48% pre-registered threshold)" |
| `rule-inject` row 20,480 B above slot sums 4,096 / 2,048; its reason assigns the move to the flipping run | still-true | `hook-token-budget.json:33`, reason `:34`, sums `:39-40` |
| `baseline_tokens` 102,520 · `design_ceiling` 107,646 · `grace_ceiling` 138,273 / 2026-11-10 | still-true | `preamble-payload-budget.json:23,80,81-83` |
| CLAIMS row: 120,582 → 18,573 BPE, 579/579 byte-equal, 94/94 reachable, 0 false fires on 194 near-misses, p95 0.61 ms | still-true | `docs/CLAIMS.md:365`, `status: backed`, `last_verified: 2026-08-23` |
| **CLAIMS:365 calls the flip "owner-reserved"** | **never-true** | the phrase is not in the row. It says Claude-only, default-off, unpaid activation charge, and that the run does not reopen ADR-202. The rulings rest on the owner instruction alone |
| 119 rule files: 102 `auto`, 9 `always`, 5 `manual`, 3 quoted-`auto` | still-true, **labels inverted** | 102 carry quoted `type: "auto"`, 3 carry bare `auto`. Magnitudes right; a step grepping one form would have missed 102 files instead of 3 |
| routing-matrix corpus 94 files | still-true | `tests/eval/routing-matrix/*.yaml` |
| 299 skills · `user-invocable` 2 · `disable-model-invocation` 1 · 100 labelled trigger sets | still-true | `src/skills/*/SKILL.md`, `src/skills/*/evals/triggers.json` |
| **Skill descriptions: median 184, max 206** | **never-true** | median **181**, max **200**, min 133, over two agreeing methods. `schemas/skill.schema.json:28` caps at 200 and its docstring records median 181 / p75 189 / max 200 with zero over 200 — **206 is structurally impossible** |
| 491 keyword and 212 phrase triggers | still-true | rule frontmatter |
| **Only 5 of 119 rules carry path-shaped triggers** | **never-true** | **21 of 119** — 41 `path_prefix` plus 13 `file_pattern` entries. Zero rules carry a host-native top-level `paths:` key, so no reading yields 5. The addressable population is 98 rules, not 114 |
| MUST-LOAD floor 26/26 | still-true | `_lib/value_ladder.ts:480`; `trigger_coverage` re-run green |
| Host table slot counts (Claude 9, Cowork 8, Augment/Cursor/Cline/Gemini 5, Windsurf 3, Copilot 0, Codex 0); only Claude refuses a deny | still-true | `docs/enforcement-by-host.md:18-28`, correction note `:21-23` |
| Cowork discards dispatcher output | still-true, line drift | `:21`, not `:20` |
| L4 row "no equivalent today" | still-true | `:176` |
| Cursor `:1300` and Cline `:1315` bind `user_prompt_submit`; `rule-inject` in neither list | still-true | `hook_manifest.yaml`; alias `:1407` |
| `block_config_weakening` treats `*-budget.json` as `advisory` → warn, never block | still-true | `hooks/block_config_weakening.ts:96-98`, `:174-181` |
| All seven referenced roadmaps exist | still-true | two `later/` token roadmaps, thin-flip, deferred-retriever, mixed-trigger, archived host-enforcement-truth, the carrier |
| **Estate: 8 active against a floor of 10, no offset needed** | **never-true** | 5 active at `origin/main`; the floor is the base-ref measurement, not a stored number — `estate-count-budget.json` holds none since ADR-243. The live reading is `active_roadmaps 8 (floor 4, +4)`, so every added file needs both `estate_growth_exempt` and `estate_offset_exempt` |

## Code-graph package — claims

| Claim | Verdict | Where |
|---|---|---|
| Parsers are devDependencies | still-true | `package.json:115` (`tree-sitter-wasms@0.1.13`), `:120` (`web-tree-sitter@0.24.7`) |
| 13 grammars = 8.7 MB; ADR-246's 51 MB is the whole pack | still-true | 8,896 KB (8.69 MiB) for the 13; whole `out/` 49 MiB over 36 files. ADR-246's own evidence line records the 51 MB as carried from `docs/MIGRATION.md`, "not re-measured here" |
| Nudge default-off, settings table calls it deprecated | still-true | `agent-settings.md:632` |
| **The hook's own header at `:12-15` says deprecated / honest null** | **never-true** | `grep -ni 'deprecat\|honest'` over `hooks/code_graph_nudge_hook.ts` returns zero. `:3` reads "deterministic, warn-only"; `:12-15` reads "Default-OFF … `fail_closed: false`". The deprecation exists only in the settings table |
| MCP server carries 30 tools, zero graph tools; hint still `npx -y` | **31**, not 30; rest still-true | `consumer_tool_catalog.json`, line 4 |
| **Every query does `readFileSync` + `JSON.parse` of the whole graph** | **never-true as stated** | `query.ts:32` prefers the SQLite twin (ADR-129, "~1/90 the load cost"); `readFileSync` at `:33` is the fallback. But `loadSerializedFromTwin` returns the whole serialized **string**, so `JSON.parse` (`:34`) and the full node/edge `Map` build run on **both** paths. The defect is real; its accurate name is **no query API** |
| `sqlite_store.ts` exports only three symbols / has no read API | **partly never-true** | six exports (`GRAPH_STORE_VERSION:36`, `sqliteTwinPath:40`, `emitSqliteTwin:54`, `loadSerializedFromTwin:122`, `twinCounts:155`, a type re-export `:174`). `loadSerializedFromTwin` *is* a read path; none of the six takes a node id, label or relation — so "no query API" is right and "no read API" is wrong |
| Regression selector documents a substitute graph | still-true | `_lib/regression_neighbourhood.ts:15-26` |
| Three external importers of the engine | still-true | `_lib/bench_ab_complexity.ts:64-65`, `hooks/code_graph_nudge_hook.ts:25`, `hooks/concern_registry.ts:61` |
| "No class is graph-first" in the skill | still-true | `src/skills/code-intelligence/SKILL.md:164` |
| **ADR numbers 257 and 258 are free** | **never-true** | both taken, both `status: accepted`, both dated 2026-09-07: 257 `unpaid-route-may-propose-and-score-never-decide`, 258 `prose-tell-detector-scope-and-rejected-absolutes`. Landed here as **259** and **260** |
| **Evidence round `agents/tmp/road-to-eleven/`** | **never-true** | present in no location — not `agents/tmp/`, not `agents/tmp.old/` (373 entries), in neither checkout. Both drafts cite it as their own basis. Corrected to `inbox-2026-09-u`; the eleven-proposal verification they allude to is `inbox-2026-09-r` |
| Eleven master proposals verified, none adoptable, 48 slugs of which 35 absent | still-true | `agents/evidence/analysis/inbox-2026-09-r-verification.md:4-13,44-45` |
| ADR-255 has real `§ 1`–`§ 5` sections; § 4 is the kernel refusal | still-true | `ADR-255:89,108,118,131,143`; § 4's refusals additionally denied at tool-call time by `hooks/block_kernel_rule_writes.ts` |
| ADR-254 asks for typed transitions rather than a regex | still-true | `ADR-254:25-34`, restated `:149` |
| `lint_consolidation_lineage` already checks a named receiver exists | **partly never-true** | it has `missing-parent` (`:45-46`, emitted `:344-348`) for a declared *parent*; its own honest-limit note `:566-585` scopes it further. The receiver check ADR-260 § 4 requires is new work |
| `host_semantics.ts` under `src/scripts/_lib/` | **never-true** | it is `src/scripts/hooks/host_semantics.ts`, `VERIFIED_PLATFORMS` at `:61` |
| 14.18.0 shipped 55 governance-only against 16 consumer-only | still-true, **moved** | now `docs/archive/CHANGELOG-pre-14.19.0.md:26`; the live `CHANGELOG.md` carries a different mix that must not be read as the same claim |
| ADR-246's benchmark reopen trigger is unevaluated | **never-true** | evaluated 2026-08-28 and again 2026-09-04 and recorded as **not fired**: zero of four classes met the +10 pp bar, every class tied, `path-between` grep 0.917 against graph 1.000 for +8.3 pp (`internal/bench/reports/code-graph-vs-grep-inrepo-v2-rerun-2026-09-04.md:74-83`). ADR-259 therefore rests on consumer-reachability alone |

## Step reproduction

Selected by the two stated criteria — an asserted outcome, or a phrasing as a reusable
procedure. Bound: this tree, read-only, offline, no secrets, writes only to gitignored
paths. Nothing was mutated to make a step reproducible.

| # | Step (verbatim, abbreviated) | Author | How | Verdict |
|---|---|---|---|---|
| 1 | "Die drei `road-to-*.md` nach `agents/roadmaps/` committen … Die Frontmatter ist ohne `status: draft`, also `ready`" | user | placed all four active files, ran the six roadmap gates | **diverged** — `lint_plan_risk_register` returned three `missing_register` violations. Template rule 24 requires a `## Risk Register` with the `<!-- risk-review: … -->` marker on every ready roadmap; none of the three carried one. The gate runs at pre-push, so the instruction as written could not have been followed to a push |
| 2 | "Estate steht bei 8 aktiven gegen Floor 10 — kein Offset nötig" | agent | `check_estate_count` | **diverged** — `active_roadmaps 8 (floor 4 at origin/main, +4)`, red on two metrics. The floor is the base-ref measurement, and `estate_growth_exempt` alone does not clear the file-based one-in-one-out half; `road-to-a-graph-that-is-shipped` carried no `estate_offset_exempt` |
| 3 | "`agents/roadmaps/later/road-to-a-graph-that-wins.md` als `later` mit Wake-Condition" | user | `lint_roadmap_later_disposition` | **diverged** — the gate does not recognise a `wake_condition:` key at all: 19 violations against a baseline of 18, one new. It requires a structured three-part `entry_condition` (`what`/`when`/`who`) or a `Blocked until` / `Resume when` body line. Rewritten as `entry_condition:` |
| 4 | "ADR-257 … nach `docs/decisions/`" and "ADR-258 ebenso" | user | `ls docs/decisions/` | **unexecutable** — both numbers accepted since 2026-09-07. Landed as 259 / 260; five reference classes renumbered (filename, `adr:` field, H1, roadmap prose, the parked file's entry condition) |
| 5 | `supersedes: ADR-255 (§ 1, § 2, § 3, § 5 — owner ruling …)` | agent | `adr/regenerate_index --dir=docs/decisions` | **diverged** — four parse errors; the field takes a plain reference. Reduced to `supersedes: ADR-255` with the partial scope stated in the body and mirrored into ADR-255's own Status block |
| 6 | "`grep -c grace_ceiling …` = 0" as an exit condition | user | read `preamble-payload-budget.json:79-83` | **reproduced** — one `grace_ceiling` key plus a `grace_ceiling_history` block; the grep as written counts both, so Phase 4.4 must delete the history entry too or the check never reaches 0. Recorded in the step |
| 7 | "`./scripts-run src/scripts/check_preamble_payload_budget`" as the measurement of record | user | ran it | **reproduced** — 138,200 tok total, exactly the artifact's figure. Local exit 1 against the design ceiling; the grace ceiling is a CI-only `--ceiling` argument |
| 8 | "`agents/tmp/road-to-eleven/docs/decisions/ADR-257-*.md`" as the source path | user | `find` across both checkouts and `tmp.old/` | **unexecutable** — the path exists nowhere |
| 9 | "der v2-Benchmark bleibt byte-identisch" (AC-6) | agent | read the v2 rerun report | **reproduced** — the corpus and its bars are in-tree and re-runnable; AC-6 is checkable as written |
| 10 | "`npm install @event4u/agent-config` in einem leeren Verzeichnis … baut einen Graphen" | user | not attempted | **out-of-bound** — a real install plus a build writes outside the repo and takes network. It is Phase 1.1's own verify line, which is where it belongs |
| 11 | "`impact --diff` antwortet aus SQLite" | user | not attempted | **out-of-bound** — the verb does not exist yet; that is the work, not a probe |
| 12 | "Typed Authority … auf dem reversiblen Fixture-Set null Fragen" | user | not attempted | **out-of-bound** — no fixture set exists, and building one is implementation. Raised as an owner question instead |

Ceiling: none fired. Twelve steps selected, twelve rows written.

## Why it had not happened — the three causes, checked

The causal analysis in the round names three structural blockers. All three verify, and one
needed a correction:

1. **The roadmaps were never in the repo.** Verified by construction: they arrived as
   downloads and no roadmap under `agents/roadmaps/` at this pin holds the standing-payload
   surface. This change is the repair.
2. **Owner decisions route to a council whose precedent refuses exactly these steps** —
   a slot-row raise and a baseline lowering. Verified in shape: the activation charge *is*
   a slot-row move (`hook-token-budget.json:33,39-40`) and the baseline *is* a ratchet
   surface. The correction: `block_config_weakening.ts:96-98` classifies `*-budget.json` as
   `advisory`, so the deterministic guard warns and never blocks. The obstacle was the
   routing convention, not the guard.
3. **The thin honest-null contaminates delivery.** Verified verbatim at
   `condense.ts:1131-1134`. Repaired by Phase 4.0 of the first roadmap and forbidden by its
   K7.

## Point ledger

```
claims        58 extracted → 39 still-true · 8 still-true-with-line-or-label-drift
                             · 11 never-true · 0 already-fixed · 0 unverifiable
instructions  12 extracted →  3 reproduced ·  5 diverged ·  2 unexecutable
                             · 3 out-of-bound · 0 not-attempted
demands        9 extracted →  7 adopted ·  1 already-satisfied ·  0 declined
                             · 1 owner-decision
```

Demands, itemised: implement token saving regardless of ADRs, gates or council decisions
(**adopted** — the rulings are in the roadmap texts, ADR-259/260 carry
`reopen_policy: owner`); implement the graph (**adopted**); treat the drafts as roadmaps
rather than ideas (**adopted** — all five landed, four ready and one parked); honour the
prompt files (**adopted** — every ruling they carry is folded into a roadmap or an ADR, and
their forbidden-list items became kill-register rows); address the small problems as well
(**adopted** — the five diverged and two unexecutable steps above); go deep into the
analysis (**adopted** — this artefact); do it in a worktree and open a PR
(**adopted**); no council for these questions (**already-satisfied** — none was run);
land typed authority per ADR-260 § 2 (**owner-decision** — see below).

## Owner decision required

**ADR-260 §§ 2 and 3 name mechanical work with no receiver roadmap in the estate.** Typed
grant objects, the closed op vocabulary, the narrowed Hard-Floor rows, the
`personal.autonomy` default flip and the consequence-aware `tool-safety` rebuild are all
decided by that record and unscheduled by any file. The owner prompt lists typed authority
as its fifth deliverable, so the gap is real rather than an omission in the ruling.

It was left unauthored deliberately: ADR-260 § 4 forbids a roadmap that names a receiver
which does not exist, and authoring a sixth roadmap in this change would have gone beyond
the five files the round delivered. The choice is the owner's — schedule a receiver
roadmap, or let § 2 stand as a recorded decision until a later cycle.

## What this change did not do

It authored and recorded. It executed no roadmap step: `scope-control` § Authoring vs
implementation is why the five files land as plans rather than as a flipped default, and
the standing payload at this pin is unchanged at 138,200 tok.
