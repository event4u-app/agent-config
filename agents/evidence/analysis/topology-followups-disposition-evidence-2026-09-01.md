---
kind: analysis
subject: road-to-council-topology-evidence-followups
observed_at: 2026-09-01
commit: 468eeefc7f45af21414bf2e42de769249a84a31d
---

<!-- evidence-type: analysis -->

# Disposition evidence — `road-to-council-topology-evidence-followups`

> **This is evidence, not a decision.** Nothing here flips a checkbox, changes a
> status, executes a deferred item, or archives anything. It answers five
> questions so that whoever decides the receiver's disposition decides on read
> facts rather than on the receiver's own account of itself.
>
> **Provenance rule applied throughout:** every claim below cites `file:line`
> read at commit `468eeefc7`. Where a fact could not be established, the section
> says **not checked** and names the exact command that would settle it. No
> finding in this document is hedged with "probably".

## 0. The subject, measured

`agents/roadmaps/road-to-council-topology-evidence-followups.md`, 145 lines,
frontmatter exactly three keys (`:1-5`): `complexity: structural`,
`status: draft`, `parent_roadmap: road-to-inbox-harvest-2026-08-e-council-topology-evidence`.
There is **no `relates:` block** — `grep -c '^relates:'` returns `0`. That
absence is load-bearing in § 5 and is recorded here rather than there.

Checkbox census, counted at this commit:

| Group | Receiver lines | Items | Glyphs other than `[ ]` |
|---|---|---|---|
| A — Phase 2 and dependents | `:66-91` | 24 | 0 |
| B — provider-leakage bench | `:105-106` | 2 | 0 |
| C — instrumentation | `:124-137` | 12 | 0 |
| **Total** | | **38** | **0** |

`grep -cE '^- \[[~x-]\]'` returns `0`: **every one of the 38 items is `[ ]`
open.** The receiver's own header (`:9`) describes them as "the 38 `[~]` items
deferred out of" the parent — that is a description of the *parent's* glyphs,
not of this file's. This file contains no deferred, cancelled or done item.

## 1. The three resume triggers — met, unmet, or undecidable

### Group A — verdict: **UNMET on conjunct 1, decisively; conjunct 2 unrepresentable; conjunct 3 undecidable as worded**

The trigger has three conjuncts, stated at receiver `:58-64` and in full at
`agents/roadmaps/stubs/road-to-council-topology-benchmark-execution.md:77-85`.

**Conjunct 1 — `n >= 5` independent eligible seats configured. UNMET.**

Read from the authoritative resolver, not from the project tree. `agent-config
council:status` (and the repo-local `./scripts-run src/scripts/council_cli
status`, which prints identically) reports at this commit:

```
council:status · CONFIGURED
  config path      /Users/mathiasberg/.event4u/agent-config/settings/.ai-council.yml
  resolved by      user-global
  members          2 enabled of 5
                   anthropic, openai
  qualification    anthropic: available
  qualification    openai: available
```

Both readings agree: **2 enabled of 5**. Per ADR-104 — restated in the probe's
own trailer — the project tree is never consulted for council config, so no
project file was read to reach this number and none could have changed it.

One fact sharpens the conjunct beyond "2 < 5". The provider universe the config
schema accepts is exactly five, enumerated at
`src/scripts/ai_council/config.ts:88-94`: `anthropic`, `openai`, `gemini`,
`xai`, `perplexity`. So `n >= 5` is satisfiable **only at the schema ceiling** —
every valid provider configured, enabled and qualified simultaneously. This is
not a threshold three seats short of routine; it is the maximum the mechanism
can express. Nothing in the tree makes that unreachable, and nothing suggests it
is near.

**Conjunct 2 — a *verified* 20-consecutive-UTC-day capacity reservation.
UNMET, and structurally unrepresentable: nothing in this tree can record a
reservation.**

The stub is explicit that intention does not count
(`stubs/road-to-council-topology-benchmark-execution.md:81-83`, quoting the
openai seat: *"sequence it later is not itself evidence of availability"*). So
the question is whether any artefact could carry a verified reservation.

`grep -rniE '\breserv(e|ed|ation|ing)\b'` over `src/scripts/ai_council/` and
`src/agent-src/scripts/` returns hits in exactly three unrelated senses, none of
them a capacity booking:

- a **retry reserve** — call-count arithmetic inside the manifest generator
  (`src/scripts/ai_council/topology_bench_manifest.ts:592`, `:610-611`, `:624-629`,
  `:683`), which reserves *calls within a pass*, not days or seats;
- **reserved field names** in the events log (`events_log.ts:263-267`) and the
  reserved `split` verdict label (`prompts.ts:546`, `:658`);
- **reserved topology names** owned by other layers (`topology_vocabulary.ts:111-157`).

What the tree has instead is a **consumption counter**, not a reservation
ledger: `src/scripts/ai_council/cli_call_budget.ts` maintains a per-provider
per-UTC-day count with `DEFAULT_CLI_CALLS_PER_DAY = 50` at `:60`, resolved by
`resolveCliCallCaps` (`:83-107`). A counter records what was spent after the
fact; it cannot hold a future window against other consumers. There is
therefore no artefact a reader could inspect to answer "is a 20-day window
reserved?" — the conjunct is not merely unsatisfied, it is **not expressible**.
Closing it needs a new mechanism, not a new observation.

**Conjunct 3 — no governed-estate headroom constraint prevents monopolising
those seats. UNDECIDABLE as literally worded.**

The tree's governed-estate mechanism is `src/scripts/check_estate_count.ts`. Its
own module docstring (`:1-53`) states what it governs: the count of active
roadmaps and open blockers, as a base-ref-measured ratchet (T2) plus a
one-in-one-out diff check (T3). It says nothing about provider seats, call
capacity, or UTC-day windows, and there is no other `*estate*` script under
`src/scripts/` (`ls src/scripts/ | grep -iE 'estate'` returns exactly one file).

So the conjunct names a constraint class the governed estate does not express.
It cannot be evaluated true or false against this tree. It could be read
charitably as "no unrelated governance pressure objects", but that is a reading,
not a reading of the tree — and this dossier does not supply readings as
findings. **What would settle it:** the trigger being rewritten to name a
mechanism that exists, or a governed-estate rule being extended to cover
provider capacity.

**Two supporting facts, both re-verified at this commit rather than quoted from
the stub** (the stub records them as read at `af77709fd`):

- **No runner exists.** `src/scripts/ai_council/topology_bench_manifest.ts`
  `main()` at `:821-838` handles only `--emit`, writes the manifest JSON and
  prints totals. There is no provider dispatch in the function.
- **The frozen manifest is entirely unexecuted.** Parsing
  `internal/bench/council-topology/call-manifest.json` at this commit:
  `frozen: true`, `schema_version: 1`, `totals` = 384 cells / 352 eligible /
  32 deferred, `minimum_total: 1584`, `worst_case_total: 1804`, `utc_days: 20`,
  `cap_per_provider_per_day: 50`. Cell-status census over `cells`:
  **352 `pending`, 32 `not_eligible`, 0 complete.**

### Group B — verdict: **UNMET, on the same unrepresentability plus one arithmetic fact**

Trigger at receiver `:100-103` and
`stubs/road-to-provider-leakage-bench-execution.md:124-127`: two consecutive
UTC-day windows reservable with the per-provider cap free in both, and one
coherent run across the boundary.

**The arithmetic is confirmed at this commit.** Each arm is 30 calls per
provider; the cap is 50 per provider per UTC day
(`src/scripts/ai_council/cli_call_budget.ts:60`). 60 > 50, so the two arms
cannot share a day. That half of the stub's reasoning reproduces exactly.

**The reservation half fails for the identical structural reason as Group A
conjunct 2** — see the grep above. Nothing reserves a UTC-day window. The
trigger's second clause ("the run executing them can remain coherent across the
boundary") is a property of a *future session*, which no tree artefact can
record either.

**What IS built, re-verified here rather than quoted:**

- assembler present — `src/scripts/ai_council/leakage_corpus.ts:178`
  (`assembleLeakageCorpus`), with `SyntheticCorpusRefusal` thrown, not excluded,
  at `:74-78` and `:185`;
- pattern list present — `src/scripts/ai_council/leakage_patterns.ts`, 453 lines,
  `LEAKAGE_PATTERN_LIST_VERSION = 'leakage-patterns-v1-2026-08-31'` at `:58`,
  `ARM_LABEL = 'pattern-stripped'` at `:64`, `FORBIDDEN_ARM_LABELS` at `:67`;
- pre-registration present —
  `internal/bench/council-provider-leakage/PREREG-anonymisation-and-sampling.md`.

**The runner is still absent, confirmed independently.** `grep -rn
'collectGuesses\|scoreRecognition' --include='*.ts'` returns **zero production
callers** — every hit is in `tests/scripts/ai_council/provider_leakage_bench.test.ts`.

**Not re-verified at this commit:** the corpus census figure of 1,402 eligible
bodies (anthropic 699 / openai 703), cited at
`stubs/road-to-provider-leakage-bench-execution.md:65` as read at `af77709fd`.
Establishing it requires executing `assembleLeakageCorpus` over the live
response directory, which the stub itself notes is a growing corpus. **What
would check it:** a read-only invocation of the assembler against
`agents/runtime/council/responses/`.

### Group C — verdict: **MIXED — one trigger tested and failed, three unmet, one conjunct met but its item's criterion not met**

Group C is the only group with per-item triggers (receiver `:116-122`; the
authoritative per-item wording is in the instrumentation stub).

| Trigger class | Items | Verdict at this commit |
|---|---|---|
| Population enters an integration branch or release candidate | 7.3, 10.1, 10.6, 11.1, 12.1, 12.2, 12.3 | **UNMET** — the guarded populations do not exist at all (§ 4), so there is nothing to enter a branch |
| Mechanism built AND a qualifying real run scheduled | 5.4, 10.2, 10.3 | **UNMET** — for 10.3 the mechanism is also unbuilt (§ 4); no scheduled run is recorded anywhere |
| One allocated representative run where **every** seat inlines the findings block | 1B.1 | **TESTED AND FAILED** — see below |
| Capacity allocated for `>= 10` representative runs, methods frozen first | 1B.4 | **UNMET** — same unrepresentability as Groups A/B; no allocation artefact exists |

**1B.1 deserves separate treatment and the receiver already says why.** Receiver
`:124-126` records that "the authorised run was made 2026-09-01 and REPRODUCED
the `codex-default` contract miss; n = 2, not a rate". The trigger requires a run
in which *every* answering seat inlines the block. A run was allocated and made,
and a seat did not inline. So this item is not blocked on capacity — its
condition was **attempted and came back negative at n = 2**. The mechanism is
committed: `src/scripts/ai_council/inline_findings.ts` (with
`INLINE_FINDINGS_CONTRACT` at `src/scripts/ai_council/prompts.ts:237`, appended
at `inline_findings.ts:282`, and `inlineFindingsActive` at `:330`).

**A cross-check on the receiver's own account of the council record.** Receiver
`:41-49` states that the anthropic seat's 2B rationale rested on groups that do
not exist in this tree — "no Loom dependency, no `runner_arm_v2`, and no such
budget". Verified: `grep -rl` over `src/` and `tests/` returns **0** files for
`runner_arm_v2`, **0** for `evidence_discipline`, **0** for `v8.Isolate`, and
**1** for `Loom` — `src/scripts/recruit_preflight.sh:138`, an unrelated mention
of the screen recorder in a list of browser-based recorders, not a dependency.
**The receiver's self-audit is accurate.**

## 2. Do the three stubs exist, and do they carry what the receiver says they carry?

**Existence: yes, all three.** `agents/roadmaps/stubs/` holds 101 `.md` files;
the three linked at receiver `:56`, `:98` and `:114` are present:

| Stub | Present | Lines | Last touched |
|---|---|---|---|
| `road-to-council-topology-benchmark-execution.md` | yes | 111 | `8a9b97af5` |
| `road-to-provider-leakage-bench-execution.md` | yes | 127 | `8a9b97af5` |
| `road-to-council-topology-instrumentation.md` | yes | 137 | `468eeefc7` (HEAD) |

The links are relative (`stubs/<slug>.md`) from `agents/roadmaps/`, and resolve.

**The per-group forbidden-claims claim: PARTIALLY FALSE.** Receiver `:144-145`
states "Each stub carries the per-group forbidden-claims list in full, and those
lists govern." Measured against the three files:

- **Group A stub — TRUE.** `## Claims the parent roadmap may NOT make while
  these steps are `[-]`` at `:94`, five enumerated prohibitions at `:98-103`,
  and the single permitted claim at `:105-106`.
- **Group B stub — NO SUCH LIST.** `grep -niE 'forbidden|may not'` over
  `road-to-provider-leakage-bench-execution.md` returns **zero hits**. Its
  governance is framed positively instead: `## The only claim the result may
  ever carry` (`:100-113`) plus `## Floors carried forward unmoved` (`:115-122`).
  That is arguably equivalent in force, but it is not the artefact the receiver
  names, and a reader following the receiver's sentence would look for a list
  that is not there.
- **Group C stub — ONE OF THREE INTERNAL GROUPS.** `grep -niE
  'forbidden|may not|never claim|no claim'` returns exactly two lines: `:53`
  (`**Claims forbidden while `[-]`:**`, covering Group 1's seven guarded
  baselines only, `:53-57`) and `:136` (a single floor line under `## Floors the
  council refused to move`). Its Group 2 (`:59-88`) and Group 3 (`:90-128`) carry
  no forbidden-claims statement. Section headings confirm this: the file's `##`
  headings are `:18`, `:33`, `:59`, `:90`, `:129` — none is a forbidden-claims
  section.

**A second faithfulness gap, in the opposite direction — the receiver carries
one item its stub does not enumerate.** The Group A stub's
`## The 23 dependent steps deferred with Phase 2` (`:71-75`) lists Direct 2.2,
2.3, 2.4, 2.5, 2.7 (5) and By-dependency 5.2, 5.5, 7.2, 7.4, 7.5, 7.6, 8.5,
9.1, 9.4, 10.4, 11.2, 11.3, 11.5, 13.1–13.5 (18) — **23**. The receiver's Group A
holds **24**, the extra being **6.5** (receiver `:73-75`), a deliberate partial
carry whose "recorded-gate half is DONE and preserved". The extra item is
honestly annotated in the receiver; it is simply **absent from the stub that the
receiver says holds the detail**. Since openai's council condition was that one
receiver is acceptable *iff* it maps the groups faithfully, this is the exact
axis that condition was about.

**A third discrepancy, in the stubs rather than the receiver — a glyph
contradiction.** Both the Group A stub (`:12-13`) and the Group B stub (`:12-13`)
assert: "`[-]` means **DEFERRED, not cancelled and not satisfied.**" The tree
pins the opposite meaning in four places:

- `src/agent-src/templates/roadmaps.md:30` — "`[~]` **deferred** … `[-]`
  **cancelled** (won't do — explicit drop)";
- `src/agent-src/scripts/update_roadmap_progress.ts:25` — "`[~]` deferred
  `[-]` cancelled";
- `src/agent-src/contexts/execution/terminal-states.md:41` — "`[-]` | cancelled";
- `src/agent-src/scripts/archive_completed_roadmaps.ts:396` — "`[-]`, which is
  owner-reserved AND pinned to 'won't happen at all'".

The provenance is visible: the council itself used `[-]` as its deferral glyph
throughout its recorded responses
(`agents/runtime/council/responses/topology-remainder-drain12.json`, both seats'
disposition tables read "DEFER `[-]`"). The stubs transcribed the council's
vocabulary rather than the tree's. **The receiver did not inherit the error** —
it uses `[~]` for the parent's items and `[ ]` for its own. The defect is
confined to the two stubs' framing sentences and does not affect any glyph
actually written into a roadmap.

## 3. What breaks if this file is archived or deleted?

**Short answer: nothing in CI. The obligation is real and the enforcement is
already spent.**

### 3.1 `deferralProblems` is a one-shot admission gate, not a standing check

`deferralProblems` (`src/agent-src/scripts/archive_completed_roadmaps.ts:414`)
verifies a carry **from both ends**:

| End | Check | Line |
|---|---|---|
| Source → destination | the `[~]` step carries a well-formed `<!-- deferred-resolution: carried-to=<slug> -->`; malformed or absent blocks | `:436-441`, parser `:330`, `:363-385` |
| Source → destination | the destination is not the source itself | `:449-456` |
| Source → destination | the destination is not being archived by the same sweep | `:457-463` |
| Destination exists | `agents/roadmaps/<slug>.md` **or** `agents/roadmaps/later/<slug>.md` — a bare `fs.existsSync`, frontmatter never parsed | `:458-461`, `:475` |
| Destination is not dead | a slug found only under `archive/` or `skipped/` blocks with its own message | `:475-484` |
| Destination → source | `^parent_roadmap:\s*<sourceSlug>\s*$`, escaped; for `carried-to` this is the **only** accepted proof | `:485-492` |

That the existence check never parses frontmatter is what makes a `status:
draft` file a legal destination — the gate sees a path, not a lifecycle state.

**It never runs again.** Three independent proofs:

1. `deferralProblems` has exactly **one** production call site — the archival
   loop at `archive_completed_roadmaps.ts:574`, inside
   `for (const stats of collect(roadmap_root))` (`:541`), reached only when
   `stats.open_ === 0` (`:562`) and `stats.deferred !== 0` (`:568`). Every other
   occurrence in the tree is the definition, a comment, the byte-identical
   `dist/` twin, one test, or prose.
2. `collect()` (`src/agent-src/scripts/update_roadmap_progress.ts:748-762`)
   rejects `archive/`, `skipped/`, `stubs/`, `later/` via `is_roadmap_candidate`
   (`:309-317`, `EXCLUDE_DIRS` at `:95`), and rejects every `status: draft` file
   (`:754-756`). **The parent now lives in `archive/`, so it can never re-enter
   the loop.**
3. No standing validator reads the annotations at all: grepping
   `deferred-resolution` and `carried-to` across `src/scripts/` and
   `src/agent-src/scripts/` returns only `archive_completed_roadmaps.ts` plus one
   unrelated prose mention in `lint_roadmap_complexity.ts:259`. `parent_roadmap:`
   is likewise consumed by nothing outside that same file
   (`:451`, `:485`, `:488`, `:498`, `:502`).

**Therefore: deleting the receiver, archiving it, or emptying it of all 38 items
is caught by no gate in this repository.** The 38 carried obligations rest on the
file continuing to exist, and CI would not notice if it stopped.

### 3.2 The parent's side of the link, measured

`agents/roadmaps/archive/road-to-inbox-harvest-2026-08-e-council-topology-evidence.md`
— present, 291,847 bytes, `status: ready` (`:3`), carrying
`estate_offset_exempt` (`:7`) and `estate_growth_exempt` (`:8`).

- `[~]` steps: **38**.
- `deferred-resolution:` occurrences: **40** — 38 real step annotations (at
  `:883`, `:985`, `:1077`, `:1098`, `:1115`, `:1132`, `:1170`, `:1263`, `:1298`,
  `:1525`, `:1644`, `:1661`, `:1832`, `:1914`, `:2000`, `:2019`, `:2036`,
  `:2053`, `:2253`, `:2288`, `:2347`, `:2420`, `:2449`, `:2493`, `:2510`,
  `:2630`, `:2706`, `:2722`, `:2739`, `:2783`, `:2838`, `:2910`, `:3009`,
  `:3053`, `:3071`, `:3088`, `:3107`, `:3123`), one prose quote in the header
  blockquote (`:49`), one slug-free prose mention (`:16`).
- **38 of 38 `[~]` steps name this receiver, and no other destination slug
  appears anywhere in the file.**

The counts reconcile exactly with the receiver's 38 items.

### 3.3 Inbound references — 43 hits in three files, all invisible to both gates

`grep -rl` for `road-to-council-topology-evidence-followups` and for the bare
`council-topology-evidence-followups` returns the **same three files**. The
receiver does not name itself.

| `file:line` | Form | Would it break? |
|---|---|---|
| `archive/road-to-inbox-…-topology-evidence.md:8` | slug inside the `estate_growth_exempt:` string | no — prose in a frontmatter value |
| `…:49` | prose quote of the annotation in a blockquote | no |
| `…:55` | relative markdown link `(../road-to-council-topology-evidence-followups.md)` | **yes in a renderer** — 404 on deletion; checked by no gate |
| `…` × 38 step lines | `<!-- deferred-resolution: carried-to=… -->` | **the semantic pointer** — re-validated by nothing (§ 3.1) |
| `agents/evidence/drain-run-summary.md:213` | backticked bare filename in a table cell, no directory prefix | no gate sees it |
| `agents/evidence/reviews/topology-drain12.findings.md:39` | slug in prose | no gate sees it |

Zero hits in `docs/`, `src/`, `dist/`, `.claude/`, `tests/`, or any generated
dashboard.

### 3.4 The two reference gates say nothing, and each for its own reason

**`check_no_roadmap_refs`** (`src/scripts/check_no_roadmap_refs.ts`) forbids a
*stable artifact* from citing a specific `*.md` under `agents/roadmaps/`
(`ROADMAP_FILE_RE`, `:72-73`; exit 1 at `:23`). Its scope is `STABLE_TREES`
(`:44-54`) plus `STABLE_FILES` (`:57-65`) — **neither `agents/roadmaps/` nor
`agents/evidence/` is scanned**, so all three inbound-reference files are outside
its reach. It also performs no existence check at all: it forbids the *citation*,
not the dangling link. A stable artifact linking to the receiver would fail the
build; the receiver's deletion would not.

**`check_references`** (`src/scripts/check_references.ts`) resolves internal
references over `SCAN_DIRS = ['dist/agent-src', 'agents', 'docs/guidelines']`
(`:81`) minus `SKIP_DIRS` (`:82-109`, which includes `agents/roadmaps/archive`
and `agents/evidence/analysis`). Its `PATH_PATTERN` (`:160-161`) matches only
paths whose **first segment** is one of a fixed allowlist. Consequences:

- the archive's 40 mentions sit in a skipped directory;
- the two `agents/evidence/` mentions carry no directory prefix, so
  `PATH_PATTERN` never matches them;
- **the receiver's own three `stubs/…` links are NOT checked** — `stubs` is not
  in the first-segment allowlist. A whole-file extraction over the receiver
  returns zero `PATH_PATTERN` hits, so this gate finds nothing in the file at
  all, including its `archive_completed_roadmaps.ts:414` citation at `:12`
  (`.ts` is outside the extension set).

That the three stub targets exist (§ 2) is a fact about the tree, established by
directory listing — **not a fact any gate would maintain.** `SKIP_DIRS`' own
comment (`:84-95`) records the general form of this exposure: 530 dead relative
links across 147 of 466 archived roadmaps, unseen because the directory is
skipped.

**Not run:** neither gate was executed — both instantiate a writing
`GateLedger` (`check_references.ts:29`). The commands that would prove the above
empirically are `./scripts-run src/scripts/check_references` and
`./scripts-run src/scripts/check_no_roadmap_refs`.

### 3.5 Dashboard and estate — removal is a *credit*, not a violation

- **Dashboard:** `status: draft` genuinely hides it. `update_roadmap_progress.ts`
  drops drafts from `collect()` (`:754-756`) and from the blocker section
  (`:823`); `is_draft` at `:292-294`, `DRAFT_VALUES` at `:99`. Confirmed against
  the artefact: `grep -c` over `agents/roadmaps-progress.md` returns **0**.
- **Estate T2 (the ratchet):** `check_estate_count.ts` gates six metrics
  (`:214-221`). `countEstate` (`:418-437`) derives `active_roadmaps` from the
  same draft-filtered `collect()` (`:420`), and `laterRoadmaps` skips drafts too
  (`:390`). The receiver carries no blocker section. **It contributes 0 to every
  gated metric today.**
- **Estate T3 (one-in-one-out):** `classifyDiff` (`:490-534`) is diff-scoped and
  has **no draft filter**. So *adding* the receiver counted as an addition
  (`:520-521`) — and the receiver carries no `estate_offset_exempt` line — while
  *deleting* it registers as an **offset/credit** (`:522-523`) and *archiving* it
  likewise (`:512-514`).

**Net: archiving or deleting this file cannot red CI. The exposure runs the
other way — no gate stands between the receiver and its own removal.**

## 4. Are any of the 38 items already satisfied? — six Group C spot-checks

The Group C preamble (receiver `:110-112`) claims every guard named in the stub
"is committed and runs in CI regardless of these checkboxes". Six items were
checked against the code. **The distinction that governs is between the
mechanism existing and the criterion being met — the criterion is what closes a
checkbox.**

| Item | (a) Mechanism committed | (b) What the criterion additionally demands | Criterion met? |
|---|---|---|---|
| **7.3** deterministic/probe path above council | **Yes** — precedence live in `src/scripts/_lib/judgment_ladder.ts:355-361`, `:380-383`; guard `tests/scripts/ai_council/probe_path_above_council.test.ts`; fixtures `internal/bench/council-topology/probe-resolvable-fixtures.json` | verify clause is *"a probe-resolvable fixture never enters **the selector**"* — and no selector exists: `grep -rnE 'topology[_-]?selector\|selectTopology' src/` returns two **prose** hits only (`src/agent-src/scripts/guarded_baseline.ts:20` YAML example, `src/scripts/ai_council/replay_route.ts:24` docstring) | **No** |
| **10.1** decision replay + route record | **Partial** — `src/scripts/ai_council/replay_route.ts` (223 lines): `CouncilRouteRecord` `:64`, `renderRouteSection` `:126`, `replayReproducesRoute` `:209`; **zero production callers**, sole importer is its own test | *"a replayed run reproduces the recorded route"*; 10 of 11 fields populated, `councilInternalTopology` typed `null` at `:71` because of the same missing selector. A replay artefact now exists on disk — `agents/runtime/council/responses/decision-replay.md`, **untracked** — and carries no route section | **No** |
| **10.3** emit `zero_marginal_value_call_rate` | **No — and no guard either.** `grep -rnE 'zero_marginal\|marginal_value\|marginalValue' src/ tests/` → **zero hits**; the identifier appears only in prose (receiver, stub, archived parent, review inputs) | *"the rate is emitted and is non-null on a real run"* — needs an emitter that does not exist, plus a real run | **No** |
| **11.1** offline training rows without prompt content | **Yes, for the schema half** — `src/scripts/ai_council/routing_training_row.ts:76-95`, 18 fields, every one integer/boolean/enum, no free-form field. PII-exclusion-by-construction | the step's own first word is *"**Collect**"* — and no row exists: `internal/bench/council-routing/` **does not exist on disk**, which is the guarded baseline's own declared `recheck_when` path | **No** |
| **12.2** a free explain mode | **Partial** — `src/scripts/ai_council/explain_route.ts` (157 lines): `explainRoute` `:114`, `renderRouteExplanation` `:132`; zero-provider-call property is structural (imports are only `judgment_ladder` `:38` and `pricing` `:40`) | the step says *"**Add** a free explain mode"* — no user-reachable surface: `grep -n "'explain'\|--explain" src/scripts/council_cli.ts` → no match. **Near-miss:** `src/scripts/_cli/cmd_explain.ts:425` defines `_explain_route`, but that is the **rule-router** path (`:426` calls `_load_router`) — a name collision, not a wiring | **No** |
| **12.3** force-topology control cannot override five authorities | **Yes, as a source-shape guard** — `tests/scripts/ai_council/force_topology_prohibitions.test.ts` (219 lines, last touched at HEAD `468eeefc7`), P1–P5 map 1:1 onto the five authorities; anchors live at `necessity.ts:557`, `:908`, `config.ts:1217`, `:1228` | *literally* met (one test per prohibition) but **substantively unexercised**: the population is empty — `grep -rnE 'force[_.]?topology\|forceTopology' src/` → **zero hits**. The archived parent's own honest-scope note says these gates *"cannot prove a future control fails to override an authority — only that no control exists today"* | **Literally yes, substantively no** |

**Verdict on the preamble.** It is **accurate for five of the six** — 7.3, 10.1,
11.1, 12.2 and 12.3 each have a committed `tests/scripts/ai_council/*.test.ts`
matched by `vitest.config.ts:35` and executed by `.github/workflows/tests.yml:253`
and `taskfiles/ci-fast.yml:2158`. It is **vacuous for 10.3**, which names no
guard at all. Read literally the preamble says "every guard *named in the stub*",
so it is not false — but its *position* (a blanket sentence over a twelve-item
list, three of which name no guard) invites a stronger reading than its scope
supports.

**Not one of the six has its criterion met.** Zero of the 38 items are already
satisfied on this evidence. The pattern is uniform and is the honest headline:
**the defensive mechanisms are real and the populations they guard do not
exist.**

Two caveats on the CI half, named rather than implied:

- **CI *wiring* was verified, not an observed green run.** vitest was not
  executed (its `globalSetup`, `vitest.config.ts:60`, writes `dist/` artefacts).
  **What would settle it:** `npx vitest run tests/scripts/ai_council/` in a
  throwaway checkout, or reading a recent Actions run's log for these filenames.
- **None of the five appears in any gate-coverage ledger.** They are covered by
  the generic vitest sweep, not by a named registration, so a future change to
  the shard exclusions would drop them silently. Separately,
  `.github/workflows/tests.yml:5-19` is `paths:`-filtered and does not list
  `agents/roadmaps/**` — a roadmap-only PR runs none of these.

## 5. The dispositions available, with cost and falsehood risk

Framed as **input to a decision**. Nothing below is executed, and one option is
owner-reserved regardless of what this analysis concludes.

### (i) Leave as a draft receiver, unchanged

- **Claim it makes:** the 38 items are deferred, carried, and alive with written
  triggers.
- **Tree support: mostly yes, with one gap the decider should weigh.** The carry
  is genuine and complete — 38 of 38 parent annotations name this file (§ 3.2),
  the back-link is present (`:4`), and all three detail stubs exist (§ 2). But
  the word **alive** is where the claim outruns the tree.
  `src/agent-src/contexts/execution/roadmap-execution-contract.md:145` justifies
  `spawn-follow-up-draft` as *council-decidable rather than owner-reserved*
  precisely because "the item stays alive in the active estate". Measured (§
  3.5), a `status: draft` receiver contributes **0** to every gated estate
  metric and appears on no dashboard. It is alive in the filesystem, not in the
  estate. **The preservation guarantee is weaker than the contract's own
  justification for granting the disposition assumes.**
- **Cost:** zero.
- **Falsehood risk:** low on the carry, real on "alive". Also carries forward
  the three § 2 defects uncorrected.

### (ii) Flip to `ready` and schedule

- **Claim it makes:** this is scheduled work.
- **Tree support: no, and § 1 contradicts it directly.** Every trigger is unmet;
  two of them (Group A conjunct 2, Group B) require a reservation the tree
  **cannot represent**, and Group A conjunct 1 needs the schema ceiling of five
  providers against two enabled. Declaring scheduled work whose gating condition
  is inexpressible is the sharpest available falsehood in this set.
- **Cost: three verified CI reds, on the status flip alone.**
  1. `check_roadmap_trackable` scans non-draft roadmaps only
     (`src/scripts/check_roadmap_trackable.ts:18-21`, `find_active_roadmaps`
     `:164`). The receiver has **zero** `## Phase <id>` headings — its
     sections are `## Group A/B/C` — so `violations_for` `:197-204` fires:
     *"no `## Phase <id>` … heading matched … Either rename headings … or add
     `status: draft`"*. The gate's own remedy text names the current status as
     the fix.
  2. The `relates:` ratchet at `:287-292` counts non-draft roadmaps lacking a
     `relates:` block. The receiver has none (§ 0), so `no_relates` rises one
     above the base-ref floor.
  3. Estate T2 `active_roadmaps` gains one above the base-ref floor (§ 3.5),
     needing an offset or an `estate_growth_exempt:` line.
- **Falsehood risk: high.**

### (iii) Cancel some items as `[-]`

- **Claim it makes:** those items are no longer wanted.
- **Tree support: no, for any of the 38.** § 1 and § 4 show items whose triggers
  are *unmet* or *unrepresentable* — not items shown to be unwanted. Nothing in
  the evidence supports "no longer wanted" for a single one.
- **Cost: owner-reserved, so unavailable to an autonomous run in any case.**
  `roadmap-execution-contract.md:146`: `cancel-with-memo` "is a **drop**, so it
  is owner-reserved by the preservation test: the run WRITES the memo and the
  recommendation, and the archive still waits for the user on that item."
- **Falsehood risk: high**, and compounded by the § 2 glyph confusion — the two
  stubs already assert `[-]` means deferred, so a `[-]` written here would be
  read one way by the stubs and the opposite way by
  `archive_completed_roadmaps.ts:396`, `terminal-states.md:41` and
  `templates/roadmaps.md:30`.

### (iv) Split into three receivers

- **Claim it makes:** the three triggers are non-fungible and each needs its own
  home — the anthropic seat's 2B position (receiver `:29-32`).
- **Tree support: partial, and largely redundant.** The non-fungibility is real
  (§ 1 finds three different verdicts across the groups). But the per-group
  detail **already lives in three separate files** — the stubs (§ 2) — so a split
  reproduces a structure the tree has, while the receiver's per-group sections
  already satisfy anthropic's stated *condition* that the triggers stay
  distinguishable.
- **Cost:** T3 fires on every added `agents/roadmaps/road-to-*.md` **regardless
  of status** (`check_estate_count.ts:490-534`, no draft filter), so three
  additions need three offsets or three `estate_offset_exempt:` lines; deleting
  the current receiver supplies one credit. Plus 38 parent annotations would need
  re-pointing across three slugs — and § 3.1 shows **nothing would verify the
  re-pointing**, since the parent is already archived.
- **Falsehood risk:** low on the claim, but the re-pointing is unverifiable,
  which is a new and worse exposure than the one it fixes.

### (v) Correct the receiver in place, status untouched — named because it is absent from the list

- **Claim it makes:** nothing new. It removes three false or unsupported
  statements the file currently carries.
- **What it would fix:** the "each stub carries the per-group forbidden-claims
  list in full" sentence (`:144-145`), false for two of three stubs (§ 2); the
  24-vs-23 gap between the receiver's Group A and the stub's enumeration (§ 2);
  and, in the two stubs, the `[-]`-means-deferred sentences that contradict four
  places in the tree (§ 2).
- **Cost:** three prose edits, no status change, no gate touched — the file stays
  draft, so `check_roadmap_trackable` and the estate metrics stay silent.
- **Falsehood risk: negative** — it is the only option that reduces the number of
  unsupported statements in the tree.

### Recommendation — input, not decision

**Recommended: (i) plus (v) — keep the draft receiver, and correct the three
faithfulness defects in place.**

The reason in one line: **every resumption trigger is unmet, and three of them
are not merely unmet but unrepresentable in this tree, so no option that
implies scheduling, cancellation or readiness is supportable — which leaves
preservation, and preservation is improved by fixing what the file says rather
than by changing what it is.**

Two things a decider should weigh that this recommendation does not settle:

1. **The "alive in the active estate" gap (§ 3.5, § 5(i)).** If the
   `spawn-follow-up-draft` disposition is council-decidable *because* carried
   items stay in the active estate, then a draft receiver — invisible to every
   gated metric — may not be discharging that justification. That is a question
   about the disposition's own contract, not about this file, and it is
   owner-shaped.
2. **The unguarded-removal exposure (§ 3.1).** 38 obligations rest on a file no
   gate protects. Whether that warrants a standing validator over
   `deferred-resolution:` annotations is a separate decision; this dossier only
   establishes that no such validator exists today.

## Addendum, 2026-09-01 — what happened next, and one correction to this dossier

Everything above records the tree at commit `468eeefc7` and is left standing.
This section is appended rather than edited in, because a dated evidence
artifact that rewrites its own findings stops being evidence.

**The AI council ran in parallel with this analysis and converged 2/2 on 4A:
the receiver stays unchanged as a draft receiver.** Both seats reached it
independently and gave the reasons § 5 gives — deleting it breaks the carry,
flipping to `ready` and cancelling as `[-]` cross explicit reservations, and
directory emptiness does not outrank accurate state. Recommendation (i) is
adopted; recommendation (v) was executed.

**One finding above is wrong, and in the direction that matters — it
undercounted.** § 2 says the `[-]`-means-deferred defect sits in "the two bench
stubs". A tree-wide sweep for the construct found it in **three**: the
instrumentation stub carries it too, at its line 11, which the § 2 read missed.
Six sites across the three files, all corrected. The sweep also surfaced a
*different* construct — `[-]` means TRANSFERRED — in the harness-promotion
family; that one self-documents the hazard in its own risk register and is
two-thirds archived, so it was left alone rather than swept up.

Two further facts the corrections turned up, neither visible from the § 2 read:

- **The stubs were wrong about the glyph as well as its meaning.** They said
  their steps are `[-]` in the parent. All 38 carried steps are `[~]`; the
  parent's only four `[-]` are Phase 4 items 4.2, 4.4, 4.5 and 4.6, genuinely
  cancelled and not carried. Both errors have one root, which the parent's own
  correction note at `:38-46` records: the deferrals were first encoded `[-]`,
  an R2 review corrected the parent before it shipped, and the stubs were not
  corrected with it.
- **The forbidden-claims pointer was circular.** § 2 established that two stubs
  lacked the lists. What it did not establish is that eight of the parent's
  deferral blocks end by pointing *at those stubs* for exactly those lists — so
  for five steps the pointer resolved to nothing at either end. The lists were
  transcribed from the parent's own deferral prose and the sources cited inline.
  The council responses JSON carries the same prohibitions in a cleaner form and
  was deliberately **not** used as provenance: it is gitignored and auto-pruned,
  so a citation to it would rot.

**Unchanged by any of this:** every § 1 trigger verdict, the § 3 archive-impact
result, and all six § 4 spot-checks. No checkbox, `status:` field or deferral
state was touched. The appendix below is as originally written.

## Appendix — what was not checked

| Not established | What would establish it |
|---|---|
| An observed green CI run for the five Group C guard tests (wiring verified only) | `npx vitest run tests/scripts/ai_council/` in a throwaway checkout, or a recent Actions log |
| The Group B corpus census of 1,402 eligible bodies, cited at `af77709fd` | a read-only invocation of `assembleLeakageCorpus` over `agents/runtime/council/responses/` |
| Empirical output of the two reference gates | `./scripts-run src/scripts/check_references`, `./scripts-run src/scripts/check_no_roadmap_refs` |
| Empirical output of the estate gate | `./scripts-run src/scripts/check_estate_count` |
| Whether the five Group C guards survive a future vitest shard-exclusion change | a named registration in a gate-coverage ledger; none exists today |
