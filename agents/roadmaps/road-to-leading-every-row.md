---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "This file is the receiver that two active roadmaps already cite in their estate_offset_exempt lines (road-to-a-kernel-that-guards-its-plumbing.md:6, road-to-a-menu-whose-precision-is-measured.md:15) and that does not exist at 9bc8cd4; ADR-260 § 4 forbids naming a receiver absent at the tree pin, so the estate is one file short, not one over."
estate_growth_exempt: "One programme file plus six lanes (road-to-a-graph-that-feeds-the-gate, road-to-touched-files-that-pass-their-own-tools, road-to-stacks-beyond-php, road-to-learning-you-can-see, road-to-a-tree-that-keeps-its-neighbours, road-to-neighbours-that-pull-their-weight) plus one parked file (later/road-to-federation-behind-adr-278) land as one set from inbox round inbox-2026-10-b. Each lane carries a defect re-measured at 9bc8cd4 and cited by file:line in its Goal; none re-plans a receiver that exists. The open-blocker growth is the seven owner questions below plus the lanes' own, each newly posed in this set. The supplied bundle proposed twenty-four files; sixteen became no file (kill register below)."
relates:
  - slug: road-to-a-kernel-that-guards-its-plumbing
    relation: disjoint
    note: "cites this file as its receiver; nothing here re-plans it"
  - slug: road-to-a-menu-whose-precision-is-measured
    relation: disjoint
    note: "cites this file as its receiver; nothing here re-plans it"
  - slug: road-to-a-stop-that-holds
    relation: disjoint
    note: "the completion-truth row; its detector-C rewrite and verification_runs landed, nothing here re-plans them"
  - slug: road-to-a-graph-that-feeds-the-gate
    relation: disjoint
    note: "lane, this set"
  - slug: road-to-touched-files-that-pass-their-own-tools
    relation: disjoint
    note: "lane, this set"
  - slug: road-to-stacks-beyond-php
    relation: disjoint
    note: "lane, this set; carries blocker b5's decision row"
  - slug: road-to-learning-you-can-see
    relation: disjoint
    note: "lane, this set"
  - slug: road-to-a-tree-that-keeps-its-neighbours
    relation: disjoint
    note: "neighbour lane 1, this set; carries b7's mechanism"
  - slug: road-to-neighbours-that-pull-their-weight
    relation: disjoint
    note: "neighbour lane 2, this set; carries blocker b6's decision row"
  - slug: road-to-federation-behind-adr-278
    relation: disjoint
    note: "parked; wakes on blocker b8's ADR"
  - slug: road-to-a-graph-that-wins
    relation: disjoint
    note: "parked; blocker b4 is its wake condition. Its Phase 3 is NOT the gate feeder of the graph lane (see Decisions D2)"
---
# Road to leading every row

> **Source:** `agents/tmp.old/inbox-2026-10-b/` — an owner chat plus a two-author
> proposal set comparing this tree, row by row, against four external agent
> packages (a code-graph tool, an orchestration-and-memory platform, a curated
> host-config collection, a UI/UX skill bundle). Every file:line below was
> re-read at `9bc8cd4`; the proposals were drafted at `eb2cc9ea`, 218 commits
> earlier. Identities are in the round's encrypted intake note only.
> **Arrivals:** 2 — latest `inbox-2026-10-b` (2026-10-01); earlier: `inbox-2026-09-ab`
> (topic `t06`, which carried this file's first draft and landed four of its lanes).

## Goal

Every specialist row on which an external package leads this tree has exactly one
owner lane in the tree, one defect re-measured at the pin at its head, and its owner
decision recorded as a structured blocker below. Falsifiable at
`9bc8cd4`: two active roadmaps cite this file as their receiver
(`agents/roadmaps/road-to-a-kernel-that-guards-its-plumbing.md:6`,
`agents/roadmaps/road-to-a-menu-whose-precision-is-measured.md:15`; a third citer,
`archive/road-to-hooks-on-every-host.md:6`, is archived) and the file is absent, which
ADR-260 § 4 (`docs/decisions/ADR-260-*.md:110-115`) forbids. Done: the file exists, every
receiver in the row table exists, and each of the seven blockers is `resolved` or
carries `asked: yes`.

The owner's constraint governs every lane: this suite keeps doing natively what the
neighbours do (outcome parity, not feature cloning), uses an installed neighbour where
it is measurably better, and never lets a neighbour cancel, shadow or bypass its own
floors. The honest limit is stated once here: load order and context order belong to
the host, so this suite can guarantee only what it enforces as an effect (a deny, a
blocking stop) and can only make visible what a neighbour does as prose.

## Why the rows are where they are

Re-measured at `9bc8cd4`:

| Row | Where a neighbour leads | Where this tree stands | Owner |
|---|---|---|---|
| Code intelligence | many grammars, node/neighbour tools, per-target freshness | trust-typed gate verbs (`src/scripts/code_graph/verbs.ts:215,300,353,439`); the context hook matches `[Grep, Glob, Read]` only (`src/scripts/hook_manifest.yaml:511`) and staleness cannot see an uncommitted edit (`code_graph/detect.ts:50-77`) | `road-to-a-graph-that-feeds-the-gate`; languages and benchmark stay in `later/road-to-a-graph-that-wins` |
| Completion truth | — | one classifier shared by both checks (`src/scripts/before_complete_hook.ts:68`, `hooks/turn_end_gate_hook.ts:189` import `_lib/verification_command`) | `road-to-a-stop-that-holds` (its open items are deferred) |
| Post-edit hygiene | formatter and typecheck on touched files at stop | `grep -c 'format\|prettier\|typecheck' src/scripts/hook_manifest.yaml` → 0 | `road-to-touched-files-that-pass-their-own-tools` |
| Stack breadth | many language rule sets and language-named skills | `src/domains/laravel/pack.yaml:2` 25 artefacts; `src/packs/{python,typescript}/pack.yaml:2` 1 each | `road-to-stacks-beyond-php` |
| Learning | a visible learned-pattern status | sidecar sound and read-only (`src/scripts/learning_sidecar.ts:1-27`), default OFF (`src/config/agent-settings.template.yml:1379`), and the maintainer intake holds no signal | `road-to-learning-you-can-see` |
| Session memory | per-prompt recall; a transcript archive | curated memory with provenance, contradiction and eviction | killed — K5, K6, K19 |
| Multi-agent | out-of-host executors, daemons | typed return with five states (`src/skills/subagent-orchestration/schemas/subagent-status.json:12`); return gate parked (stub, 28 arrivals) | blocker b1; executor killed K9, K18 |
| Coexistence | three of four packages keep a neighbour's entries | `deep_merge` replaces every array (`src/scripts/install.ts:515-516`) on seven hook-writing call sites; `_cleanDir` deletes foreign rule files (`src/install/emit_host_rules_cli.ts:63-85`); `docs/CLAIMS.md:287-292` claims the opposite | `road-to-a-tree-that-keeps-its-neighbours` |
| Orchestration of neighbours | one of four packages defers to the repo's rules | the ranker unions foreign skill roots and drops a same-named second skill (`_lib/skill_catalogue.ts:183-206`, `skill_tools/score_skill_relevance.ts:182-193`); no precedence between this suite and a neighbour's always-on text | `road-to-neighbours-that-pull-their-weight` |
| Federation (invoking a neighbour) | none of the four invokes another | ADR-088 § 3 (`docs/decisions/ADR-088-*.md:95-105`) requires an owner ADR first; highest ADR at the pin is 277 | `later/road-to-federation-behind-adr-278` — blocker b8 |
| Outcome benchmark | — | `stubs/road-to-assurance-benchmark.md:28-46` plans the frozen corpus and ablations; its `review_by` (2026-09-25) has lapsed | the stub; this round's delta is folded there |

Three neighbour rows market more than they ship and are not rows to chase: swarm
topologies that persist JSON and sleep, a truth score with no command, and a learning
loop whose observer ships disabled. Named once so no later round re-derives them.

## Phase 1 — Repair the citation, record the set

- [x] **1.1 This file exists at the path the two active lanes cite.** No content change
      to the citing lanes; the finding was the absence.
      verify: `test -f agents/roadmaps/road-to-leading-every-row.md` -> 0
- [x] **1.2 Every receiver in the row table exists at the pin.** The supplied loop's
      regex `road-to-[a-z-]+` stops at the first digit and reported the parked file as
      missing on every run; the corrected pattern admits digits.
      verify: `for s in $(grep -oE 'road-to-[a-z0-9-]+' agents/roadmaps/road-to-leading-every-row.md | sort -u); do find agents/roadmaps -name "$s.md" | grep -q . || echo MISSING $s; done` -> /^$/
- [x] **1.3 Record the commit mix at this pin as the programme's baseline.** At
      `9bc8cd4` the top `feat|fix` scopes over the last 400 commits are `hooks` 11,
      `roadmap` 10, `scripts` 8, `install` 8, `gates` 6, against `skills` 1. The figure
      is the reading blocker b2 decides on, so it is written once with its command and
      date in `agents/evidence/analysis/commit-mix-baseline-2026-10.md`.
      verify: `grep -cE '^\| hooks \| 11 \|' agents/evidence/analysis/commit-mix-baseline-2026-10.md` -> /^1$/

## Phase 2 — The install command above the fold

- [x] **2.1 Move the `npx` install block directly under the README's "Try it in 30
      seconds" link.** `README.md:11` links to a curl snippet (`:26-31`); the
      `npx -y @event4u/agent-config init` block sits at `:171`, after roughly 1,600
      words. Move the block, keep the curl path as the second option, change no other
      line. A check that pins a README line number is repointed in the same diff.
      verify: `awk '/npx -y @event4u\/agent-config init/{print NR; exit}' README.md` -> /^[1-4][0-9]$/

## Phase 3 — Owner decisions, then nothing else here

- [x] **3.1 Put the seven questions in `## Blockers` to the owner in one sitting.** Each
      carries a recommendation and the cost of no decision; a question unasked keeps its
      marker and the lanes that depend on it land their unblocked phases regardless.
      <!-- blocked-by: b1-subagent-return | asked: yes — all seven put to the owner verbatim 2026-10-01 in the PR body of the drain run that closed this phase; each blocker keeps its own Status until the owner answers it -->
      verify: `grep -c 'asked: yes' agents/roadmaps/road-to-leading-every-row.md` -> /[1-9]/
- [ ] **3.2 Record each answer as a `## Decisions` row in the lane or stub it unblocks**,
      not here. This file keeps questions; lanes keep decisions.
      verify: `grep -c 'PENDING' agents/roadmaps/road-to-stacks-beyond-php.md agents/roadmaps/road-to-neighbours-that-pull-their-weight.md` -> /:0$/

## Kill register

What the round proposed and this tree already decided against, with the citation
re-read at `9bc8cd4`. IDs K1–K26 are the first author's; the second author reused
K17–K22 for different items, which are renumbered K27–K32 here so one ID means one thing.

| ID | Proposal | Killed by | Note |
|---|---|---|---|
| K1 | Flip `hooks.code_graph.enabled` to true | `src/scripts/hooks/code_graph_context_hook.ts:5-9` | the flag gates nothing; the key stays registered per `docs/contracts/settings-classes.md:623` |
| K2 | Wire more grammars in this set | `later/road-to-a-graph-that-wins.md:53-61`, ADR-259 | already the parked lane's Phase 1 |
| K3 | Community detection, god-node ranking | `archive/road-to-native-code-intelligence.md:111-113` | no demand signal recorded |
| K4 | Experience signal as a routing weight | `later/road-to-experience-loop-owner-decisions.md:48-71` (decision 9.6), `src/scripts/_lib/experience_report.ts:17-18` | owner-reserved; test-enforced import ban |
| K5 | Transcript archive across compaction | ADR-249 § Not reopened (`:170-180`), ADR-124 § 6 (`:185-188`) | a state store by ADR-124's test |
| K6 | Per-prompt top-k memory recall | `stubs/road-to-compaction-survival-census.md:44-90` | the census needs a live host reading first |
| K7 | A `SubagentStop` gate now | `stubs/road-to-subagent-return-gate.md:44-64` | council refused a reopen; only b1 moves it |
| K8 | Plugin carries content | ADR-209 (`:48-56`) | channel deprecated on purpose |
| K9 | Headless worker draining roadmap steps | ADR-206 (`:58-62`), `stubs/road-to-runtime-orchestration-substrate.md:98-109` | tracks gated, none promoted |
| K10 | Reviewer subagents per stack | `later/road-to-database-evolution-tactics.md:132` | CUT precedent: duplicate surface |
| K11 | Stack rules via `paths:` globs | ADR-227 (`:50-55`) | rejected as a corpus lever |
| K12 | Consumer-first ratio as a per-PR gate | ADR-253; ADR-260 § 1 (`:67-75`) | release guard only — b2 |
| K13 | Vendor-specific adapters | ADR-088 § 2; `src/scripts/check_no_external_sources.ts:381-385` scans paths | a neighbour is a shape, never a name |
| K14 | Static rule-contradiction detector across ours and a neighbour's | `docs/contracts/rule-interactions.md:18-29` | 67 % false positives at full recall |
| K15 | Writing `permissions.deny` for unused foreign MCP tools | Class C; `_lib/host_permission_checks.ts` only reads | counted by use; a write is an owner decision |
| K16 | Hiding an overlapping neighbour skill | ADR-124 doctrine, orchestrator first | shown with `also:`; the consumer installed it |
| K17 | External runtime broker with facade verbs | ADR-088 `:78-80`, ADR-206 `:58-62`, ADR-109, ADR-041 `:73-76` | a new verb requires an ADR |
| K18 | Session task DAG, leases, join packet | substrate stub, "None promoted, 2026-09-15"; ADR-124 § 6 | the typed return already exists |
| K19 | Memory envelope with `contradicts`/`expires`, semantic tier | `check_memory.ts:55-70`, `check_memory_contradiction.ts`, `memory_eviction.ts`; ADR-249 `:174-180` | bestand |
| K20 | Adaptive routing plane with outcome attribution | `_lib/experience_report.ts:17-18`, decision 9.6 | owner-reserved |
| K21 | Causal self-improvement with automated promotion | `learning_sidecar.ts:11-22`, ADR-094 `:71`, `later/road-to-ac-deep-capabilities.md:163-192` | Workstream C already is this, parked |
| K22 | Cross-host runner that writes `verified:` rows | `src/agent-src/contexts/execution/host-capability-manifest.md:115-121` | rows come from a real session, never a script |
| K23 | Intelligence provider broker | `src/rules/external-code-graph-interop.md:33-39`, `code_graph/detect.ts:127-134` | consumer-first, never-union already hold |
| K24 | Automatic use of remote or floating providers after a scan | `docs/contracts/skill-scout-quarantine.md:29-36`, ADR-249 `:186-189` | the egress leg needs a human gate |
| K25 | A second benchmark harness for provider arms | `stubs/road-to-assurance-benchmark.md`, `_lib/paired_verdict.ts:1-16` | arms of the existing corpus |
| K26 | Authority bands headed by the user's turn | `src/rules/agent-authority.md:12-26` ("Hard Floor wins, always") | the second author's eight-band order re-imports this; source precedence sits below the four bands |
| K27 | A standalone provider-manifest database | `docs/contracts/installed-tools-lockfile.md:30-52` | a derived census, never a second truth store |
| K28 | A semantic compiler over every foreign rule | K14's measurement | the same failure in another shape |
| K29 | Automatic exposure of a neighbour's raw tool catalogue | ADR-041 `:73-76` | smallest capability surface |
| K30 | Provider installed means provider preferred | K4, K20 | presence is not utility |
| K31 | Copy every neighbour feature natively | the owner's own correction in the chat: outcome parity | outcome rows, not feature count |
| K32 | Runtime federation hidden inside a coexistence fix | ADR-088 § 3 | an explicit ADR first — b8 |
| K33 | A separate effect-ledger lane recording every foreign hook's start, end and effect | no host exposes foreign hook execution to another hook | folded: our concerns declare an effect and foreign effects read `unknown` in the tree lane |
| K34 | A runtime client for MCP protocol capability discovery | `src/` has no MCP client; ADR-088 § 1 outbound coupling | an input to ADR-278 (b8), recorded in the parked file |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | profiles do not get hook flags | `src/scripts/_lib/agent_settings.ts:325-333` — profiles are installer placeholder substitution, there is no runtime profile layer; `hooks.*.enabled` are Class C (`docs/contracts/settings-classes.md:610-626`) and the kernel lane refuses agent writes to them | a runtime profile layer is introduced |
| D2 | deterministic | evidence | the supplied blocker "carve Phase 3 of the parked graph lane out ahead of its wake condition" is dropped | `later/road-to-a-graph-that-wins.md:86-105` — that Phase 3 is edge policy, tampering and silent-catch detectors, finding invalidation; none of it is the detector-F feeder the graph lane plans, so there is nothing to carve | the graph lane's Phase 3 needs a step of the parked Phase 3 |
| D3 | reversible-technical | agent | the second author's master file lands as no file | every phase is a lane step here, bestand (typed return, memory, interop), parked (Workstream C, substrate), or a collision (K18, K20, K22, K26) | a phase is shown to have no owner here |
| D4 | reversible-technical | agent | the outcome-benchmark delta (≥ 8 task classes; arms native / provider direct / combined) is written into the assurance-benchmark stub, not a new file | `stubs/road-to-assurance-benchmark.md:28-46` plans the corpus and ablations | the stub is closed |

## Blockers

### blocker: b1-subagent-return
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 3 — Owner decisions, then nothing else here
- **Question:** Which of the four options posed in `agents/roadmaps/stubs/road-to-subagent-return-gate.md:20-32` moves the 27-arrival subject?
- **Recommendation:** Option 4, keyed on `no_envelope`. Read 2026-10-01 in the maintainer checkout's `agents/runtime/state/subagent-ledger/*.jsonl`: `no_envelope` 24,964, `absent` 4,543, `foreign_object` 54, `fail` 42, `ok` 0, `no_message` 0 — the probe keys on a verdict that has never fired.
- **If you do nothing:** the subject arrives a twenty-eighth time and the hook keeps validating and dropping.
- **What to do:** pick exactly one — (a) option 4: replace the stub's `no_message` probe with `no_envelope` and set a shadow window; (b) option 2: close the stub and record the three measured facts; (c) option 1: keep the probe unchanged.
- **Resolved when:** the stub records the chosen option as a `## Decisions` row, or `grep -c 'no_envelope' agents/roadmaps/stubs/road-to-subagent-return-gate.md` -> /[1-9]/ for (a).

### blocker: b2-consumer-first-rearm
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 1 — Repair the citation, record the set
- **Question:** Is ADR-260 § 1 (consumer-only ≥ governance-only per release, `:67-75`, window 14.19–14.21) re-armed for the next three release cuts?
- **Recommendation:** Re-arm as a release guard, never a PR gate (ADR-253 stands), read by `./scripts-run src/scripts/measure_release_mix --from <last-tag> --to HEAD`, with step 1.3 as the first reading.
- **If you do nothing:** the lanes compete with governance work for the same drains and the mix at step 1.3 is what the next 400 commits look like.
- **What to do:** pick exactly one — (a) amend ADR-260 § 1 with a new three-cut window and `provenance.kind: owner`; (b) record here that the window stays closed.
- **Resolved when:** `grep -n 'window' docs/decisions/ADR-260-*.md` shows a window that includes the next cut, or this blocker carries the (b) record.

### blocker: b4-benchmark-subject-names
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 3 — Owner decisions, then nothing else here
- **Question:** Which two public repositories are the benchmark subjects ADR-260 § 5 (`:128-134`) requires before `later/road-to-a-graph-that-wins.md` can wake (its `entry_condition`, `:8-20`)?
- **Recommendation:** Two public repositories of two different wired stacks (one PHP, one TypeScript), each with a test suite the `tests` edges can resolve. The agent cannot pick them: the choice is what makes the benchmark the owner's and not the tool's.
- **If you do nothing:** the parked lane never wakes and the code-graph subject arrives a seventy-fourth time.
- **What to do:** pick exactly one — (a) write the two names into the parked file's `entry_condition`; (b) close the parked file's benchmark phases and record why.
- **Resolved when:** `later/road-to-a-graph-that-wins.md` names two repositories, or carries the (b) record.

### blocker: b5-skill-growth-for-stacks
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 3 — Owner decisions, then nothing else here
- **Question:** May `road-to-stacks-beyond-php` add up to two skills per stack (testing and conventions; quality stays a `quality-tools` reference) under `estate_growth_exempt`, given `skill_count` has zero allowance (`src/scripts/check_estate_count.ts:832`)?
- **Recommendation:** Yes, capped at two per stack and only for rows that lane's composition table marks `create`.
- **If you do nothing:** the lane lands its composition table, routing and reference work; python and typescript packs stay at one artefact.
- **What to do:** pick exactly one — (a) cap two per stack; (b) a different cap, written into that lane's D3 row; (c) no new skills.
- **Resolved when:** the D3 row of `road-to-stacks-beyond-php.md` no longer reads `PENDING`.

### blocker: b6-neighbour-precedence
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 3 — Owner decisions, then nothing else here
- **Question:** Is the source order in `road-to-neighbours-that-pull-their-weight` step 2.1 the product's stance — below the four bands of `src/rules/agent-authority.md:12-26`: the current-turn instruction → `agents/overrides/` → the project's own instruction file → this suite's routed guidance → a neighbour's always-on text → a neighbour skill body → a neighbour MCP tool description, the project file winning ties and the agent naming what it followed — and do overlapping neighbour skills stay visible?
- **Recommendation:** Yes to both. It writes down what `src/agent-src/contexts/override-system.md:15-29` and ADR-124 already imply; hiding a neighbour would make the consumer's deliberate install silently inert.
- **If you do nothing:** the rule stays unwritten and each contradiction is resolved ad hoc.
- **What to do:** pick exactly one — (a) the order as written, neighbours visible; (b) the order with one rank moved, edited in that lane's step 2.1; (c) overlapping neighbour skills hidden, reversing K16.
- **Resolved when:** the D1 row of `road-to-neighbours-that-pull-their-weight.md` no longer reads `PENDING`.

### blocker: b7-adr-088-premise
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 3 — Owner decisions, then nothing else here
- **Question:** ADR-088 premise (A) (`docs/decisions/ADR-088-*.md:46-51`) says this package no longer owns the `settings.json` hooks array; `ensure_managed_hooks` writes it (`src/scripts/install.ts:3157-3165`). Amend the premise?
- **Recommendation:** Amend, `provenance.kind: owner`: only the sentence about who writes the array is stale; § 2 and § 3 stand, and the amendment authorizes no runtime federation. Respect the partial `superseded_by: ADR-124` scope in the ADR's frontmatter.
- **If you do nothing:** the ADR's coexistence premise cites a mechanism the tree contradicts.
- **What to do:** pick exactly one — (a) replace the sentence with "writes one signature-scoped group per event into `settings.json` and never touches other groups (`_lib/claude_settings_hooks.ts`)" plus the amendment date; (b) record the write as an exception in the ADR.
- **Resolved when:** `grep -c 'signature-scoped' docs/decisions/ADR-088-*.md` -> /[1-9]/ for (a), or the ADR carries an exception paragraph for (b).

### blocker: b8-adr-278-federation
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 3 — Owner decisions, then nothing else here
- **Question:** Does the owner author ADR-278, the ADR that ADR-088 § 3 (`:95-105`) requires before any neighbour capability is invoked, answering (a) identity, (b) generic design, (c) maintenance model, (d) trust contract?
- **Recommendation:** Yes, narrowly: (a) this suite orchestrates neighbours and never becomes a platform that drives them; (b) generic by shape, the census classes and the `effect:` field are the only adapter (K13); (c) a neighbour's proof expires when its digest changes; (d) a neighbour's result is typed evidence, the stop gate alone decides completion. The precedent `later/road-to-capability-native-execution.md:1001-1015` already parks external runtime federation on this same missing ADR.
- **If you do nothing:** the coexistence lanes ship inventory and rubric, the parked file stays parked, and no neighbour capability is invoked — a complete, honest state.
- **What to do:** pick exactly one — (a) author ADR-278 (slug `capability-federation-behind-a-trust-contract`) under `docs/decisions/` with the four answers and `provenance.kind: owner`; (b) decline for a round, leaving the park at its `review_by`; (c) narrow further by striking answers and the dependent phases.
- **Resolved when:** `test -f docs/decisions/ADR-278-*.md` -> 0, or this blocker carries the (b) or (c) record.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The programme becomes a second place decisions are recorded | implementation | A table naming lanes is one edit away from holding decisions, and then two files disagree. | Step 3.2 fixes the rule: this file keeps questions and its four Decisions rows only decide what the round became; lane decisions live in the lanes. | Phase 3 — Owner decisions, then nothing else here |
| 2 | Seven owner questions in one sitting get one answer or none | product | Batched decisions are answered by the first and skipped for the rest; b4 has stood since 2026-09-07. | Each blocker names its own cost of no decision and an enumerated option set; lanes land their unblocked phases regardless. | Phase 3 — Owner decisions, then nothing else here |
| 3 | `estate_growth_exempt` becomes how every round grows the estate | implementation | The previous round used one exempt line for 22 files; this set uses one for eight. | The exempt line names each file and its defect; the kill register records 34 proposals that did not become files; step 1.3 makes the next round's growth a number against this one. | Phase 1 — Repair the citation, record the set |
| 4 | Moving the install block shifts a line a check pins | product | `README.md` is read by at least one census; a moved block shifts later line numbers. | Step 2.1 forbids any other README change and repoints a pinning check in the same diff. | Phase 2 — The install command above the fold |
| 5 | "Leads every row" is read as a guarantee the host cannot give | product | The owner asked whether neighbours loaded first can ignore this suite; context and hook order are the host's. | The Goal states the limit once; the neighbour lanes enforce only through effects and report the rest as `unknown` or `degraded`. | Goal |
