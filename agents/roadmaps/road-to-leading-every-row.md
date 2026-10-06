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
      <!-- blocked-by: b4-benchmark-subject-names | asked: yes — all seven put to the owner verbatim 2026-10-01 in the PR body of the drain run that closed this phase; each blocker keeps its own Status until the owner answers it. Repointed 2026-10-06 from b1-subagent-return, which resolved that day: this step records the ASK, so its marker names a blocker the owner has still not answered rather than one that is closed -->
      verify: `grep -c 'asked: yes' agents/roadmaps/road-to-leading-every-row.md` -> /[1-9]/
- [ ] **3.2 Record each answer as a `## Decisions` row in the lane or stub it unblocks**,
      not here. This file keeps questions; lanes keep decisions.
      <!-- blocked-by: b5-skill-growth-for-stacks | asked: yes — put to the owner 2026-10-01 and unanswered at 2026-10-06; re-confirmed owner-reserved by AI council 3/4 that day. D3 of the stacks lane cannot stop reading PENDING until the owner answers b5, and D1 of the neighbours lane cannot until the owner answers the two ranks b6 still carries -->
      verify: `grep -c 'PENDING' agents/roadmaps/road-to-stacks-beyond-php.md agents/roadmaps/road-to-neighbours-that-pull-their-weight.md` -> /:0$/

      **Hand-over, measured 2026-10-06 against `origin/main` `6b79d06de`.** Every blocker
      was run as a command rather than read as its `Status:` line. Four of the seven are
      off the owner's desk; three are not, and the three that remain are why this box is
      still `[ ]`. Nothing below is a decision this run took for the owner.

      **What moved, and by whose authority.** Two AI-council passes on 2026-10-06
      (anthropic `claude-sonnet-4-5` + openai `codex-default`; 3 rounds and 2 rounds;
      subscription transport, **$0 billed**; blind chairman) gave four independent
      seat-opinions over one brief. Each blocker's own entry carries its tally and its
      dissent verbatim.

      | Blocker | Settled by | Outcome |
      |---|---|---|
      | `b1` | council, 4/4 council-decidable · 3/4 on the substance | not option 4; the stub gains the `## Decisions` row it was missing |
      | `b2` | tree evidence | the window ended on its **owner-set** end date (14.21.0 against 16.3.0); the (b) record is a dated reading, and re-arming stays the owner's at any cut |
      | `b7` | tree evidence + council, 3/4 on the form | a history check inverted the premise: `ensure_managed_hooks` landed 2026-07-07, 26 days **after** ADR-088 was accepted, so the sentence was true when written. Append-only note, nothing replaced |
      | `b6` limb 2 | council, no seat dissenting | neighbours stay visible, K16 stands (D13 of the neighbours lane) |
      | `b4` | **owner**, council 4/4 | ADR-260 § 5 assigns the two names to the owner. The clerical half was done: the corpus header it pointed at did not exist and now does, empty |
      | `b5` | **owner**, council 3/4 | a zero allowance is a freeze, not a budgeted threshold. **This is the blocker 3.2 is gated on** |
      | `b6` limb 1 | **owner**, seats split in opposite directions | narrowed from a seven-rank order to two ranks and one safety-floor clause |
      | `b8` | **owner**, council 4/4 | ADR-088 § 3's reservation stands; the dated non-event is recorded and is explicitly not option (b) |

      *Why 3.2 stays open.* Its exit reads `D3` of the stacks lane and `D1` of the
      neighbours lane. `D3` cannot stop reading `PENDING` until the owner answers `b5`;
      `D1` cannot until the owner answers the two ranks `b6` still carries. Both are
      owner-reserved on a council reading, so no amount of further agent work closes this
      box. The marker on the checkbox line records that, because `run-continuation` reads
      blockedness from the marker and never from this section.

      *This step's own oracle is broken, and this run did not repair it.* Re-measured at
      `6b79d06de`, `grep -n 'PENDING'` over the two lanes returns four hits, and two of
      them are structurally outside the two rows the step is about:
      `road-to-stacks-beyond-php.md:92` is the lane's own instruction text inside a fenced
      block — it quotes the grep command, so the oracle counts the command that reads it —
      and `road-to-neighbours-that-pull-their-weight.md:518` is row `D12`, whose blocker is
      `mcp-recorder-unreachable-behind-the-tools-filter`, not `b6`. **The count therefore
      cannot reach `:0` whatever the owner answers.** The precise form is:

      ```
      grep -c '^| D3 .*PENDING' agents/roadmaps/road-to-stacks-beyond-php.md; grep -c '^| D1 .*PENDING' agents/roadmaps/road-to-neighbours-that-pull-their-weight.md
      ```

      It is still written rather than installed, and the reason has changed from the
      2026-10-05 hand-over's. That note deferred it as "a maintainer edit". This run put
      the question to both council passes instead, and got a **1-of-4 refusal with an
      argument the other three did not answer**: the entity being measured must not repair
      its own measuring instrument, because every safeguard proposed is a property of
      *this* edit rather than a barrier to the next one. The three permitting seats all
      attached conditions, and two of them attached the same one — **the repairing run may
      not inherit the pass**; one added that a bare `grep -c` returns `0` for a row that
      was *deleted*, so the replacement must assert each row **exists** and is not
      `PENDING`, or it can be satisfied vacuously. A repair that discharges all of that is
      a separate change with an independent reviewer, which is what the next runner should
      open rather than fold into a run this step gates.

      *What an answer to `b5` still does not buy.* `road-to-stacks-beyond-php.md:100-110`
      records the probe, re-confirmed at this tip: base `skill_count` 299 /
      `skill_description_tokens` 11460; one skill added fails the gate twice; six skills
      cost +6 and roughly +230 against allowance 0. This file's `estate_offset_exempt`
      pays the roadmap-count half only, so an answered `b5` is **necessary and not
      sufficient** — the lane's own `estate_growth_exempt` claim lands in the same change
      as the skills.

      *Three corrections to the 2026-10-05 hand-over, kept because a later reader would
      otherwise trust them.* Its reading of `b1` ("limb (a) reads green while the decision
      is unmade") was right and is now acted on — that limb is struck as defective rather
      than left to mislead. Its reading of `b4` ("points the owner at a section that does
      not exist") was right and the section now exists. Its reading of `b7` was **wrong in
      its framing**, through no fault of the measurement: the premise is not stale, it is
      superseded, and the history command that shows this is in that blocker's entry.

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
- **Status:** resolved 2026-10-06 by AI council — not option 4; the stub stays parked and records the verdict as a `## Decisions` row (D1/D2 there)
- **Owner:** user
- **Blocks:** Phase 3 — Owner decisions, then nothing else here
- **Question:** Which of the four options posed in `agents/roadmaps/stubs/road-to-subagent-return-gate.md:20-32` moves the 27-arrival subject?
- **Recommendation:** Option 4, keyed on `no_envelope`. Read 2026-10-01 in the maintainer checkout's `agents/runtime/state/subagent-ledger/*.jsonl`: `no_envelope` 24,964, `absent` 4,543, `foreign_object` 54, `fail` 42, `ok` 0, `no_message` 0 — the probe keys on a verdict that has never fired.
- **If you do nothing:** the subject arrives a twenty-eighth time and the hook keeps validating and dropping.
- **What to do:** pick exactly one — (a) option 4: replace the stub's `no_message` probe with `no_envelope` and set a shadow window; (b) option 2: close the stub and record the three measured facts; (c) option 1: keep the probe unchanged.
- **Resolved when:** the stub records the chosen option as a `## Decisions` row. ~~or `grep -c 'no_envelope' …` -> /[1-9]/ for (a)~~ — **that second limb is struck as defective**: it already read `2` while the decision was unmade, both hits being inside the stub's Arrivals blockquote quoting this blocker's own recommendation, so a quotation satisfied it. Both council passes named it independently. The first limb is the real one and it is now met.
- **Answer, 2026-10-06 — council, not owner.** Two AI-council passes (anthropic `claude-sonnet-4-5` + openai `codex-default`, 3 rounds and 2 rounds, subscription transport, $0 billed): **4 of 4 seat-opinions classified the question council-decidable** — re-keying a probe reopens investigation, it does not ship a gate, and the four enforcement preconditions in the stub are untouched. **3 of 4 refused option 4 as the immediate move.** Both openai seats gave the same reason: with `ok` = 0 nothing distinguishes a genuine missing return from a system that never produces a valid envelope at all, so a high-volume `no_envelope` stream would be observation without a denominator. The recorded decision is the intersection the seats share — **not option 4; the parking stands; precondition 1 (a functioning `ok` path) is the next thing that must exist** — written into the stub as its `## Decisions` D1, with the option-4 shadow-window specification recorded there for whoever takes it later. Dissent, recorded rather than dropped: one anthropic seat argued option 4 now, one argued option 1 with a `review_by`; one seat also warned that closing on arrival count would be "resolving by exhaustion rather than by evidence", which is why option 2 was not taken either.

### blocker: b2-consumer-first-rearm
- **Status:** resolved 2026-10-06 — the (b) record below. The window closed on its own owner-set end date; re-arming stays available to the owner at any cut and needs nothing from this record
- **Owner:** user
- **Blocks:** Phase 1 — Repair the citation, record the set
- **Question:** Is ADR-260 § 1 (consumer-only ≥ governance-only per release, `:67-75`, window 14.19–14.21) re-armed for the next three release cuts?
- **Recommendation:** Re-arm as a release guard, never a PR gate (ADR-253 stands), read by `./scripts-run src/scripts/measure_release_mix --from <last-tag> --to HEAD`, with step 1.3 as the first reading.
- **If you do nothing:** the lanes compete with governance work for the same drains and the mix at step 1.3 is what the next 400 commits look like.
- **What to do:** pick exactly one — (a) amend ADR-260 § 1 with a new three-cut window and `provenance.kind: owner`; (b) record here that the window stays closed.
- **Resolved when:** `grep -n 'window' docs/decisions/ADR-260-*.md` shows a window that includes the next cut, or this blocker carries the (b) record.
- **The (b) record, 2026-10-06.** Stated temporally and without a normative claim, because the distinction matters: this records repository state, it does not exercise the owner's reserved authority over the window.

  ADR-260 § 1 reads *"Owner-set end date: 14.21.0, or earlier by owner ruling."*
  `node -e "console.log(require('./package.json').version)"` reads **16.3.0**. The
  window therefore **ended on the terms the owner set for it**, two minor versions
  ago — it did not lapse through neglect, and nothing re-armed it. The literal
  `grep -n 'window' docs/decisions/ADR-260-*.md` matches one line, `:71`, which is
  the admittance clause *inside* that window, not a window reaching the next cut.

  **What this record does not do.** It does not decide that the window stays
  closed, does not rank re-arming against anything, and sets no new date. Option
  (a) — a new three-cut window with `provenance.kind: owner` — is an owner ruling
  that may land at any cut; this record neither authorises nor obstructs it, and an
  agent may not write it, which is why (a) was not taken here rather than weighed
  and declined. **The option is carried to the owner alongside the other residue,
  not closed by this blocker closing.**

  The reading this unblocks: step 1.3's commit mix is a measurement of an
  unguarded window, so it is a baseline rather than a compliance check. It stands
  as recorded either way.

### blocker: b4-benchmark-subject-names
- **Status:** open · asked: yes (2026-10-01, unanswered) · **confirmed owner-reserved 2026-10-06 by AI council, 4/4** · the destination it points at now exists
- **Owner:** user
- **Blocks:** Phase 3 — Owner decisions, then nothing else here
- **Question:** Which two public repositories are the benchmark subjects ADR-260 § 5 (`:128-134`) requires before `later/road-to-a-graph-that-wins.md` can wake (its `entry_condition`, `:8-20`)?
- **Recommendation:** Two public repositories of two different wired stacks (one PHP, one TypeScript), each with a test suite the `tests` edges can resolve. The agent cannot pick them: the choice is what makes the benchmark the owner's and not the tool's.
- **If you do nothing:** the parked lane never wakes and the code-graph subject arrives a seventy-fourth time.
- **What to do:** pick exactly one — (a) write the two names into the parked file's `entry_condition`; (b) close the parked file's benchmark phases and record why.
- **Resolved when:** `later/road-to-a-graph-that-wins.md` names two repositories, or carries the (b) record.
- **Routing, 2026-10-06 — owner, 4/4.** Both council passes read ADR-260 § 5's parenthetical — *"(The owner fills the two names in the corpus header; the roadmap wakes on that edit.)"* — as an express assignment, and no seat proposed that an agent or a council name the subjects. The reservation stands untouched.
- **The clerical half was done, and only the clerical half.** The section ADR-260 § 5 and the parked file's `entry_condition` both pointed at **did not exist**: that file had eight `##` headings and no corpus header, so the owner was being asked to author the destination as well as fill it. `## Corpus header` is now created in that file with two visibly unfilled rows (role · repository · SHA pin · filled), the ADR quoted, the fitness list *referenced* rather than copied so it cannot drift, and the `entry_condition` repointed at the heading that now exists. **No repository is proposed and no selection criterion is invented** — the council set that bound explicitly, one seat warning that even placeholder wording can frame a choice. Answering b4 is now a two-cell edit.

### blocker: b5-skill-growth-for-stacks
- **Status:** open · asked: yes (2026-10-01, unanswered) · **confirmed owner-reserved 2026-10-06 by AI council, 3 of 4 seat-opinions** · this is the blocker step 3.2 is gated on
- **Owner:** user
- **Blocks:** Phase 3 — Owner decisions, then nothing else here
- **Question:** May `road-to-stacks-beyond-php` add up to two skills per stack (testing and conventions; quality stays a `quality-tools` reference) under `estate_growth_exempt`, given `skill_count` has zero allowance (`src/scripts/check_estate_count.ts:741`)?
- **Recommendation:** Yes, capped at two per stack and only for rows that lane's composition table marks `create`.
- **If you do nothing:** the lane lands its composition table, routing and reference work; python and typescript packs stay at one artefact.
- **What to do:** pick exactly one — (a) cap two per stack; (b) a different cap, written into that lane's D3 row; (c) no new skills.
- **Resolved when:** the D3 row of `road-to-stacks-beyond-php.md` no longer reads `PENDING`.
- **Routing, 2026-10-06 — owner, 3/4.** The majority read a **zero** allowance as a freeze rather than a budgeted threshold, and `estate_growth_exempt` as the record of an owner-approved exception rather than a path an agent or a council may authorise itself onto. The dissenting seat argued the opposite — that a documented per-file exemption is already inside the governance envelope, that nothing in the enumerated owner-reserved set matches, and that `product-owned` is therefore a mislabel. It is recorded because it is a real argument, and it did not carry: a 1-of-4 position is not the ground to grow a frozen corpus on.
- **Two refinements the owner inherits, from the seats that looked hardest at the cost.** (1) Whichever cap is set, require per-row evidence that extending or composing an existing skill cannot cover that row — a capability-level reason, never "stack parity" — because six individually justified exceptions can defeat the anti-sprawl policy in substance while leaving the formal zero untouched. (2) The answer needs the **freeze's own status**: *temporary, pending a reorganisation* and *permanent, the suite stops here* give opposite answers to the same cap question, and that fact is not recorded anywhere in the tree.

### blocker: b6-neighbour-precedence
- **Status:** open · asked: yes (2026-10-01, unanswered) · **half answered 2026-10-06 by AI council** — the visibility limb is decided (neighbours stay visible, K16 stands, D13 of the neighbours lane); what remains is two ranks and one clause, not the whole order
- **Owner:** user
- **Blocks:** Phase 3 — Owner decisions, then nothing else here
- **Question:** Is the source order in `road-to-neighbours-that-pull-their-weight` step 2.1 the product's stance — below the four bands of `src/rules/agent-authority.md:12-26`: the current-turn instruction → `agents/overrides/` → the project's own instruction file → this suite's routed guidance → a neighbour's always-on text → a neighbour skill body → a neighbour MCP tool description, the project file winning ties and the agent naming what it followed — and do overlapping neighbour skills stay visible?
- **Recommendation:** Yes to both. It writes down what `src/agent-src/contexts/override-system.md:15-29` and ADR-124 already imply; hiding a neighbour would make the consumer's deliberate install silently inert.
- **If you do nothing:** the rule stays unwritten and each contradiction is resolved ad hoc.
- **What to do:** pick exactly one — (a) the order as written, neighbours visible; (b) the order with one rank moved, edited in that lane's step 2.1; (c) overlapping neighbour skills hidden, reversing K16.
- **Resolved when:** the D1 row of `road-to-neighbours-that-pull-their-weight.md` no longer reads `PENDING`.
- **Limb 2 — answered, council, 2026-10-06.** **Overlapping neighbour skills stay visible; K16 stands; option (c) is not taken.** Across four seat-opinions no seat argued for hiding, and three preserved K16 explicitly: hiding a skill the consumer deliberately installed makes their install silently inert. Recorded as D13 of the neighbours lane. The seats differed on whether *visibility* was owner-reserved, not on what the answer is; it is recorded as council-resolved because the enumerated owner-reserved set contains no row it matches — it lowers no floor, is reversible, creates no external commitment, and is bounded by tree evidence.
- **Limb 1 — narrowed, still the owner's.** The question is no longer "is this whole seven-rank order the product's stance". Three ranks survive, and the file to edit is step 2.1 of that lane:
  - **(i)** Does the **project's own instruction file** outrank this suite's routed guidance, or the reverse? The seats split in *opposite directions* — one: the suite is installed into the project, so local instructions define its authorised operating context; another: one precedence order is simpler and keeps overrides auditable through `agents/overrides/`, so routed guidance outranks the project file.
  - **(ii)** Does a neighbour's **always-on text** outrank a neighbour's **skill body**? Both openai seats flagged this as not entailed by the cited evidence, distinguishing host *injection level* from *semantic specificity*, and both suggested an explicitly invoked skill may legitimately win over generic always-on material while a merely-discoverable one does not.
  - **(iii)** The **safety-floor clause** that rank (i) needs either way. One anthropic seat's case, which no other seat contradicted: unqualified "project file > routed guidance" lets a project file carrying *"never run tests"* override `verify-before-complete`, and lowering a safety floor is owner-reserved by name. Whichever way (i) goes, the order must say that project instruction files may tune workflow and may never lower the floors the four bands of `src/rules/agent-authority.md:12-26` define.
- **What is NOT in question any more:** that precedence sits below the four authority bands (already D5 of that lane, by evidence), and that the kernel and safety floors are untouchable (`src/agent-src/contexts/override-system.md` § The non-overridable class).

### blocker: b7-adr-088-premise
- **Status:** resolved 2026-10-06 — ADR-088 carries a dated implementation-status note; the premise sentence is **not** replaced, because a history check showed it was accurate when the ADR was accepted
- **Owner:** user
- **Blocks:** Phase 3 — Owner decisions, then nothing else here
- **Question:** ADR-088 premise (A) (`docs/decisions/ADR-088-*.md:46-51`) says this package no longer owns the `settings.json` hooks array; `ensure_managed_hooks` writes it (`src/scripts/install.ts:3157-3165`). Amend the premise?
- **Recommendation:** Amend, `provenance.kind: owner`: only the sentence about who writes the array is stale; § 2 and § 3 stand, and the amendment authorizes no runtime federation. Respect the partial `superseded_by: ADR-124` scope in the ADR's frontmatter.
- **If you do nothing:** the ADR's coexistence premise cites a mechanism the tree contradicts.
- **What to do:** pick exactly one — (a) replace the sentence with "writes one signature-scoped group per event into `settings.json` and never touches other groups (`_lib/claude_settings_hooks.ts`)" plus the amendment date; (b) record the write as an exception in the ADR.
- **Resolved when:** `grep -c 'signature-scoped' docs/decisions/ADR-088-*.md` -> /[1-9]/ for (a), or the ADR carries an exception paragraph for (b). **Met** — the note carries the phrase; `-> 2`.
- **The premise was not stale when it was written, and that changes the artefact.** One council seat refused to treat current code as proof about a 2026-06-11 record and asked for the acceptance-date history. Run:
  `git log --reverse --format='%h %ad %s' --date=short -S'ensure_managed_hooks' -- src/scripts/_lib/claude_settings_hooks.ts src/scripts/install.ts` -> first hit **`f1a7644b8` 2026-07-07** ("feat(install): managed Claude hook registration in settings.json (Phase 1)"), with `9c06cdba7` the same day for the global-deploy path. That is **twenty-six days after** ADR-088 was accepted. So premise (A) was accurate at acceptance and the mechanism moved under it: this is a **superseded implementation fact, not a factual error**, and the right artefact is an implementation-status note rather than a correction. No prior round had run this check, and it inverts the blocker's own framing.
- **What landed, and why not option (a) as worded.** Option (a) said *replace the sentence*. **Nothing was replaced.** ADR-088 gains an **append-only** `## Implementation-status note — 2026-10-06` that quotes the premise sentence, dates it as accurate-at-acceptance, states the mechanism at `6b79d06de` with `install.ts:3089` and `_lib/claude_settings_hooks.ts:214-244`, and enumerates what does not move — the decision, §§ 1-4, § 3's owner reservation for runtime federation, `status`, `superseded_by` and `superseded_scope`. Council, two passes: **3 of 4 seat-opinions for an append-only erratum over a replacement**, one of them on the explicit ground that an ADR is partly a historical record and overwriting a premise erases the basis the decision was made on. The replacement option is therefore recorded as **not taken**, not as unavailable.
- **One phrase the council corrected.** Option (a) proposed "never touches other groups". The note says **"preserves every group it does not identify as managed"** instead, because that is what `user_groups = existing.filter((g) => !_is_managed_group(g))` establishes — the absolute claim would need every write path to be checked, and it was not.
- **Second-order effect, surfaced rather than absorbed:** the dated code reading moves ADR-088 from `E0` to `E1` in `agents/evidence/analysis/adr-evidence-census-2026-08.md`, regenerated in the same change. The grade rose on a **measurement**, which is the legitimate path; council markers cannot raise a grade above `E0` by construction. Per `decision-revisit-gate`, a grade is a measurement and grants nothing — ADR-088 reopens no further than this note.

### blocker: b8-adr-278-federation
- **Status:** open · asked: yes (2026-10-01, unanswered) · **confirmed owner-reserved 2026-10-06 by AI council, 4/4** · the dated non-event is recorded below and is not an answer
- **Owner:** user
- **Blocks:** Phase 3 — Owner decisions, then nothing else here
- **Question:** Does the owner author ADR-278, the ADR that ADR-088 § 3 (`:95-105`) requires before any neighbour capability is invoked, answering (a) identity, (b) generic design, (c) maintenance model, (d) trust contract?
- **Recommendation:** Yes, narrowly: (a) this suite orchestrates neighbours and never becomes a platform that drives them; (b) generic by shape, the census classes and the `effect:` field are the only adapter (K13); (c) a neighbour's proof expires when its digest changes; (d) a neighbour's result is typed evidence, the stop gate alone decides completion. The precedent `later/road-to-capability-native-execution.md:1001-1015` already parks external runtime federation on this same missing ADR.
- **If you do nothing:** the coexistence lanes ship inventory and rubric, the parked file stays parked, and no neighbour capability is invoked — a complete, honest state.
- **What to do:** pick exactly one — (a) author ADR-278 (slug `capability-federation-behind-a-trust-contract`) under `docs/decisions/` with the four answers and `provenance.kind: owner`; (b) decline for a round, leaving the park at its `review_by`; (c) narrow further by striking answers and the dependent phases.
- **Resolved when:** `test -f docs/decisions/ADR-278-*.md` -> 0, or this blocker carries the (b) or (c) record.
- **Routing, 2026-10-06 — owner, 4/4.** ADR-088 § 3 (`:95-105`) reserves federation to its own ADR answering (a) identity, (b) generic design, (c) maintenance model, (d) trust contract. Whether to author it is the product-architecture decision that reservation exists to protect. No seat proposed that an agent or a council author it, and none proposed narrowing it.
- **The dated non-event, recorded as state and not as a verdict.** Both passes were asked to distinguish *recording a non-event* from *adopting a conservative default as an answer*, and 4/4 drew the line in the same place. This record is the first kind:

  > As of 2026-10-06, ADR-278 has not been authored. The existing park and the
  > prohibition on invoking a neighbour capability therefore remain in force under
  > ADR-088 § 3. This records no position on whether or when the owner should
  > author ADR-278; an owner ADR may supersede this state at any time.

  **This blocker stays `open` precisely because that paragraph is not option (b).** Option (b) is *the owner declining for a round*, which is theirs to say; the paragraph above only reports that no decision occurred. The existing rule continues to operate because its precondition is unmet, not because silence exercised reserved authority. One seat also flagged the blocker's own phrase "a complete, honest state" as editorialising about whether the current state is acceptable — it is left as the original wording of the question, and this record does not adopt it.
- **No preparatory artefact was created**, deliberately. One seat allowed a neutral evidence packet or an empty ADR skeleton if clearly non-decisional; another gave none. An empty ADR-278 in `docs/decisions/` would satisfy this blocker's own `test -f` exit condition while containing no decision, which is the worst available outcome, so the permissive reading was not taken.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The programme becomes a second place decisions are recorded | implementation | A table naming lanes is one edit away from holding decisions, and then two files disagree. | Step 3.2 fixes the rule: this file keeps questions and its four Decisions rows only decide what the round became; lane decisions live in the lanes. | Phase 3 — Owner decisions, then nothing else here |
| 2 | Seven owner questions in one sitting get one answer or none | product | Batched decisions are answered by the first and skipped for the rest; b4 has stood since 2026-09-07. | Each blocker names its own cost of no decision and an enumerated option set; lanes land their unblocked phases regardless. | Phase 3 — Owner decisions, then nothing else here |
| 3 | `estate_growth_exempt` becomes how every round grows the estate | implementation | The previous round used one exempt line for 22 files; this set uses one for eight. | The exempt line names each file and its defect; the kill register records 34 proposals that did not become files; step 1.3 makes the next round's growth a number against this one. | Phase 1 — Repair the citation, record the set |
| 4 | Moving the install block shifts a line a check pins | product | `README.md` is read by at least one census; a moved block shifts later line numbers. | Step 2.1 forbids any other README change and repoints a pinning check in the same diff. | Phase 2 — The install command above the fold |
| 5 | "Leads every row" is read as a guarantee the host cannot give | product | The owner asked whether neighbours loaded first can ignore this suite; context and hook order are the host's. | The Goal states the limit once; the neighbour lanes enforce only through effects and report the rest as `unknown` or `degraded`. | Goal |
