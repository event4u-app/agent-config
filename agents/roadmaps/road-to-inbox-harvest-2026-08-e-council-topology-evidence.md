---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
research_pin: "agent-config @ f16c7d9df2e1a4a6f480e734be6ed3a0138fc14d · @event4u/agent-config 14.10.0 · citations re-verified against the landing HEAD 2026-08-24"
estate_offset_exempt: "The one-in-one-out half of the estate ratchet fires on every added agents/roadmaps/road-to-*.md regardless of status, but the only roadmaps this drain run archived carried status: draft and were therefore never counted by the ratchet in the first place, so none of them can serve as this file's offset."
estate_growth_exempt: "open_blockers +1 net, and the +1 is the Phase-2 entry alone. Two blocker edits land here and only one grows the metric. (a) RECLASSIFICATION, net 0: `leakage-bench-needs-quota-and-an-uncommittable-corpus` is resolved as FALSIFIED and replaced by `leakage-bench-needs-assembler-and-design-forks`, on an AI-council verdict of 2026-08-31 that both stated obstacles had ceased to exist — the UTC quota reset happened (26/50 and 27/50 against a cap of 50) and 716 provider-attributed response bodies exist locally, 23x the >=30 floor. One resolves, one opens. (b) GROWTH, +1: a new `phase-2-benchmark-cost` entry. It records no new work. It carries a condition that already gated 23 of this file own 46 open steps while living only in step prose at 2.1 closing note — more than every recorded blocker in this file combined — which is the exact defect this frontmatter previous claim says the 3.3/3.4 entry was created to avoid. Leaving the largest condition in the file uncarried while citing that principle is the inconsistency being repaired. No offsetting disposal is claimed: this roadmap has 46 open steps and is nowhere near archival."
---

# Road to an evidence-routed council rung

> **Source:** `agents/tmp.old/nxt-council/road-to-evidence-routed-council-master.md`

## Goal

Turn the shipped AI council into an **evidence-routed** decision layer: it
spends only where another reasoning stage measurably improves the decision,
uses the smallest sufficient deliberation topology, and can explain and
attribute every paid call — **without adding a second task-side router beside
the existing judgment ladder**.

Two governing constraints, and the second is the one that shapes the whole
plan:

> Use the smallest reasoning topology that measurably improves the decision.

> There remains **one** task-to-orchestration resolver. Council topology is a
> refinement of the already-selected council rung, never a parallel router.

## Context

### The architectural rejection this roadmap exists to carry

The inbox carried three rival drafts of this workstream. Two dissolve into this
one; what survives from the adjudication is a single **rejection**, and it is
the most load-bearing sentence in the file.

One rival draft proposed a standalone `CouncilTopologyRouter` as a new
task-side resolver. That would have landed an architecture violation.
`src/scripts/_lib/judgment_ladder.ts:1-3` declares itself *"the ONE resolver
that decides which of the five dispatch rungs (0-4), or the silent ∅, a task
resolves to"*, and `:16-20` closes the same docstring with the explicit
warning that three previously-scattered classification surfaces get **one**
resolver here, *"never a fourth parallel classifier bolted on beside it"*.

So the correct shape is: the judgment ladder decides **whether council is the
right orchestration class**; `src/scripts/ai_council/necessity.ts` remains the
council-internal necessity gate; and everything this roadmap adds hangs off the
council rung *after* the ladder has already resolved to it.

```text
request / task
   │
   ▼
judgment ladder — the ONE task-side resolver
   ├── deterministic / script
   ├── bounded ask
   ├── subagent
   ├── team
   ├── council  ──►  necessity gate ──►  council-rung topology refinement
   └── user / in-session boundary          ├── single_external
                                           ├── dual_independent
                                           ├── advisor_diversity
                                           ├── peer_review
                                           ├── judge_synthesis
                                           ├── targeted_cross_exam
                                           └── full_debate
```

`team` and `user_required` deliberately do **not** appear in the topology
vocabulary: the ladder and the Hard Floor already own those classes.

### Anonymized provenance

Per [`source-confidentiality`](../../src/rules/source-confidentiality.md), the
external references that seeded parts of this analysis are named
**source-anonymously**; real links are retained as `ENC1:` tokens for
maintainer recovery only.

| Ref | What it contributed | Link |
|---|---|---|
| **Source A** | Three-stage method shape: independent generation → blind peer evaluation → synthesis. Method inspiration; no incorporated code. | `ENC1:` (pending maintainer encryption) |
| **Source B** | Thinking-lens framing that informed the shipped advisor personas. | `ENC1:` (pending maintainer encryption) |
| **Source C** | CLI-first / fallback packaging ergonomics. | `ENC1:` (pending maintainer encryption) |

Two of the three reportedly ship **no LICENSE file**, which is unverifiable
offline and is why `blocker: unlicensed-source-verbatim-scan` gates P0. No
license means no grant — so this is **not** the license-required-attribution
carve-out, and the source names stay anonymized in this roadmap even though
`CREDITS.md` is itself a denylist carve-out path.

### Deferrals held elsewhere, on purpose

- **Trigger-phrase taxonomy** — owned by the routing-assurance line
  (`agents/roadmaps/stubs/road-to-assurance-benchmark.md`); not re-opened here.
- **HTML verdict surface / verdict UX** — owned by
  `agents/roadmaps/stubs/road-to-council-visibility.md`; not smuggled in here.
- **Advisor seating** — owned by
  `agents/roadmaps/stubs/road-to-council-persona-fanout.md`, which already
  carries a pre-registered bench gate. Phase 9 points at it and adds nothing
  parallel.

---

## Prevented items — verified already-shipped

Each row was proposed by one of the three source drafts and is **deleted**, not
deferred: the mechanism already exists in the tree. A phase that rebuilt any of
these would be additive reimplementation of mature code, which the adjudication
called a larger risk than feature absence.

| Proposed | Already shipped at | Disposition |
|---|---|---|
| Blind / anonymised peer-review machinery | `src/scripts/ai_council/blind_review.ts`; delivered by `agents/roadmaps/archive/road-to-council-blind-review.md` | Deleted — exists |
| Dissent quota, novelty gate, anti-conformity directive | `ai_council/debate_gates.ts:15,18,32,51,61,81`; directive text `ai_council/prompts.ts:180`; default-off at `ai_council/config.ts:1118` (re-measured 2026-08-29; `:1113` is the docstring, the default literal is `:1118`) | Deleted — exists (default-off is a config decision, not a gap) |
| Multi-round debate | `ai_council/orchestrator.ts:389-393`; steel-man pass `:1036-1040` | Deleted — exists |
| Finding-level consensus + minority retention | `ai_council/consensus.ts:22-23,43-44,157,235,267`; `ai_council/stance_tally.ts` | Deleted — exists |
| Decision replay | `ai_council/replay.ts:1-14,210`, wired at `src/scripts/council_cli.ts:1270,1280` — re-measured 2026-08-29: those two lines are the AUTOMATIC writer, not the `replay` subcommand; the subcommand wiring is elsewhere and is recorded in the 0.1 baseline | Deleted — exists |
| Low-impact fast path **and** its governing rule | `ai_council/low_impact.ts:1-20` + [`fast-path-marker-visibility`](../../src/rules/fast-path-marker-visibility.md) | Deleted — exists on both layers |
| Five thinking-style advisor personas | `src/agent-src/personas/advisors/{contrarian,executor,expansionist,first-principles,outsider}.md`; engine `ai_council/advisors.ts:1-32` | Deleted — exists (seating is the real gap, see P9) |
| Necessity classifier, CLI transport, model-size downgrade | `ai_council/necessity.ts`; delivered by `agents/roadmaps/archive/step-1-ai-council-cli-transport.md` | Deleted — exists |
| Quota / API-fallback / attendance integrity | `archive/road-to-council-api-fallback.md`, `archive/road-to-council-quota-accounting-truth.md`, `archive/road-to-inbox-harvest-2026-08-b-council-integrity.md` | Deleted — three archived roadmaps delivered it |
| **Quota-source split** | `agents/roadmaps/later/road-to-council-api-quota-source-split.md` — parked with a recorded AI-council verdict, 2 of 2 seats, 2026-08-19 | **Deleted — do not re-propose.** Re-proposing it would override a live decision; its resume trigger is the evidence file that record names |

---

## Corrections applied at landing (2026-08-24)

| # | Source claim | Correction | Basis |
|---|---|---|---|
| 1 | "Blind review is default-on" | Blind **chairman synthesis** is default-on; blind **peer review** is **opt-in**. The two were conflated in the originating transcript. | `council_cli.ts:3551` sets `blind_chairman: true` (re-measured 2026-08-29; the `:3557` reading below was already stale); `_peer_review_active` at `council_cli.ts:1289-1295` requires an explicit flag or `peer_review.enabled` |
| 2 | Parallel first-round fan-out is unbuilt work | It is a **deliberately reversed decision**. Phase 4 is therefore framed as *reopening a closed decision* under [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md), and must address the interactive-overrun prompt the reversal bought and the byte-pinned dispatch-order tests. | `ai_council/orchestrator.ts:8-12` records that *"the previous parallel ThreadPoolExecutor was traded for predictable mid-flow user prompts"*; `grep -c 'Promise.all'` over that file returns **0**; the historical contract is pinned byte-for-byte by tests (`:3-6`) |
| 3 | Round-count bias bench carried no citation | Grafted the research citation the round-count phase rests on: **arXiv 2505.19477** (round-1 debate bias amplification). It appeared in a dissolving sibling draft and **0** times in the master, leaving Phase 2.7 an unsourced measurement request. | Sibling draft in the same inbox directory |
| 4 | `council_cli.ts:3555` | → `council_cli.ts:3551` (-4) | Re-measured 2026-08-29 under step 0.1. The landing correction said `:3557` (+2); it drifted again, in the other direction. A line-number correction has the same shelf life as the number it corrects — this row is kept rather than rewritten so that fact stays visible. |
| 5 | `prompts.ts:204` | → `prompts.ts:206` (+2) | Read at landing HEAD |
| 6 | `judgment_ladder.ts:15-19` for the no-parallel-classifier warning | → `:16-20`; the sentence ends one line later than the source cited | Read at landing HEAD |
| 7 | P0 provenance framed as new work | Marked **EXTEND**, not create: `CREDITS.md` (69 lines) and `provenance/harvests.jsonl` (**5** rows) both already exist | Read at landing HEAD |
| 8 | Ten proposals framed as roadmap features | Moved to § Prevented items with a citation each | See that table |

---

## Phase 0 — Provenance and the one-resolver lock

- [x] 0.1 Pin current council behaviour in
  `agents/evidence/analysis/council-intelligence-baseline.md`: ladder council
  rung, necessity gate, advisor wiring, round resolution, blind-review
  ordering, consensus semantics, anti-conformity and novelty gates, spend /
  overrun / daily gates, replay schema, low-impact path, current synthesis
  policy.
      verify: every behavioural claim in the file carries a `file:line` or an
      executable probe; a reviewer can refute any single line without reading
      the code twice
- [x] 0.2 Inventory every council-related rule, command, script and config
  surface, classified as task-side routing / council-internal necessity /
  topology-depth / rendering / spend governance / replay-evidence /
  compatibility / dead-duplicate.
      verify: no council-routing surface is left uncategorized, and the
      dead-duplicate column is either empty or each entry names its successor

      **0.1 and 0.2 CLOSED 2026-08-29.** Two artefacts, both opening with
      `<!-- evidence-type: analysis -->` (`analysis` is a valid type —
      `src/scripts/lint_evidence_artifacts.ts:59-64`):

      - `agents/evidence/analysis/council-intelligence-baseline.md` — 1,673
        lines, the twelve behaviours in the order 0.1 lists, plus a doc-vs-code
        section, a `## Not established` section, and the `_lib/` council surfaces
        and `auto_dispatch.ts` that 0.1's own list omitted. **340 lines carry a
        `path:line` citation; 19 items landed in `## Not established`** rather
        than being asserted — that section is the step's honesty surface, not a
        shortfall.
      - `agents/evidence/analysis/council-surface-inventory-2026-08-29.md` —
        **164 surfaces**, one per row, every row in exactly one of the eight
        fixed categories with no blank cell: `task-side routing` 48 ·
        `compatibility` 39 · `topology-depth` 27 · `replay-evidence` 18 ·
        `council-internal necessity` 14 · `rendering` 10 · `spend governance` 6 ·
        `dead-duplicate` 2. Both `dead-duplicate` rows name a successor
        (`ai_council/one_off_archive/` → `council_cli.ts`; ADR-093 → ADR-104).
        A `## Contested classifications` section covers four arguable rows with
        the evidence that would decide each, and an `## Incidental mentions`
        section accounts for the ~70 files that match a `council` grep but only
        cite a past decision — so nothing is silently dropped.

      **This step's own numbers were wrong and are corrected here:** the text
      said "~55 modules" in `ai_council/` and "12 top-level scripts". Measured,
      `ls src/scripts/ai_council/*.ts | wc -l` is **53**, and 11 top-level
      scripts match `*council*` — the twelfth match is the `ai_council`
      directory itself.

      **The four defects worth carrying forward, all independently re-verified
      at the cited lines rather than taken on report:**

      1. **`effective_mode` is pinned.** `ai_council/config.ts:1700` sets
         `default_mode = 'auto'` and `:1722` reads
         `const effective_mode = default_mode;`, with `member_mode` hardcoded
         `null` at `:1721`. So `defaults.mode` and per-member `mode:` are
         **ignored**, and four surfaces of
         `docs/contracts/ai-council-config.md` still assert they override
         `auto` — including two validation rules that describe unreachable code.
      2. **The rung-4 degradation is unrecorded, and the asymmetry is the
         finding.** `_lib/judgment_ladder.ts` returns `rung: null` at `:374`
         (`emergency.orchestration_halt`) and `:377` (no `subagent_spawn`
         primitive) **before** the contested-judgment check at `:379`, whose
         match would have returned `rung: 4` at `:382`. The rung-3 path records
         its degradation (`degraded_from: 3` at `:396` and `:403`); these two
         early returns set no `degraded_from`, because they never reached the
         rung they dropped. Recorded with the corrected line numbers — the
         reported ones were off by a few.
      3. **Twelve contradictions in `docs/contracts/ai-council-config.md`**, in
         three families: the un-propagated transport-key removal (four
         surfaces), two validation rules describing unreachable code, and three
         copy-paste hazards — the worst being `fast_path:` documented at the
         wrong nesting level, where a pasted config silently falls back to
         defaults with **no error**. Enumerated in the baseline artefact. Not
         fixed here: 0.1 and 0.2 are read-and-record steps, and rewriting a
         contract is a separate change with its own review.
      4. **Named dead paths**, reported rather than assumed:
         `argument_exhaustion.ts`, `seating.ts`, `route_decision`, both corpus
         classifiers, `resolve_low_impact`, `plan_fast_path`,
         `probation_gate.run_gate`, `confidence_gate` via
         `dispatch_with_escalation`, and `assert_synthesis_sections` have zero
         production callers. `on_overrun` has no producer at all, so the
         documented mid-flow overrun prompt is agent-carried prose, not code.

      **One reported correction was itself wrong, and rejecting it is part of
      the record.** The 0.1 pass reported step 0.5's "80 tests, all green" as
      actually 47. It is **80**: `npx vitest run
      tests/scripts/one_resolver_invariant.test.ts` prints `Tests 80 passed
      (80)`. The 47 is the count of line-anchored `it(` blocks; the remaining 33
      come from parameterised `it.each` blocks, which a grep cannot see. The
      roadmap's original number stands, and this paragraph exists because a
      correction accepted on report would have replaced a true number with a
      false one.
- [x] 0.3 **EXTEND** `CREDITS.md` and `provenance/harvests.jsonl` (5 rows
  today) with the method lineage as **Source A / B / C** — method inspiration,
  not incorporated code. Real links land as `ENC1:` tokens only.
      verify: `./scripts-run src/scripts/lint_harvest_provenance` green, and
      `./scripts-run src/scripts/check_no_external_sources` reports zero
      denylisted tokens across the tracked diff

      **CLOSED 2026-08-30.** `CREDITS.md` gains a **Method lineage** section —
      deliberately NOT under the license-required heading above it, because
      nothing about these three is license-required: no code or text is
      incorporated, and recording them is the epistemic obligation
      `code-provenance` § the knowledge layer states, not a legal one.
      `provenance/harvests.jsonl` goes 9 rows → 12, one per source, each
      carrying what it actually contributed rather than a label.

      **The `ENC1:` column is a PLACEHOLDER and now says so in the artefact.**
      `link_crypto.ts` needs `secrets.link_encryption_key`, which is absent from
      every tracked tree and from an agent's reach, so no real token can be
      produced here. The step's *"real links land as `ENC1:` tokens only"* is
      satisfiable only by the maintainer. What made the row complete anyway is
      the ledger's own sanctioned alternative: `source_ref: opaque:…`, already
      the shipped form for a source that cannot be pinned to a public revision —
      `opaque:reflection-failure-modes-a` is the precedent, in the row above
      these three. Recording the placeholder as a placeholder rather than
      letting `ENC1:` read as a finished token is the honest half.

      **Measured:** `lint_harvest_provenance` reports *12 ledger row(s) OK · 2
      citation(s) resolved across 5 scanned root(s)*, and
      `check_no_external_sources` sits at its 148 baseline with **zero added** by
      this diff — the three new rows carry no denylisted token by construction,
      since every identifier in them is `opaque:` or a Source A/B/C label.
- [x] 0.4 Run the unlicensed-source verbatim scan: phrase-diff the advisor
  persona files and the peer-review / synthesis prompts against the source
  texts. Rewrite anything substantively verbatim.
      verify: the evidence file records the scan result **and** the commits
      read; blocked on `blocker: unlicensed-source-verbatim-scan`
      <!-- Executed 2026-08-30 under the blocker's option (c).
      `agents/evidence/analysis/council-topology-verbatim-scan-2026-08-30.md`
      records the corpus with per-file sha256, the FULL authoring history of
      each file (not a sample), the three mechanical checks and their zero
      results, and — first, because it governs everything after it — that
      upstream provenance was NOT reachable offline and that no run of this
      step can make it so. The file claims neither that the sources carry a
      licence nor that they do not, and it states which proxy the zero result
      is a result ABOUT: it is not a similarity scan and cannot be one without
      the fetched source text. -->
- [x] 0.5 Lock the one-resolver invariant in documentation **and** in a test:
  `judgment_ladder.ts` stays the one task-side resolver, no
  `CouncilTopologyRouter` beside it, topology refinement begins only after the
  ladder resolves to `council`, `necessity.ts` keeps its council-internal role.
      verify: a deliberately-added second task-side council router makes the
      new architecture test fail; sabotage the guard, watch it go red, restore

      **Closed 2026-08-29, after SEVEN review rounds, four of which killed an
      implementation outright.** The invariant was documented and enforced by nothing:
      `judgment_ladder.ts`'s docstring states all three clauses — one resolver,
      "never a fourth parallel classifier bolted on beside it", and
      "deliberately independent of `ai_council/necessity.ts`" — and a docstring
      cannot fail. A second task-side council router could have landed beside
      the ladder with every gate in this tree green.

      Landed: `src/scripts/_lib/one_resolver_invariant.ts` and
      `tests/scripts/one_resolver_invariant.test.ts` — **80 tests, all green**;
      `tsc --noEmit` and `eslint` clean.

      **It parses. It does not lex, and that is the whole finding.** Three
      fresh-subagent R2 rounds — each dispatched at a deterministically
      generated package, none of them authored by the implementing session —
      killed three successive text-scanning implementations, and each defect
      was introduced by the repair for the last:

      | Round | Approach | What the reviewer measured |
      |---|---|---|
      | 1 | no comment/string handling | false POSITIVE: a router name in a comment or a string counted as a declaration |
      | 2 | ordered regexes, block comments stripped first | false NEGATIVE: a `//` comment containing a glob opened a spurious block comment. **12 files under `src/` lost top-level exports** |
      | 3 | hand-written single-pass character scanner | false NEGATIVE, **worse**: a backtick inside a *regex literal* read as a template opener, and templates do not end at a newline. **54 files, 231 exports lost**, plus a reachable false positive |

      Round 3's trigger was ordinary, not exotic: `check_portability.ts:741`
      contains a regex with a backtick in it. Round 1's headline was sharper
      still — the test advertised as "guards the guard" never called the scanner
      at all, so one walking **zero files** passed it, which is precisely the
      failure it claimed to exclude.

      **The N=3 budget fired and the decision went to the AI council, which
      SPLIT.** One seat argued for withdrawing the guard and enforcing the
      invariant by review; one for parsing with the TypeScript compiler API.
      Both refused another hand-lexing round, and — decisively — **both
      classified withdrawal and narrowing as owner-reserved**, since each
      changes what "done" guarantees. Parsing was therefore the only option
      either seat permits a council to execute, and it is what landed. The
      withdrawal option is recorded here as a live owner decision, not as a road
      not taken.

      Both seats asked the same two principles be recorded:

      > A gate must not implement a partial lexer or parser for a language when
      > an authoritative parser for it is already a dependency.

      > A repair is tested against the violated PROPERTY and representative
      > mutations, never against the reproducer's literal spelling.

      The second explains the pattern the reviewers kept finding underneath the
      lexing bugs. The clearest instance: the resolver check tested for the
      identifier `classifyLadder`, so round 2's reproducer
      `export const NOTE = "moved"` was caught while
      `export const classifyLadder = "moved"` — the same stub keeping the name —
      scanned green. It now tests the declaration KIND, so a resolver must be
      callable rather than merely named.

      **The frozen claim, stated so nobody reads the guard as wider.** It
      asserts syntactically that no module outside the sanctioned resolver
      exports a binding whose NAME matches a router pattern, in any export form
      the parser recognises; that the resolver itself exports a callable one;
      and that the resolver names no council-internal module in any import,
      re-export, dynamic-import or `require` specifier. It asserts **nothing**
      requiring symbol resolution or a module graph — a router exported under an
      unrelated name is outside the claim, and two tests pin that limit so it
      cannot be quietly read as coverage.

      **Sensitivity and polarity, both established rather than assumed.** Four
      sensitivity arms add a defect and observe the guard go red, each asserting
      the baseline clean **and non-empty** first: a second router beside the
      ladder, a function-shaped one, an `ai_council` import in the resolver, and
      the resolver deleted. Five denial arms must stay green — a file that
      merely mentions the council, a council-INTERNAL module even when it
      literally declares `CouncilTopologyRouter`, a `.test.ts` naming one, a
      router name inside a comment or a string, and an `ai_council` import in a
      non-resolver file. Every reproducer from all three killed rounds is
      retained as a permanent regression, because their absence is exactly what
      let each round's repair look complete.

      **Anti-vacuity is asserted on the scanner's own report**, which was round
      1's correction: `checkOneResolver` returns `{ violations, scanned }`, the
      real-tree test asserts `scanned` exceeds 100 files and contains
      `judgment_ladder.ts` by path, and an empty directory is driven to pin the
      pair a vacuous scan produces.

      **ROUND 4 — 4 findings, and the fourth round is the one that did not find
      a new failure class.** The reviewer's verdict on the model: *"yes, for the
      frozen claim as written. None of the four findings requires symbol
      resolution or module-graph analysis."* Under the council's stopping rule
      that makes them repairable rather than an owner exit, and all four are
      repaired.

      The high one is the mirror of every previous round and worth the space:
      `exportsRouterFunction` recognised a router only when declared **inline**,
      so five behaviour-preserving spellings of the *genuine* resolver were
      reported as `resolver-is-not-a-resolver` — `export { classifyLadder }`
      after a function declaration, `export default classifyLadder`, an
      `as`-cast arrow, a `satisfies`-annotated arrow, and an aliased local
      export. It was **internally inconsistent**: `declaresRouter` accepted the
      identical syntax, so one spelling counted as "declares a router" for every
      other file and as "is not a resolver" for this one, and the emitted
      diagnostic asserted the resolver had "gone somewhere this guard does not
      look" while the function sat two lines above. A false POSITIVE, so it
      opened no hole — but a gate that reds on a legitimate refactor is a gate
      that gets bypassed, which is the risk the reviewer named and it is not
      cosmetic. Now resolved through local declarations, with the re-export and
      stub refusals from round 3 preserved.

      The other three: `.tsx`, `.mts` and `.cts` were never read, so a second
      resolver in any of the tree's **28 live `.tsx` files** scanned green —
      and the gap was *masked*, because `src/ui/` contributes `.ts` paths to
      `scanned` and the directory therefore looked covered. That is the third
      time in four rounds a blind spot hid behind a non-empty `scanned`, which
      is the honest limit of that discriminator. A namespace's own name was read
      and its body was not, so a router inside `export namespace Dispatch { … }`
      was invisible while the enclosing form was caught — worse than omitting
      the kind, because the visitor listed it. And two claims in this record
      were wider than the artefact.

      **Both of those claims are corrected here rather than softened.** "Every
      reproducer from all three killed rounds is retained" is now true: round
      3's two false-POSITIVE reproducers had no pin and now do. And the limits
      below are stated at the claim level rather than in a helper's docstring,
      which the stopping rule declares insufficient.

      **ROUND 5 — the terminating round, 1 blocking finding and 5 recorded
      limits.** Dispatched with an explicit rule: report a blocking defect if
      one exists, and mark everything else non-blocking, because each prior
      round's repair moved the review scope and forced another round.

      The blocking one was the sharpest of all five, and it was **inside the
      round-4 repair**: `parse()` hard-coded `ts.ScriptKind.TS` for every file
      while round 4 had just widened the extension list to admit `.tsx`. Round 4
      therefore widened WHICH files are read without widening HOW they are
      parsed, so a `.tsx` module's JSX text tokenized as ordinary TypeScript and
      **rounds 2 and 3's defect classes were both live again** — a `/*` in JSX
      text opening a block comment, a backtick in JSX text opening a template.
      All 28 non-test `.tsx` files in the tree parse differently as `.ts`. Fixed
      by deriving the script kind from the extension; three tests go red without
      it, verified by reverting the one expression.

      **The round-4 test could not have caught it, and the reason is the second
      council principle again:** it wrote a `.tsx` file containing **no JSX** —
      the reproducer's spelling rather than the property. The new arms carry
      real JSX, which is the actual discriminator.

      One sentence in the module was false and is corrected rather than
      softened: "the entire defect class above is gone rather than relocated"
      was true of `.ts` and **not** of `.tsx`, where round 4 relocated it. Both
      the module and this record now say so.

      **The five non-blocking findings are RECORDED, not repaired**, and that is
      a deliberate stop rather than an omission: a dotted `namespace A.B` body is
      unwalked while the block form is covered; `exportsRouterFunction` never
      got the namespace walk `exportedNames` received, so the two disagree on
      one source; an ambient `export declare function` is accepted as callable;
      a non-exported namespace's members are reported as a second resolver (a
      false positive); and a symlinked directory is invisible while a UTF-16
      file is counted as scanned but read as mojibake. All five are in the
      module's own frozen-claim block, because a buried caveat is not a
      disclosure. Four are syntactic and repairable by whoever needs them.

      **ROUND 6 — a bounded confirmation, and the blocking finding is closed.**
      Round 5's own verdict named the condition: *"Fix the ScriptKind and the
      sentence becomes true; findings 2–6 are then genuine limits to record
      rather than to close."* Round 6 was dispatched to check exactly that, and
      confirmed it: `.tsx` → `TSX`, everything else → `TS`, all three call sites
      threading the real path; **12 of 12 legal TSX constructs** detected above a
      literal router with **0 parse diagnostics**; live blast radius **0 names
      gained, 0 lost, identical `scanned`, 0 violations**. *"The defect class is
      closed, not relocated."*

      It also found the recurring principle a fifth time, in my own test: of the
      four new JSX arms, **three discriminate and one does not.** The backtick
      arm uses a **balanced** pair — `` `npm run x` `` — which closes the
      template on its own line, so it passes under both parsers; round 5's
      reproducer had an **odd** backtick and does discriminate. Three arms pin
      the comment-opener class and **none** pins the backtick class in `.tsx`.
      The roadmap's "three tests go red without it" was measured and is exactly
      right — it never claimed four — but the gap is real and is recorded rather
      than quietly closed.

      **Round 6's four findings are `accepted-risk`, not repaired**, on the rule
      set before round 5 ran: one medium (the balanced-backtick arm), two lows
      where a recorded limit carries only the first of its source finding's two
      halves, and one low the delta itself introduced — the guard never inspects
      `parseDiagnostics`, so a `.tsx` that fails to parse loses its exports
      silent-green while still counting in `scanned`. That last one is bounded
      by `tsc --noEmit` gating the tree, so no second resolver can sit in
      non-compiling source in a green tree. The reviewer's own risk note agrees
      with the stop: *"a sixth round on these four would move the scope hash
      again for changes that open no hole."*

      **Why the loop stopped here rather than at a clean round.** Seven rounds,
      33 findings, and every repair moved the scope hash and forced the next
      round. The terminating rule was set before this round ran, not after
      seeing its result: fix what blocks, record what does not. A sixth round
      would be measuring a guard that has already had four defect classes
      removed from it, and the honest cost of stopping is the five limits above,
      written where a reader meets them.

      **What this step does NOT close, stated at the claim level:**

      - **The third clause of 0.5** — "topology refinement begins only after the
        ladder resolves to `council`" — is a sequencing property of code that
        does not exist, since no topology refiner is built. Any check for it
        today would pass vacuously. Left to the phase that builds one.
      - **The guard is name-pattern based.** A second resolver exported under a
        name outside `ROUTER_NAMES` is undetectable by construction. Closing
        that needs symbol resolution and a module graph, which is a separate
        decision and not this step's.
      - **A specifier built by interpolation is not resolved.** Both limits are
        pinned by tests, so neither can be quietly read as coverage.
      - **The five round-5 limits above**, recorded in the module's frozen-claim
        block with their measurements.
      - **Withdrawing the guard entirely** remains a live OWNER decision. One
        council seat argued for it — enforce by review, automate nothing — on
        the ground that four rounds of escalating false-negative damage from
        ordinary valid syntax is evidence about the cost of the automation. That
        seat's own verdict classed withdrawal as owner-reserved, which is why it
        was not executed, and it is recorded here rather than dropped because
        the argument does not expire with the defects that prompted it.


## Phase 1 — Stop paying for information the tree already has

Deliberately before any sophisticated routing: the cheapest quality improvement
is not paying twice for the same deliberation.

### 1A — Re-council guard

- [x] 1A.1 Detect exact repeats on `council:run` by reusing the **existing**
  question hash — no second hash implementation.
      verify: a re-run of a retained question is detected; a one-token edit is
      not detected as exact
- [x] 1A.2 Warn, never prohibit: prior run date, prior artifact path, the fact
  that the question appears already deliberated, and a path to re-run after
  explicit confirmation.
      verify: confirmation still re-runs; no code path can turn the warning
      into an unconditional block
- [x] 1A.3 Near-duplicate detection on the already-imported similarity
  mechanism — no embedding infrastructure. Pre-register the threshold before
  tuning it on the retained local corpus.
      verify: the warning prints the similarity score, and the threshold in
      the code equals the pre-registered one
- [x] 1A.4 Distinguish three states in the warning: exact question + same
  relevant configuration; exact question + stale model/config evidence; near
  duplicate.
      verify: a fixture per state renders the matching state and no other
      <!-- Phase 1A executed 2026-08-30. `src/scripts/ai_council/recouncil_guard.ts`
      + 20 tests; wired into `cmd_run` BEFORE the `--confirm` gate, so the
      operator running an estimate is the one who learns the question is
      already deliberated, while there is nothing to un-spend.
      REUSE, as the steps require and in both places: the exact match is
      `_sha256_hex` from `blind_review.ts` (now exported rather than copied —
      two hashes of one question are two answers to "is this the same
      question"), and the near-duplicate pass is `jaccardSimilarity` from
      `_lib/text_similarity.ts`, which the council CLI already imported. The
      threshold is that module's `MERGE_THRESHOLD`, fixed by an AI-council
      verdict of 2026-07-05 — a number that could not have been tuned against
      the council-question corpus, which is the strongest pre-registration
      available.
      TWO DEFECTS FOUND BY PROBING THE LIVE CLI, NOT BY REVIEW, and both made a
      state unreachable in production rather than merely wrong:
      (1) the exact pass compared the BUILT PROMPT against the hash of the
      question FILE, so every true repeat reported as a near-duplicate at
      similarity 1.00 and `exact-*` could never fire; it now compares file to
      file, with the built prompt as the stdin fallback.
      (2) the config fingerprint used bare member names while the artefact
      writer records `name/model`, so the two never matched and every exact
      repeat reported `exact-stale-config` — two states that can never both
      occur are one state with extra words. All three states are now proven to
      fire against the real artefact store. -->

### 1B — Inline findings, analysis lens only

**AI council, 2026-08-30, anthropic + openai, 2 of 2 seats, deep depth, $0.00
(both seats subscription-authed). Two design forks put to it before any code
was written; both converged, and one of the convergent conditions turned out to
name a defect the implementation already had.**

*Fork 1 — does the consumed findings block stay in the response text that peer
review, chairman synthesis, and the rendered artefact read?* **Both seats:
strip it, retain the raw reply.** The reasoning was the same on both sides and
it is not about noise: the block restates selected conclusions, so leaving it in
amplifies a concise finding purely because it appears twice in the text a
reviewer scores. Both seats attached the same two conditions — the parsed span
and the removed span must be the SAME span (never an independent
"find and remove a JSON fence" regex, which could disagree with the parser about
what was consumed), and the raw reply must survive for audit. One seat made an
**observable marker** at the removal site a condition of its verdict; the other
reached the same concern from the auditability side, warning that if the
rendered artefact is contractually a byte-faithful transcript then not stripping
would be the safer answer. The marker is implemented, so both concerns are met
without deciding that contract question.

*Fork 2 — does the recorded parse-outcome vocabulary become a typed union now,
or a bare string first and a union after the gate?* **Both seats: type it now.**
The argument that decided it is measurement integrity rather than hygiene — the
1B.4 gate is computed off exactly these values, so an untyped
`Map<string, string>` leaves the number that decides the experiment exposed to a
misspelling no compiler would catch. One seat called the pre-existing bare
`'parsed-after-reask'` technical debt rather than a precedent worth extending;
the other priced the deferral and found doing it twice strictly more expensive
than doing it once. `RecordedExtractionOutcome` is the result.

**The council also caught an ordering defect in the implementation as it then
stood, and it is the finding worth carrying forward:** `_maybe_run_peer_review`
runs BEFORE `_maybe_run_consensus`, so parsing the block inside
`run_consensus_scoring` would have left the schema block in the very text peer
review and synthesis evaluate — the amplification Fork 1 exists to prevent,
reintroduced by where the code sat rather than by what it did. The harvest now
runs between the deliberation and every consumer, and a source-order test pins
it. That test's own limit is stated where it lives: it reads call-site order out
of `council_cli.ts` and cannot see a call moved into a helper.

*Divergence, recorded rather than silently resolved:* one seat asked that
`'parsed'` be renamed `'parsed-extraction'`. Declined here with a reason —
renaming a value that is already recorded and compared against is a separate
change with its own migration, and `'parsed'` is unambiguous now that
`'parsed-inline'` names the other source.

*Revisit-if:* a corpus scan finds the locator stripping a legitimate prose
block; deliberation prose measurably degrades under the contract; or the
rendered artefact acquires a documented byte-faithful-transcript contract, which
would reopen Fork 1 in favour of not stripping.


**The blocker gating this section is discharged by citation, which is what its
own `Resolved when` asked for.** `blocker: evidence-integrity-unparsed-dependency`
required the `unparsed`-versus-zero-findings distinction to be cited at
`file:line` or 1B scoped out. It shipped: `ai_council/consensus.ts:314`
`parse_findings_outcome` returns the three-way
`'parsed' | 'empty' | 'parse_failed'`, its docstring naming the exact confusion
the blocker feared; `ai_council/orchestrator.ts` records it per member in
`parse_outcomes`; and `ai_council/quorum_wiring.ts:256` folds the
`parse_failed` count into the rendered `present-unparsed` line. The archived
`road-to-council-evidence-integrity.md:178-197` is the delivering step. So the
promotion gate below has a real denominator to measure against — the condition
the blocker existed to protect.

- [ ] 1B.1 Require the existing findings schema as a fenced trailing block in
  the initial analysis response, replacing the second extraction call.
      verify: a real analysis run parses inline with no second call.
      **Stale-citation repaired 2026-08-31.** This line read *"blocked by
      `blocker: evidence-integrity-unparsed-dependency`"*, and that blocker is
      `Status: resolved` in § Blockers below — discharged by citation at the
      execution note further down this step. A resolved blocker cited as a live
      gate makes `gates --all` disagree with the step text, which is how a step
      stays open for a reason nobody can look up. The **live** gate is the one
      the execution note already states: a run in which EVERY answering seat
      carries the contract block. The 2026-08-31 run failed on the
      `codex-default` seat substituting prose, which is a model-compliance
      residual, not a tree defect.

      **BUILT AND WIRED 2026-08-30; the step stays OPEN because its verify asks
      for a live run and the day's call quota is spent.** The honest split
      matters here, so both halves are stated: the mechanism exists, is tested,
      and is default-off; the *evidence this step names* does not exist yet.

      Landed: `INLINE_FINDINGS_CONTRACT` (`ai_council/prompts.ts`) appended to
      the FINAL deliberation round via `ConsultOptions.inline_findings`, exactly
      the seam `STANCE_LINE_CONTRACT` already uses — off means the prompt is
      byte-identical. `ai_council/inline_findings.ts` holds the whole concern:
      the trailing-block locator, the `RecordedExtractionOutcome` union,
      `harvest_inline_findings`, the final-round suffix composer, the
      short-circuit helper and the config predicate.
      `run_consensus_scoring` consumes the harvested map and issues no
      extraction call for a member that has an entry.
      `consensus_scoring.inline_findings` (default `false`) is the switch, and
      `docs/contracts/ai-council-config.md` § Consensus scoring — inline
      findings documents it. 30 tests in
      `tests/scripts/ai_council/inline_findings.test.ts`, all green, with FIVE
      sensitivity arms — each mechanism neutralised in turn and the matching
      test observed red, then restored.

      **The source-size ratchet is what decided where the code lives, and it
      was paid rather than bumped.** The change first charged +153 lines across
      `orchestrator.ts`, `council_cli.ts` and `ai_council/config.ts` — all three
      far past the 1500-line ceiling, so every line counts. Concentrating the
      concern in its own module took that to +23; the residual was irreducible
      call sites. `run_consensus_scoring` — the function this change actually
      edits — then moved whole into `ai_council/consensus_round.ts`, with
      `orchestrator.ts` re-exporting the name so no importer changed. Net for
      the tree: **-174 lines**, and the baseline was lowered to the exact live
      total rather than left loose, because `check_source_size_budget.test.ts`
      asserts baseline equals tree total. The gate is the reason the new
      concern got its own module, which is the outcome that gate exists for.

      **A live run WAS made, and what it produced is a defect rather than the
      evidence.** One openai seat, analysis lens, `--rounds 1`, consensus and
      inline both on via a temporary `AI_COUNCIL_CONFIG`. The extraction call
      fired anyway. Cause:
      `_lib/council_settings_block.ts` synthesises the settings dict the CLI
      predicate actually reads, and it did not carry the new key — so a `true`
      in the YAML resolved to `undefined` and the feature was silently off with
      every unit test green. Fixed, and pinned by a test that walks the real
      chain (parse the file → synthesise → read the predicate) rather than
      stopping at any one link, because a test that stopped short is exactly
      what passed while the feature was dead.

      **What closes this step:** one analysis-lens run, post-fix, whose member
      reply carries the block and whose consensus round issues zero extraction
      calls. On 2026-08-30 it could not be made — both seats stood at the
      shipped `DEFAULT_CLI_CALLS_PER_DAY = 50`
      (`ai_council/cli_call_budget.ts:60`), and raising a cap to fit a
      measurement is the one thing a guard exists to prevent, so the step waited
      for the counter to roll rather than for the guard to move.

      **THE RUN WAS MADE ON 2026-08-31 AND IT DID NOT CLOSE THIS STEP.** Half
      the verify held and half did not, and the split is per seat rather than
      per mechanism. Two seats, analysis lens, `--rounds 1`, consensus and
      inline both on via a temporary `AI_COUNCIL_CONFIG`; peer review off,
      chairman `host`, advisors off, no stances. Four calls were predicted
      before spending — two per seat, one deliberation and one consensus
      scoring, zero extraction — and the per-provider counter moved
      **anthropic 24 → 26, openai 24 → 27**. The openai seat is the
      extra call, and it is the whole finding.

      **The anthropic seat is the mechanism working end to end, cited rather
      than asserted.** Its persisted `raw_text` — the field that exists for
      exactly this retention — ends in a fenced JSON array of five
      `{"id", "text"}` objects. Its `text` ends in
      `_[inline findings block extracted: 5 item(s); the raw reply is retained
      in the session record.]_`, which `harvest_inline_findings` writes only
      after `parse_findings_outcome` AND `_isOwnFindingsBlock` both pass, so the
      marker is a parse receipt and not a fence sighting. The five findings
      recorded under `anthropic:claude-sonnet-4-5` carry the same five ids in
      the same order — `semantic-drift-invisible`, `premature-convergence`,
      `strip-loses-emphasis`, `quality-compliance-tradeoff`,
      `tail-consistency-check-missing`. No extraction response exists for that
      seat and its counter delta is 2, so there is no third call anywhere that
      could have held one.

      **The openai seat emitted no block at all, so the repair path fired and
      the run's consensus round issued ONE extraction call.** Its reply closes
      with a prose `Top-5 consensus` section — the same five findings, as
      bullets — and carries no fenced block and no bracket array anywhere;
      `raw_text` is absent, which is the honest encoding of "nothing rewrote
      this reply". `consensus.extraction_responses` therefore holds exactly one
      entry, `provider=openai`, and that seat's counter delta is 3. This is
      1B.2's fallback behaving as specified — one call, no re-ask, over
      text nothing touched — but the closure condition above says ZERO
      extraction calls, and one is not zero.

      **So the step stays open on evidence rather than on quota, and the
      remaining unknown is now narrow.** Settled live, and not to be
      re-established: the config chain the 2026-08-30 defect broke resolves end
      to end (`inline_findings: true` survives file → synthesised block
      → predicate, and reads `false` for every non-analysis lens); the
      contract reaches the final round; the locator finds a real model's block;
      the strip and the marker fire; and the harvested findings reach the
      consensus round with no second call for that member. What is still
      missing is a run in which EVERY answering seat carries the block.

      **One observation is recorded for whoever runs 1B.4, AS AN OBSERVATION
      AND NOT AS A DATUM:** the miss was a contract-compliance miss by the
      `codex-default` seat, which substituted its own prose summary for the
      requested array — not a locator failure and not a parser failure. One
      run is not a rate, there is no matched comparator, and 1B.4's arms have
      not started, so this is a shape to expect and never a numerator.
- [x] 1B.2 Keep the repair path: absent or invalid inline block falls back to
  the existing extraction call at `prompts.ts:206`.
      verify: a corrupted inline block still yields findings, and the
      worst-case call count is no worse than today's

      **CLOSED 2026-08-30.** Both halves are asserted, and the second one is
      asserted by COMPARISON rather than by a remembered number: the
      worst-case test runs the identical scripted member through the harvest
      path and the shipped path and requires `on.calls === off.calls`, so the
      claim cannot drift as the extraction path changes. Four arms —
      no block at all, a mangled block, an unreadable reply reaching the one
      bounded re-ask, and the parity arm.

      **The structural reason the worst case cannot be worse:**
      `harvest_inline_findings` records ONLY a member whose block parsed, so an
      entry in the map is always a short-circuit and never a partial one. A
      member without an entry takes the shipped path over text nothing touched —
      pinned by its own test, because the council made "the repair call sees the
      RAW reply" a condition: stripping text we could not read would remove
      evidence from the very prompt that has to recover from it.
- [x] 1B.3 Scope to the analysis lens only — do not force structured tails
  into every lens without a named second consumer.
      verify: other lenses' prompts are byte-unchanged

      **CLOSED 2026-08-30.** Three conjuncts gate the contract
      (`inlineFindingsActive`): consensus scoring on, the run's lens inside
      `consensus_scoring.lenses` (default `[analysis]`), and the key on. Each is
      tested in isolation, plus the absent-key case, plus a no-block-at-all
      case — five arms, because "byte-unchanged" fails five different ways and a
      single happy-path assertion would catch none of them.

      The system-prompt arm iterates `all_modes()` rather than a literal lens
      list, so a lens added later is covered without anyone remembering to add
      it. That is deliberate: the failure this step guards against is a future
      edit folding the contract into `ANALYSIS_MODE`, which would leak it into
      every mode's lens table and be invisible to a hardcoded list.
- [ ] 1B.4 Promotion gate across ≥ 10 real analysis runs: ≥ 70 % inline parse
  rate, no `unparsed` regression, no substantive finding-quality regression.
      verify: gate met, or the null result is recorded and the change reverts
      to extraction-always

      **OPEN — the gate could not be RUN, which is not the same as a null and is
      not recorded as one.** A null is what a measurement returns; this is the
      measurement never happening. Both seats are at the shipped 50-call daily
      cap (see 1B.1), and ≥ 10 runs × 2 members needs roughly 40–60 calls.

      **Nothing is at risk from leaving it open, and that is the point of the
      default.** The verify's own second branch — "the change reverts to
      extraction-always" — describes the state that shipped:
      `consensus_scoring.inline_findings` defaults `false`, so the unmet gate
      and the shipped behaviour already agree. A default that shipped ahead of
      its own gate would have made the gate unfalsifiable, since the
      measurement would then be of the thing already promoted.

      **The denominator is pre-registered here, before any arm runs**, because
      the AI council (2026-08-30, 2 of 2 seats) found the obvious formula wrong
      in a way that would have inflated the result:

      > `inline_parse_rate = parsed-inline ÷ replies that received the contract`

      A member answering `[]` counts in the denominator AND as a success — an
      empty array from a readable reply is a RESULT, not a failure, and
      `parse_findings_outcome` already classifies it `parsed`
      (`consensus.ts:337`). Excluding it, which one draft proposed, would have
      measured contract compliance over the members most likely to comply.
      Report fallback recovery and the final unparsed rate as separate columns,
      never folded into this one.

      **Two amendments from the completion review of 2026-08-30, both narrowing
      what this rate may be read as saying.**

      First, the `[]` rationale is true of `parse_findings_outcome` and NOT of
      the inline path it is being applied to. A *bare* `[]` is unlocatable by
      `split_inline_findings` — `_BARE_ARRAY_SRC` requires at least one `{...}`
      object — so an unfenced empty answer produces `found: false` and counts as
      a MISS here, not a success. A fenced ```` ```json\n[]\n``` ```` does
      locate and does count. So the sentence above holds only for the fenced
      form, and the numerator must be read that way.

      Second, a **known residual** is pre-registered rather than discovered
      later: a member that quotes ANOTHER member's well-formed findings array as
      the last fenced block in its reply is indistinguishable by shape from one
      emitting its own, and would be counted a success with the findings
      attributed to the wrong member. `_isOwnFindingsBlock` rejects every
      malformed or partial array, which is the common shape of a quotation; what
      it cannot reject is a well-formed one. Shape cannot separate those and the
      reply carries no provenance. The arms therefore report this rate WITH the
      residual named, never as a clean compliance figure.

      **The `unparsed` comparator must be fixed before the arms run**, per the
      same seats: matched runs over the same artefacts, or a pre-declared
      baseline window. Comparing unrelated runs lets a change in task difficulty
      pass for a change in parse rate.

## Phase 2 — Build the benchmark before automating topology

The council should not ship a topology selector before it can define "better".

- [x] 2.1 Pre-register benchmark families: architecture trade-offs, roadmap
  critique, ADR reopening, requirements completeness, code review with seeded
  defects, security review with seeded true/false findings, debugging with an
  executable oracle, incident diagnosis, probe-resolvable factual controls,
  direct-generation controls where debate is expected to **hurt**, adversarial
  misconception cases, ambiguous product decisions with a human rubric.
      verify: the family list and per-family success criteria are committed
      before any arm runs
      **DONE 2026-08-31 — committed, and the ordering is the evidence.**
      [`internal/bench/council-topology/PREREG-families.md`](../../internal/bench/council-topology/PREREG-families.md)
      registers **all twelve** families with a per-family success criterion and
      one of the three labels the resolved `blocker: maintainer-blind-ratings`
      fixed: `gradeable-confirmatory` (6), `model-graded-exploratory` (5),
      `human-rubric-deferred` (1). The three are never pooled, and no
      model-graded substitute is run in place of the deferred family — that
      substitution is what the blocker's originating rationale forbids.
      **Every family is a quotation, none is derived.** This step enumerates
      exactly twelve in its own prose; the pre-registration quotes each phrase
      in the listed order and adjusted the count for nothing.
      **The list is committed BEFORE any arm runs, which is checkable rather
      than asserted:** the runner does not exist, both seats of the
      2026-08-31 council declined to greenlight it, and all 352 eligible cells
      of the manifest read `pending`. The machine-readable twin is
      `BENCH_FAMILIES` in `src/scripts/ai_council/topology_bench_manifest.ts`,
      guarded at arity 12 in the type layer and at module load — sabotage-
      verified: arity 11 gave `error TS2367` (`npm run typecheck` exit 2) and
      `expected exactly 11 pre-registered families, found 12` (vitest exit 1).
      Shrinking the set weakens this criterion and is owner-reserved.
      Deliberately narrow: this step buys the eligible **families**, not the
      metric set (2.3) and not the reporting bar (2.6, already pre-registered).

      **What landed beside it, and what it found.** The same council answered
      Q2 **(iii)**: Phase 2 was not executable as written, because the roadmap
      defined experimental *dimensions* and never the **provider-call graph** —
      an experimental cell is not a provider call, and `50/provider/UTC-day` is
      two ceilings, not one pool of 100. That artefact now exists:
      [`internal/bench/council-topology/README.md`](../../internal/bench/council-topology/README.md)
      is the new carrier (council Q1 = (a), 2/2), and `call-manifest.json` is
      the frozen 384-cell manifest, each row carrying expected and maximum
      calls **by provider**, its reuse source, and a completion status. Overlap
      is stated rather than implied: exactly two arms reuse
      `baseline-default-council`; everything else re-runs, and the ablation
      ladder deliberately does not borrow a baseline's generation output,
      because a rung borrowed across a UTC day carries day-as-confounder into
      the one arm whose purpose is attribution.
      **The number the phase was missing: minimum 1,584 calls (anthropic 814 /
      openai 770), worst case 1,804 (924 / 880), across 20 UTC days** at one
      item per family and N=2. That consumes both providers' entire daily quota
      for roughly twenty consecutive days, during which no other council work
      can proceed. **This is reported, not acted on** — cutting families,
      deleting ablation, or calling unexecuted arms nulls would weaken 2.1 and
      2.4, and both seats refused to approve any of them as council-decidable.
      **`pending` cannot become a null.** `PHASE2_COMPLETE_STATUSES` admits
      only `success`, `declared_gap` and an observed null, enforced in both
      layers — sabotage-verified: adding `'pending'` gave
      `topology_bench_manifest.ts(100,36): error TS2344` (typecheck exit 2) and
      a module-load throw that stopped the test file collecting.
      **A consequence worth stating: at N=2 this benchmark licenses no
      promotion claim at all.** 2.6's own pre-registered floors are n >= 5 and
      n >= 10, and N=2 clears neither, so the manifested Phase 2 produces
      descriptive comparison only. That is 2.6 read honestly, not weakened.
      **Steps 2.2-2.5 and 2.7 stay open.** The manifest is a precondition for
      them, never their execution: no arm ran and no quota was spent.
      **Carried into § Blockers 2026-08-31 as `blocker: phase-2-benchmark-cost`.**
      This note is no longer the only place the condition lives. It gated 23 of
      this file's 46 open steps from a step-prose closing note — more than every
      recorded blocker combined — and appeared in no gate. The entry does not
      change the condition; it makes `gates --all` able to read it.
- [ ] 2.2 Mandatory baselines per eligible slice: host solo, strongest
  configured single external model, cheapest configured single external model,
  current default council path, full debate where applicable.
      verify: no result claims "council improves quality" without a strong
      single-model baseline in the same table
- [ ] 2.3 Emit the full metric set: deterministic correctness where possible,
  executable test result where possible, rubric quality, cost, latency, calls,
  tokens, parse/gradeability rate, rerun variance, disagreement entropy,
  minority rescue, majority corruption, synthesis delta,
  zero-marginal-value-call rate.
      verify: one run produces every column, or the missing column is recorded
      as a declared gap rather than silently absent
- [ ] 2.4 Stage ablation: generation only; + ranking; + peer critique;
  + synthesis; full pipeline.
      verify: an improvement can be attributed to a named stage
- [ ] 2.5 Separate model quality from topology quality — same topology across
  model sets, and same model set across topologies.
      verify: both axes appear in the result table
- [x] 2.6 No promotion from N=1: confidence intervals or explicit variance
  bands.
      verify: every promotion claim carries a trial count and a band
      **DONE 2026-08-31 — pre-registered, and the ordering is the evidence.**
      [`internal/bench/council-topology-promotion-stats-PREREG.md`](../../internal/bench/council-topology-promotion-stats-PREREG.md)
      fixes the two mandatory fields every promotion claim renders **in the
      claim itself** — `n` per arm (with the drop asymmetry when trials error
      out) and a 95 % CI, or an explicit min/median/max variance band where the
      metric supports no CI. A row missing either is not a weakened promotion,
      it is an **observation**.
      Written before any arm exists and before step 2.1's family list is
      committed, so the floors cannot have been fitted to a result — that
      ordering is checkable in the git history rather than asserted.
      Deliberately narrow: this step buys the **reporting bar**, not the metric
      set (2.3) and not the eligible families (2.1). Trial-count floors are
      stated defaults with their own `revisit-if`, and are admissibility only —
      clearing a floor with a band spanning zero is a null, and publishing it as
      one is the correct outcome.
- [ ] 2.7 Round-count bias arm: rounds 1 vs 2, verdict flips, dissent
  retention, correctness where gradeable, confidence-vs-correctness, cost
  delta. Grounded in **arXiv 2505.19477** (round-1 debate bias amplification) —
  the citation the source draft omitted.
      verify: the arm reports a result **or** a null; a null is a valid
      published outcome and closes the step

## Phase 3 — Independence and judge-bias hardening

- [x] 3.1 Property-test reviewer-specific shuffling for N=2..8: deterministic
  replay per seed, reviewer-specific ordering, config order not inferable from
  candidate position.
      verify: the property test fails when the shuffle is replaced by identity
      **DONE 2026-08-30. The shuffle was already shipped; the RANGE was
      missing.** `deterministic_shuffle_indices`
      (`src/scripts/ai_council/blind_review.ts:52-56`), applied per run at
      `orchestrator.ts:1533-1546`. Existing coverage sat at N=3
      (`orchestrator.test.ts:871`) and N=4 (`:917`);
      `tests/scripts/ai_council/peer_review_independence.test.ts` now covers
      every N in 2..8.
      **Only ONE of the three properties can carry the verify clause, and the
      test file says which.** Deterministic replay and per-reviewer mapping
      distinctness both SURVIVE an identity shuffle — distinctness because
      self-filtering alone already gives each reviewer a different *subset*. The
      assertion that actually fails under identity is *config order not
      inferable from position*, measured as the set of permutations observed
      across 16 seeds. Neutralising the shuffle to identity reds it for N=3..8.
      **N=2 is excluded from that one assertion**, and only that one: with a
      single reviewed answer there is one possible ordering, so no shuffle is
      distinguishable from identity there. The exclusion carries its own test so
      nobody widens it later.
      **A recorded lock was surfaced rather than overridden.** This step says
      *"reviewer-specific ordering"*; the shipped seed is **run**-scoped, and
      `orchestrator.ts:1533-1543` records that as deliberate — *"The reviewer is
      deliberately NOT in the seed: one shuffle per run, so a reader comparing
      two reviewers' critiques of the same member is comparing the same label."*
      The property that genuinely holds (per-reviewer maps ARE distinct, via
      self-filtering) is what got pinned. Re-seeding per reviewer would trade a
      real property — cross-reviewer comparability — for a nominal one, and is a
      `decision-revisit-gate` matter rather than a test-writing one.
- [x] 3.2 Keep self-review structurally impossible — the reviewer payload
  construction excludes the reviewer's own authored answer; no prompt
  instruction is the only protection.
      verify: a test asserts the payload, not the prompt text
      **DONE 2026-08-30. The guard was shipped; the test was reading the wrong
      layer.** The filter is `src !== scorer` at `orchestrator.ts:1518-1522`.
      The existing test (`orchestrator.test.ts:908-913`) asserted the derived
      `label_to_source_by_reviewer` map — one layer away from what actually
      reaches a model, which is exactly the distinction this step's verify
      clause draws.
      The new tests read the `user_prompt` handed to `ask()`, for every N in
      2..8. **One of them strips the prompt's own *"You may NOT see your own
      response"* sentence from the captured payload and re-asserts** — which is
      this step's whole point made executable: if removing the instruction
      changes nothing, the instruction was not the protection. Neutralising
      `src !== scorer` reds 22 tests.
- [ ] 3.3 Provider-recognition leakage bench: ask reviewers and judges to guess
  the provider family from anonymized answers; measure recognition against
  chance. **Measurement first** — not a justification for rewriting anything.
      verify: recognition rate and chance baseline are both published
      **HARNESS BUILT 2026-08-30, MEASUREMENT NOT RUN — and "not run" is
      deliberately not "a null".** A null is what a measurement returns; nothing
      was measured here. `src/scripts/ai_council/provider_leakage_bench.ts`
      carries the prompt builder, the collection loop, the scoring and an exact
      binomial tail; `internal/bench/council-provider-leakage/README.md` carries
      the pre-registration and the NOT-RUN status; `smoke-items.json` is
      synthetic, self-declaring, and unusable for measurement.
      **Blocked by two things, and quota is only the first.** (a) The bench
      needs one paid council call per item per rater, and the daily CLI cap was
      exhausted on this run — anthropic 50/50, openai 51/50 — which resets at
      UTC midnight. (b) It needs a corpus of ≥ 30 real anonymised response
      bodies, and `agents/runtime/council/` is gitignored and auto-pruned, so
      that corpus cannot be committed and must be assembled locally at
      measurement time. **(b) survives the quota reset**, so this step does not
      unblock at midnight.
      **One design point worth carrying, because it is the difference between a
      measurement and a number:** `scoreRecognition` publishes **both** chance
      baselines and tests against the stricter. On a corpus where half the items
      share a provider, a constant guesser scores 50 % against a uniform chance
      of 25 % and would read as leakage while recognising nothing. A test pins
      that case.
- [ ] 3.4 Hold style normalization behind the stronger gate: implement only if
  this tree's own leakage bench shows materially above-chance recognition
  **and** that recognition correlates with judgment distortion.
      verify: no normalization code lands until both conditions are recorded
      met; if it lands, the raw answer is retained for synthesis and replay and
      semantic preservation is proven
      **NOT CLOSABLE, and as of 2026-08-30 the block is MECHANICAL rather than
      a matter of discipline.** No normalization code landed, which is the
      verify clause's first half satisfied by inaction. What changed is that the
      gate can now refuse: `normalizationGateVerdict` returns `'unrun'` on empty
      data and specifically **not** `'below-bar'` — the latter would claim that
      recognition had been measured and found harmless, which is the exact
      false-null this step exists to prevent. It also returns `unrun` for
      above-chance recognition when the distortion arm is unrun. Only both
      conditions recorded met reaches `bar-cleared`.
      Neutralising the no-data branch from `'unrun'` to `'below-bar'` reds two
      tests. This step stays open behind 3.3.
- [x] 3.5 Order-swap consistency: repeat sampled pairwise judgments with
  candidate order reversed; emit a per-judge position-consistency metric.
      verify: the metric exists per judge and is reported with the verdict
      **DONE 2026-08-30, with a scope limit stated rather than glossed.**
      `src/scripts/ai_council/judge_position_bias.ts`. The order swap itself
      already existed — `check_quality_regression.evaluatePair` (`:84-108`) —
      but it is **single-judge** (`:216`, one run-wide rate) and reports the
      PRESENCE of inconsistency, not its DIRECTION. Those are different
      measurements, and the test that proves it is the useful one: scripted
      primacy and recency judges produce *identical* consistency scores and
      *opposite* `first_position_rate`. A metric that cannot separate that pair
      is not measuring position bias.
      **What is NOT claimed:** the metric is not emitted beside a live council
      verdict, because the council has no pairwise judging stage —
      `grep -rn pairwise src/scripts/ai_council` returns nothing. The renderer
      exists and is exercised by the leakage bench; live emission arrives with
      whatever pairwise stage a later phase adds. The verify clause's *"reported
      with the verdict"* is therefore satisfied for the surface that exists and
      has nowhere else to attach yet.
      Neutralising `first_position_rate` to a constant 0.5 reds two tests.
- [x] 3.6 Fence peer content as untrusted data with structured boundaries or
  nonce fencing, per
  [`untrusted-input-defense`](../../src/rules/untrusted-input-defense.md).
      verify: injection fixtures cannot alter the ranking schema or the system
      contract
      **DONE 2026-08-30, and the defect it closes was real rather than
      theoretical.** `build_peer_review_user_prompt` rendered peer bodies as
      bare Markdown, so a peer response containing `### Refinement` — a
      reviewer-output heading — or `### Response-Z` — a candidate that does not
      exist — was **byte-identical to the real thing** in the assembled prompt.
      Bodies are now fenced by `wrapUntrustedBlocks`, with the labels **outside**
      the fences: the defence is position, not wording, which is what makes it
      survive a body that contains the label text.
      **Nothing is stripped**, deliberately — sanitising untrusted input
      destroys the evidence of what was attempted, and
      `untrusted-input-defense`'s discipline is to treat it as data, not to
      erase it.
      `wrapUntrustedBlocks` was added to the canonical
      `src/scripts/_lib/untrusted_content.ts` rather than written locally, so
      there is no second delimiter implementation to drift.
      Reverting the fencing to the plain-heading render reds five tests.

## Phase 4 — Parallel fan-out reopens a closed decision

**This phase does not add missing work — it re-opens a decision that was made
deliberately and recorded.** `orchestrator.ts:8-12` states the v2 contract:
members are called sequentially in input order, and *"the previous parallel
ThreadPoolExecutor was traded for predictable mid-flow user prompts"*. There
are **0** `Promise.all` occurrences in that file and the dispatch order is
byte-pinned by tests. Any work here runs through
[`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md).

- [x] 4.1 Run the revisit gate before writing code: state the recorded
  decision, the condition it encoded (interactive mid-flow overrun prompts at
  2-3 members), and what has changed since. Route per that rule.
      verify: the revisit record exists with a verdict and a `revisit-if`
      line; a verdict of "keep sequential" closes Phase 4 as a null and is a
      legitimate outcome
      **DONE 2026-08-31 — verdict: keep sequential. Phase 4 closes as a
      published null.** Record:
      [`agents/evidence/analysis/parallel-fanout-revisit-2026-08-31.md`](../evidence/analysis/parallel-fanout-revisit-2026-08-31.md).
      It is a **transcription** of a verdict already reached, not a fresh
      decision: `blocker: parallel-fanout-reopens-a-closed-decision` below
      carries `Status: resolved` with resolution (a), AI council 2026-08-28,
      **2/2**. What was missing was a record the next session can read without
      re-deriving it from a blocker body.
      The record states the decision (`orchestrator.ts:8-12`), the condition it
      encoded (interactive mid-flow `on_overrun` prompts at 2-3 members), what
      changed (**materially nothing** — `agents/templates/.ai-council.yml.example:39`
      still ships **two** members `enabled: true`, `on_overrun` is still wired
      at `orchestrator.ts:691-711`, and no latency complaint exists anywhere in
      the tree), the routing (council-decidable, not owner-reserved — the
      transition weakens no floor and is reversible inside `orchestrator.ts`),
      the verdict, and a `revisit-if`.
      **Revisit-if** (also carried in the record): a real recorded latency
      complaint against a council run, **or** the typical enabled-member count
      in the shipped example rising above 3. A topology experiment's
      convenience is not new evidence — the mechanism under test is the same one
      the original decision tested.
- [-] 4.2 Answer the interactive-overrun question the reversal bought: how a
  parallel round presents a mid-flow spend prompt without losing
  predictability.
      verify: a written mechanism, or the phase stops here
      **NULL-CLOSED by 4.1 — the revisit verdict is "keep sequential", so this
      step's precondition never arises.** The step's own verify line names the
      alternative outcome ("or the phase stops here"), and that is the branch
      taken. Not a dropped item: `blocker:
      parallel-fanout-reopens-a-closed-decision` (`Blocks: all of Phase 4`) was
      resolved by the maintainer-owned council decision of 2026-08-28 (2/2) to
      close Phase 4 as a published null; this cancellation executes that
      recorded resolution rather than making a new one.
- [x] 4.3 Preserve the sequential default — plain confirmation keeps today's
  semantics exactly.
      verify: the byte-pinned dispatch-order tests stay green **unmodified**;
      needing to edit them is the signal to stop, not to update them
      **DONE 2026-08-31, verification-only — nothing was changed, which is the
      point of the step.** Three readings, all on this branch against
      `origin/main` @ `60ad56b7c`:
      (1) `npx vitest run tests/scripts/ai_council/orchestrator.test.ts` →
      **83 passed / 83**, including
      `orchestrator.test.ts:125-136` (`dispatches members in input order,
      accumulates tokens`), which is the byte-pinned dispatch-order assertion;
      (2) `git diff origin/main -- tests/scripts/ai_council/orchestrator.test.ts`
      → **0 lines**, so the tests are green **unmodified**, not green because
      they were edited into agreement. Scoped to that file deliberately: the
      branch DOES add one test file under `tests/`
      (`deterministic_fallback.test.ts`, step 11.4), so a tree-wide
      `--stat -- tests/` is no longer empty and quoting it would be a stale
      claim rather than a stronger one;
      (3) `grep -c 'Promise.all' src/scripts/ai_council/orchestrator.ts` → `0`,
      so no parallel dispatch primitive was introduced.
      The step's stop signal ("needing to edit them is the signal to stop") was
      never reached, because 4.1's verdict means no parallel work was attempted.
- [-] 4.4 Present the worst-case ceiling for all parallel member calls
  (including output-token ceiling and buffer rules) and require
  `--confirm-ceiling`; plain `--confirm` is insufficient.
      verify: a parallel run without the ceiling flag refuses
      **NULL-CLOSED by 4.1 — the revisit verdict is "keep sequential", so this
      step's precondition never arises.** There is no parallel run for a
      ceiling flag to gate; the verify criterion is unreachable by construction.
      Executes the recorded resolution of `blocker:
      parallel-fanout-reopens-a-closed-decision` (`Blocks: all of Phase 4`), not
      a new decision. The shape to re-enter from, if the decision is ever
      reopened, is recorded in 4.1's revisit record § 5: intra-round parallelism
      **behind** exactly this ceiling flag.
- [-] 4.5 Parallelize only **within** a round; rounds stay sequential because
  round N+1 depends on N. One member failure normalizes to an error-valued
  response, never a thrown whole-run failure.
      verify: a seeded member failure yields a rendered error response and the
      run completes
      **NULL-CLOSED by 4.1 — the revisit verdict is "keep sequential", so this
      step's precondition never arises.** Executes the recorded resolution of
      `blocker: parallel-fanout-reopens-a-closed-decision` (`Blocks: all of
      Phase 4`), not a new decision.
      Worth recording rather than glossing: the step's **second** half is
      already shipped independently of any parallelism —
      `orchestrator.test.ts:138` (`member exception → error-tagged response,
      never raises`) pins exactly that normalization on the sequential path. So
      what is cancelled here is the parallelism clause, not the failure-handling
      property, which is live.
- [-] 4.6 Topology integration rule: a parallel topology may be selected only
  when its spend authorization precondition is already satisfied, and may
  never silently upgrade `--confirm` into ceiling authorization.
      verify: a test asserts the upgrade is impossible
      **NULL-CLOSED by 4.1 — the revisit verdict is "keep sequential", so this
      step's precondition never arises.** There is no parallel topology to
      integrate, so there is no `--confirm` → ceiling upgrade path to forbid.
      Executes the recorded resolution of `blocker:
      parallel-fanout-reopens-a-closed-decision` (`Blocks: all of Phase 4`), not
      a new decision. The prohibition itself is not lost: step **12.3** already
      carries the general form ("a force-topology debug control ... cannot
      override ... spend authorization"), and it stays open.

## Phase 5 — Synthesis-policy showdown

- [ ] 5.1 One synthesis-strategy interface behind the candidates (host
  convener, dedicated external judge, strongest configured model, top-ranked
  member, dual synthesis + adjudication) — no user-facing mode proliferation.
      verify: the user-facing surface gains no new mode names
- [ ] 5.2 Bench identity-blind against identity-visible synthesis explicitly,
  so vendor prestige cannot leak in accidentally.
      verify: both arms are reported side by side
- [ ] 5.3 Majority-laundering test: seed one correct minority against several
  plausible-but-wrong majority answers; the synthesizer must justify accepting
  or rejecting the minority.
      verify: the fixture is permanent, and a synthesizer that silently drops
      the minority fails it
- [ ] 5.4 Final synthesis retains unresolved disagreement, the strongest
  minority evidence, and what evidence would resolve it.
      verify: a run with real dissent renders all three
- [ ] 5.5 Revisit ADR-120 **only** on results — record keep / amend /
  supersede with the benchmark artifact pin and a revisit condition.
      verify: the ADR record cites the benchmark artifact, not this roadmap

## Phase 6 — Adaptive depth with anti-conformity before the meter

Convergence is either genuine stability or conformity collapse. The ordering is
the whole point: **the conformity defence gets its chance before the meter is
allowed to stop.**

- [x] 6.1 Compute a zero-cost structural disagreement signal from
  already-paid outputs: stance divergence, finding overlap, contradiction
  count, confidence spread, rank uncertainty, novelty / self-similarity.
      verify: no extra model call is issued; call count is unchanged

      **CLOSED 2026-08-31.** `src/scripts/ai_council/disagreement_signal.ts` —
      `computeDisagreementSignal(x: DisagreementInputs): DisagreementSignal`,
      pure, importing only `_lib/text_similarity.js` and two type-only imports.
      No client, no `node:fs`, no `fetch`, no subprocess.

      **All six components are carried, and a missing one is a DECLARED GAP, never
      a zero.** Each is
      `{available: true, value, basis} | {available: false, reason}`, where
      `basis` is the observation count — so a `0` over 40 pairs is
      distinguishable from a `0` over one. stanceDivergence
      (`1 − topWeight/backedWeight`) · findingOverlap (mean symmetric matched
      share per source pair) · contradictionCount (Σ `dissent_count` over
      **scored** findings) · confidenceSpread (normalised range of backer
      `CONFIDENCE_FACTOR`) · rankUncertainty (share of adjacent tied
      `consensus_strength` pairs) · selfSimilarity (mean
      `jaccardSimilarity(prior, current)`).

      **Two gaps exist precisely because the naive version fabricates a
      confident zero.** `aggregate_scores` writes an entry for EVERY finding
      including unscored ones with `dissent_count: 0`, so summing the map
      wholesale reports *"0 contradictions"* for a round where no scoring
      happened; the same inversion hits rankUncertainty, where unscored findings
      all sit at strength 0 and read as a near-total tie. Both restrict to
      scored entries. This is the § Prevented items shape, caught at authoring
      time.

      **No composite score, deliberately.** findingOverlap and selfSimilarity
      rise with AGREEMENT; the other four with disagreement. Summing them adds
      opposing axes, and weighting needs numbers no measurement in this tree
      supplies. 8.4 wants *"deterministic and inspectable"* and 10.3 wants to
      know WHICH of finding/stance/confidence moved — both want components, and
      both consume this module rather than re-deriving it.

      **`FINDING_MATCH_THRESHOLD = MERGE_THRESHOLD`, reused not chosen** — the
      same pre-registration argument `recouncil_guard.ts:50` makes. It is strict
      for prose, so overlap UNDER-estimates agreement and therefore
      OVER-estimates disagreement: the fail-safe direction for a phase whose
      failure mode is stopping too early. `revisit-if` recorded in the module.

      **Declared limitation, stated rather than implied:** confidenceSpread sees
      only BACKERS — `tally_stances` counts an abstention and discards its
      confidence, and recovering it would need a second parse of the stance
      lines, forking the one verdict this module refuses to duplicate.

      **verify, discharged on two independent observables.**
      `tests/scripts/ai_council/disagreement_signal.test.ts`, **31 tests**,
      every expected value DERIVED from the fixture rather than from output. Call
      count is asserted against a `Booking extends ExternalAIClient` stub AND the
      real `record_cli_call` counter under a temp path; the baseline is asserted
      non-vacuous first (`[1,1]` asks, `{a:1,b:1}` counts), the signal is
      computed five times, and both observables are asserted unchanged. An
      in-suite **SABOTAGE arm** implements the plausible wrong version — rank
      uncertainty is high, so ask a member to break the tie — and asserts both
      observables DO move, which is what makes the invariance assertion mean
      something. A separate import-surface scanner rejects any
      `clients`/`orchestrator`/`node:*`/`fetch(`/`spawn|exec` reference, with
      `recouncil_guard.ts` as a non-vacuity CONTROL that it must flag.

      **Sensitivity: 9 mutations, each seen RED and each restored** — every
      component forced constant, the fabricated-zero variant, the dropped
      two-observation floor, the tie test inverted, the empty-text guard removed,
      a booked call inside compute (caught by the import scanner), and
      `gap()` carrying `value: 0` (7 failed / 24 passed).
      **Re-verified independently at review time, not taken on report:** the
      `gap()`-carries-zero sabotage was re-run on this branch and reproduced
      **7 failed / 24 passed**, restoring to **31/31**.

      Fresh: `npx vitest run tests/scripts/ai_council/disagreement_signal.test.ts`
      → 31 passed (31). `npm run typecheck` → exit 0.
      `npx vitest run tests/scripts/ai_council tests/scripts/argument_exhaustion.test.ts`
      → 1291 passed (1291) across 56 files.
- [x] 6.2 Argument-exhaustion stop requires **all** of: ≥ 2 rounds completed;
  dissent repair already attempted; every present member self-near-duplicate
  versus the prior round under the existing novelty logic; no unresolved
  adversarial trigger.
      verify: **`evaluateStop` in `src/scripts/ai_council/argument_exhaustion.ts`,
      15 tests.** All four conditions asserted individually via a table-driven
      case — each one alone blocks a fixture that would otherwise stop — plus a
      fifth the step did not name (`no-members-present`, because `every()` over
      an empty array is vacuously true and would have made an empty council the
      easiest one to stop).

      The verdict reports **every** failing condition rather than the first: a
      caller acting on one reason at a time would re-evaluate N times to learn N
      blockers.

      Unblocked by `early-stop-vs-dissent-ordering`, resolved the same day with
      the red-then-green sensitivity proof that blocker required.
- [x] 6.3 Majority size alone can never trigger a stop.
      verify: majority size is **not an input to the predicate at all**, which is
      stronger than not triggering on it, and two tests pin the absence — a
      unanimous-but-unrepaired run does not stop, and a twenty-member unanimous
      run is no easier to stop than a two-member one.
- [x] 6.4 A stopped run renders: stopped early, round N of M, reason, saved
  calls and cost, which members and arguments were judged exhausted — never as
  if all configured rounds executed.
      verify: `renderStop` emits `STOPPED EARLY`, `round 3 of 5`, the reason, the
      saved calls and cost, the named exhausted members, and the explicit line
      **`NOT a full run: the remaining configured rounds did not execute.`**
      Four assertions pin those separately.

      The last line is the load-bearing one: the failure here is quiet, and an
      artifact that reads as though all configured rounds executed is a claim
      about deliberation depth that nobody made on purpose.
- [ ] 6.5 Pre-registered promotion gate against a fixed-round arm: quality
  non-inferiority on gradeable slices, no meaningful minority-rescue
  regression, measurable call/cost reduction, no increased
  majority-corruption rate. Verdict equivalence alone is **insufficient** —
  two wrong verdicts can be equivalent.
      verify: the gate is recorded before the arms run, and the
      verdict-equivalence figure is reported as context, never as the gate

## Phase 7 — Council-rung topology refinement

Only now, and **not** as a new task router.

- [x] 7.1 Close the internal topology vocabulary at `single_external`,
  `dual_independent`, `advisor_diversity`, `peer_review`, `judge_synthesis`,
  `targeted_cross_exam`, `full_debate`. `team` and `user_required` are excluded
  by construction — the ladder and the Hard Floor own them.
      verify: the type admits no eighth member without a schema change, and
      `team` / `user_required` are not representable
      **DONE 2026-08-31 — closed in two independent layers, both sabotage-proven.**
      The vocabulary is `src/scripts/ai_council/topology_vocabulary.ts:74-82`, a
      frozen `as const` tuple of exactly the seven diagram names (`:62-68` of
      this file, copied verbatim), with the closed union `CouncilTopology` at
      `:85` and the declared arity at `:88`.
      **Claim 1 — no eighth member.** `VocabularyIsClosed` (`:119-125`) asserts
      the tuple's literal `length` against `COUNCIL_TOPOLOGY_ARITY`, so an
      append reds `npm run typecheck`, which is a CI gate. The runtime twin is
      `auditCouncilTopologyVocabulary` (`:140-167`) plus the module-load throw
      at `:172-175`, which carries the same claim into `dist/`, where the types
      are erased. Sabotage-verified: appending `'eighth_topology'` produced
      `topology_vocabulary.ts(121,12): error TS2344: Type 'false' does not
      satisfy the constraint 'true'.` (typecheck exit 2) and
      `Error: council topology vocabulary is not closed: arity: expected
      exactly 7 topologies, found 8.` (vitest exit 1). Removing it returned
      both to exit 0.
      **Claim 2 — `team` / `user_required` are not REPRESENTABLE, not merely
      absent.** Omitting two strings is the weak form. The type layer instead
      imports `LadderVerdict` (`src/scripts/_lib/judgment_ladder.ts:42-52`,
      where `team` is rung 3) and `ImpactClass`
      (`src/scripts/ai_council/necessity.ts:545-550`, where `user_required` is
      locked to `user` routing at `:557-560`) as **types only**, and asserts
      that no member of either vocabulary is a `CouncilTopology`. That also
      excludes `script`, `subagent`, `council`, `ask`, `in-session` and the
      other impact classes. A fourth assertion pins the two reserved literals
      to those foreign unions, so an upstream rename reds this file instead of
      orphaning the exclusion into a dead string. Sabotage-verified:
      substituting `'team'` for `'full_debate'` (arity still 7, so assertion 1
      stayed green) reddened assertions 2 and 5 —
      `topology_vocabulary.ts(121,12)` and `(124,12): error TS2344: Type
      'false' does not satisfy the constraint 'true'.` — and the runtime guard
      threw ``reserved: `team` is owned by another layer``.
      **The one-resolver invariant is intact, measured either side.**
      `tests/scripts/one_resolver_invariant.test.ts` is 80/80 before and after.
      The module cannot read as a second resolver on two grounds: it lives
      under `ai_council/`, which `one_resolver_invariant.ts` skips as
      `COUNCIL_INTERNAL_DIR`, and none of its exported names matches
      `ROUTER_NAMES` (`one_resolver_invariant.ts:122-126`). It classifies
      nothing — it is a name set and two predicates; the selector that consumes
      it is 7.2 and is deliberately not built here.
      **Not a JSON schema, and not the config contract — one line each, per the
      step's own question.** `src/scripts/schemas/` carries no council schema
      at all (`.ai-council.yml` is validated by the hand-rolled loader in
      `ai_council/config.ts`), so there is no enum surface to extend; and
      `docs/contracts/ai-council-config.md` documents what a USER may
      configure, while step 12.4 requires consumer surfaces to name
      capabilities and never topology names, so documenting it there would
      invite the coupling 12.4 forbids.
      **What is NOT claimed.** The compile-time layer is enforced by the
      typecheck gate, not by a test that runs `tsc`;
      `tests/scripts/ai_council/topology_vocabulary.test.ts` (20 tests) pins
      the runtime layer and asserts the five type assertions are still present,
      so deleting them is caught, but a vitest run never type-checks.
- [ ] 7.2 The selector returns an explainable record: topology, council task
  class, impact class, reason codes, estimated calls, estimated cost, latency
  band, evidence/policy source, fallback.
      verify: every field is populated on a real selection
- [ ] 7.3 Keep the deterministic/probe path **above** council: a mechanism
  question resolvable by tree fact, schema, script or executable test never
  reaches topology selection.
      verify: a probe-resolvable fixture never enters the selector
- [ ] 7.4 Deterministic policy first, interpretable features only: task class,
  impact, ambiguity type, configured provider diversity, model availability,
  historical benchmark slice, artifact size, cost ceiling, prior-run freshness,
  initial disagreement.
      verify: the policy is readable end-to-end without executing it
- [ ] 7.5 Shadow mode first: compute the proposed topology, execute current
  behaviour, record the counterfactual route.
      verify: shadow runs change no observable behaviour
- [ ] 7.6 Promote per task slice on benchmark evidence only — no global claim
  that debate is better.
      verify: each promotion names its slice and its evidence artifact

## Phase 8 — Targeted cross-examination and scalable review

- [ ] 8.1 Select a disputed finding, a conflicting pair, or a correct-looking
  minority claim, and ask focused rebuttal questions.
      verify: the cross-exam prompt names the exact disputed claim
- [ ] 8.2 Reviewer budget `k`: balanced assignment approaching O(N×k) rather
  than unconditional O(N²) for larger councils.
      verify: call count at N=8 is measured against both curves
- [ ] 8.3 Preserve provider diversity in reviewer assignment where
  alternatives exist.
      verify: no candidate is reviewed only by same-family reviewers when a
      cross-family reviewer was available
- [ ] 8.4 Score optional next calls by expected information gain per cost,
  deterministic and inspectable to start.
      verify: the score is reproducible from the recorded inputs
- [ ] 8.5 Stop when the next call has low expected value — call-level
  extension of argument exhaustion, only after benchmark evidence exists.
      verify: the stop is gated on the Phase 2 artifact, not on intuition

## Phase 9 — Advisor composition after seating

The five personas exist and are shipped (see § Prevented items). The real gap
is **seating**, and it already has a carrier.

- [ ] 9.1 Add the same-provider host-subagent fan-out lane **only** as a
  benchmark arm inside the existing stub
  `agents/roadmaps/stubs/road-to-council-persona-fanout.md`, which carries a
  pre-registered bench gate. Do not duplicate it here.
      verify: this roadmap adds no rival implementation; the stub's own gate is
      the promotion condition.
      **Stale-citation repaired 2026-08-31.** This line read *"blocked on
      `blocker: persona-seating-gap`"*, and that blocker is `Status: resolved`
      in § Blockers below. Its resolution was *promote the existing stub, defer
      Phase 9's persona-diversity claims, do not duplicate the stub's analysis
      here* — so the seating gap is adjudicated, not open. The **live** gate is
      the one that blocker's own `Recommendation` names: leave the stub parked
      until Phase 2 produces evidence that lens diversity moves a measured
      outcome. Phase 2 is itself gated — see `blocker: phase-2-benchmark-cost`
      below, added in the same change for exactly this reason.
- [x] 9.2 Never represent same-provider fan-out as external-model
  independence.
      verify: no rendered surface labels it "external council"
      **DONE 2026-08-31 — asserted, and the assertion found no violation to
      fix.** `grep -rni "external council" src/ dist/ agents/templates/ docs/`
      returns 16 hits outside `agents/roadmaps/`. Every one of them names the
      **real** multi-provider council (the `/council` path, gated on
      `ai_council.enabled` plus an enabled member), and the two surfaces that
      could plausibly have confused the two both draw the line explicitly:
      `src/domains/engineering-base/review/changes/command.md:183` renders
      *"Add an external council review alongside the six internal judges?"* —
      contrasting external with the same-provider host subagents by name — and
      `:280` folds "external council blocks" into the report as a separately
      marked source.
      The nearest same-provider-shaped mechanism is Mode 9
      `adversarial-verification-council`
      (`src/skills/subagent-orchestration/SKILL.md:217-229`). It is **not**
      labelled "external council" anywhere, and it states its own independence
      grade rather than borrowing one: *"distinct-model skeptics"*, with
      *"registered claim + high-risk tier need cross-**vendor** skeptics"*.
      Advisors are also not the failure this step names: `advisors.ts:2-10`
      shows replace-mode swaps a **persona** on a member's own external
      provider, so an advisor run is not a same-provider host fan-out.
      **Honest scope:** the fan-out lane 9.1 describes does not exist yet (9.1
      is blocked on `blocker: persona-seating-gap`), so this closes as a clean
      baseline over today's surfaces — it is a "no violation present", not a
      guarantee about a lane nobody has written.
- [x] 9.3 No further personas until the existing five can be intentionally
  seated or evaluated.
      verify: `src/agent-src/personas/advisors/` still holds exactly five
      entries when this phase closes
      **DONE 2026-08-31 — the count holds.** `ls
      src/agent-src/personas/advisors/` returns exactly five entries and no
      others: `contrarian.md`, `executor.md`, `expansionist.md`,
      `first-principles.md`, `outsider.md`. `git diff origin/main --stat --
      src/agent-src/personas/advisors/` is empty, so the branch added none.
      **What this step is and is not.** It is a hold, not a build: the verify
      line asks for a count, and the count is the whole deliverable. The
      constraint stays live for the rest of the phase — seating is still
      unsolved (9.1 is blocked on `blocker: persona-seating-gap`), which is
      precisely the condition under which "no further personas" binds.
- [ ] 9.4 After seating is solved, benchmark governed bundles (architecture /
  code review / roadmap / product) chosen from tracked persona definitions
  only, with persona and provider assignment counterbalanced.
      verify: a "persona won" result cannot be explained by "provider won"

## Phase 10 — Outcome attribution and observability

- [ ] 10.1 Extend decision replay (`ai_council/replay.ts`) with: ladder council
  resolution, council-internal topology, initial route, escalation, stage
  outputs, stop reason, synthesis policy, cost, latency, final verdict.
      verify: a replayed run reproduces the recorded route
- [ ] 10.2 Attribute each useful correction to the first stage where it
  appeared.
      verify: one real run yields a per-correction stage attribution
- [ ] 10.3 Track paid calls that change no finding, stance, confidence,
  evidence, or final decision; emit `zero_marginal_value_call_rate`.
      verify: the rate is emitted and is non-null on a real run
- [ ] 10.4 Compute route regret offline against the cheapest topology with an
  equivalent-quality outcome.
      verify: the comparison runs offline and never influences a live route
- [ ] 10.5 Track re-council savings: duplicates prevented, near-duplicate
  warnings, reruns intentionally confirmed, spend saved.
      verify: the figures reconcile against the retained artifacts
- [ ] 10.6 Track early-stop savings separately from quality.
      verify: cost and quality are never reported as one number

## Phase 11 — Learned routing as a challenger only

- [ ] 11.1 Collect offline training rows from benchmark and dogfood evidence
  only, without requiring raw private prompt content.
      verify: the row schema has no field capable of holding prompt text
- [ ] 11.2 Train an offline challenger classifier; it stays shadow-only.
      verify: no runtime path can reach the model
- [ ] 11.3 Promotion requires a material Pareto improvement in
  quality/cost/latency plus acceptable stability.
      verify: the comparison against the deterministic policy is published
- [x] 11.4 Keep the deterministic fallback permanently — no daemon, cloud
  router or learned model becomes necessary for basic council operation.
      verify: the suite runs green with the model artifact deleted
      **DONE 2026-08-31 — the property was vacuously true and is now pinned.**
      No learned-routing model artifact exists anywhere in the tree, so "runs
      green with the model artifact deleted" held for the uninteresting reason
      that there was nothing to delete. A vacuous property is exactly the kind
      that regresses unnoticed, so it is now a falsifiable guard:
      `tests/scripts/ai_council/deterministic_fallback.test.ts` (8 tests, green)
      asserts that no file under `src/scripts/ai_council/` (59 `.ts` files) or
      `src/scripts/_lib/judgment_ladder.ts` loads or names a learned-routing
      model, and that no model artifact (`.pkl`/`.onnx`/`.joblib`/
      `.safetensors`/`.gguf`) ships inside that scope.
      **Sensitivity was proven, not assumed.** A sabotage probe — a temporary
      `src/scripts/ai_council/__sabotage_probe.ts` containing
      `export const R = "models/router.onnx";` — turned the claim test red
      (1 failed / 7 passed); removing the probe restored 8/8. The file was
      deleted in the same command and is not in the diff.
      **Honest scope, stated because the test cannot state it at runtime:** this
      is a naming-based shape gate over source text, not a module-graph proof —
      a loader named outside the pattern set escapes it. That is why the file
      also tests the **denial**: four synthetic violating snippets must match
      and three ordinary council lines must not, so a zero in the claim test
      means "nothing there" rather than "the detector is broken". It cannot pin
      "permanently"; no test can. What it does is make the violation visible on
      the day Phase 11.2 lands a loader on a runtime path — which is the trip
      this step wants.
- [ ] 11.5 Relevant model-generation changes mark affected routing evidence
  stale.
      verify: a simulated model-generation bump invalidates the right slices

## Phase 12 — UX simplification

- [ ] <!-- roadmap-status: guarded-baseline --> 12.1 Keep `/council` as the main explicit user concept; users need no
  topology vocabulary.
      verify: the command surface gains no topology argument for normal use
      ```yaml
      guarded_baseline:
        category: future-mechanism
        scope: src/scripts/council_cli.ts (option tables) + src/scripts/ai_council/cli_help.ts
        command: npx vitest run tests/scripts/ai_council/council_topology_surface.test.ts
        red_proof: sabotage run 2026-08-31 — 3 of 11 tests RED, 11/11 GREEN after restore
        sabotage_model: added `{ flag: '--topology', takesValue: true, choices: ['star', 'mesh', 'round-robin'] }` to the `run` option table in src/scripts/council_cli.ts, after `--depth`
        recheck_when: src/scripts/ai_council/topology_selector.ts selectTopology
        discharged_ac: the baseline is pinned and RED-proven — no declared flag, no declared option value and no code line on the council command surface names a topology today
        pending_ac: "for normal use" once topology selection exists — nothing exercises the constraint under real selection, because there is no selection
      ```

      **FIRST INSTANCE of the `guarded-baseline` state, applied 2026-08-31 under
      the 2/2 convergent council verdict recorded above.** The step is NOT
      closed and does not count as done — that is the whole point of the state.
      What it now carries is a RED-proven regression tripwire where before it
      carried nothing, plus a machine-readable record of exactly which half of
      its `verify:` is discharged and which half cannot be.

      **Why this instance and not a different one.** The mechanism was applied to
      exactly one real step deliberately: a validator with no instance is a gate
      over a population of zero, which is the defect this repository names
      repeatedly and which the council's own atomicity condition exists to
      prevent. 12.1 was chosen because its baseline is the cheapest genuinely
      RED-provable one in the file.

      **`recheck_when` carries both a path and a symbol on purpose.** The path is
      a guess and is machine-checkable; the symbol is not, and the report marks
      it **not machine-checkable** rather than booking it as *"not stale"* —
      absence of a check is reported as absence, never as a pass.
- [ ] 12.2 Add a free explain mode: why task-side orchestration resolved to
  council, which topology would run, estimated spend and calls, evidence
  source — with no paid model call to explain routing.
      verify: explain mode issues zero provider calls
- [ ] 12.3 A force-topology debug control may exist but cannot override
  user-required decisions, destructive authorization, spend authorization, the
  Hard Floor, or turn same-provider subagents into an external council.
      verify: one test per prohibition
- [x] 12.4 Consumer surfaces request **capabilities** (independent external
  review, adversarial decision, architecture trade-off, minority challenge),
  never topology names; the shared council-rung policy chooses.
      verify: no command file hardcodes a topology name
      **DONE 2026-08-31 — grepped, clean, and vacuous in a way worth naming.**
      All seven topology names from the goal diagram (`single_external`,
      `dual_independent`, `advisor_diversity`, `peer_review`, `judge_synthesis`,
      `targeted_cross_exam`, `full_debate`) return **zero** hits across
      `src/agent-src/commands/` and `src/domains/` (222 `.md` files), in both
      the underscore form and the hyphen/space variants.
      **One near-hit, resolved rather than counted.** The variant grep matches
      `judge-synthesis` in `src/domains/engineering-base/review/changes/command.md`
      and `src/domains/meta/pack.yaml:40`. That is the **skill** of that name —
      the cross-judge consolidation format — which predates this roadmap's
      topology vocabulary and refers to a report shape, not a council topology.
      It is a naming collision, not a hardcoded topology name, and it is
      recorded here so a later grep does not re-litigate it.
      **Vacuity is honest here, and is not the same as unverified.** No topology
      vocabulary is implemented yet, so no command file *could* hardcode one —
      the step closes as a **baseline** taken before the vocabulary exists,
      which is the cheapest moment to take it. The constraint binds Phases 6-8
      and 13 when they land; if one of them introduces a topology name into a
      command file, this step's grep is the thing that was supposed to have
      caught it, and this note is the record that it was clean beforehand.

## Phase 13 — Rollout and promotion gates

- [ ] 13.1 Shadow: no behaviour change; record proposed topology and
  counterfactual evidence.
      verify: behaviour diff against the pre-phase baseline is empty
- [ ] 13.2 Advisory: permit cheaper depth reductions only where
  non-inferiority is demonstrated; no auto-escalation into more expensive
  topology yet.
      verify: no run costs more than today's default under advisory mode
- [ ] 13.3 Adaptive: enable escalation and early stop on slices that pass
  holdout gates.
      verify: each enabled slice names its holdout artifact
- [ ] 13.4 Default-on per slice only, on: quality non-inferiority or
  improvement, acceptable cost/latency, stable parse/gradeability, no material
  minority-rescue regression, judge-bias metrics within threshold, no weakening
  of user or spend boundaries.
      verify: all six conditions are recorded per slice before the flip
- [ ] 13.5 Re-evaluate on model-generation changes — evidence is not timeless.
      verify: a stale-evidence slice blocks its own default-on state

---

## Blockers

### blocker: leakage-bench-needs-quota-and-an-uncommittable-corpus

- **Status:** resolved 2026-08-31 — **BOTH stated obstacles were FALSIFIED by
  measurement, and the real obstacle is a different kind of thing. Replaced by
  `blocker: leakage-bench-needs-assembler-and-design-forks` below.** AI council
  2026-08-31, anthropic seat (openai `exit_1`, so **1/2 — DEGRADED, not
  convergence**; the degradation is recorded here rather than smoothed over,
  and the verdict was taken because it is the conservative direction: it keeps
  3.3 and 3.4 open, preserves NOT RUN, and weakens no floor).

  **What the two halves actually read on 2026-08-31.**
  (a) *Quota* — **expired.** `~/.event4u/agent-config/cli-calls.json` read
  `{"date":"2026-08-31","counts":{"anthropic":26,"openai":27}}` against a cap of
  50/provider/day (`src/scripts/ai_council/cli_call_budget.ts:60`). The UTC reset
  this field predicted has happened.
  (b) *Corpus* — **true about committing, false about assembling.** Gitignored is
  confirmed doubly (`.gitignore:196` `/agents/runtime/`, plus `.gitignore:319-320`
  inside the managed block), so it genuinely cannot be committed. But
  **716 provider-attributed response bodies exist locally** (anthropic 358 ·
  openai 356 · gemini 2), across 793 files under `responses/`, 84 session dirs
  and 353 question files — **23x the >= 30** this field asks for, with a
  near-even split, which is the balanced-family condition `scoreRecognition`'s
  dual chance baseline exists to handle
  (`src/scripts/ai_council/provider_leakage_bench.ts:122-123`).

  **The real obstacle, which this entry never named:** a **corpus assembler**.
  `collectGuesses` (`provider_leakage_bench.ts:90`) and `scoreRecognition`
  (`:136`) both take `items: readonly LeakageItem[]` as an **injected
  parameter**; there is no loader from `agents/runtime/council/responses/`. The
  only items file in the tree is
  `internal/bench/council-provider-leakage/smoke-items.json` — 6 items carrying
  `"synthetic": true` and self-declaring that *"A live runner must refuse this
  file"*.

  **Resolved, NOT satisfied.** No measurement was taken and none is claimed.
  716 bodies on one machine is not a measurement, and the distinction between
  NOT RUN and a null is exactly what this field existed to protect. The
  successor entry below carries that gate forward unweakened.

  **A retention finding, recorded because it is the input being decided about.**
  Two 7-day retention carriers name this directory (`session.ts:604`;
  `janitor.ts:57-61`, `ttlDays: 7`), and files with mtimes **117 days old
  survive** — declared and demonstrably not effective. The cause was NOT
  established. A hypothesis was recorded and deliberately **not acted on**:
  `RESPONSES_DIR` is a module constant bound to the running checkout's root
  (`session.ts:70-73`) while `council_cli.ts:224` resolves
  `COUNCIL_CANONICAL_DIRS` against `resolve_project_root(null)`, so runs from
  different roots may prune a directory other than the one they write to, and
  `prune_all_council_artifacts` has no automatic caller. The council classified
  this as **logged maintenance work, not blocker-gated**, and required that the
  over-retained bodies be **quarantined from benchmark eligibility until
  retention legitimacy is established** — which the successor's `Resolved when`
  carries as a named precondition.
- **Owner:** council — the disposition keeps both criteria alive and unweakened
  and descopes nothing, which the preservation test routes to the council. The
  entry exists so the condition has an owner rather than living in step prose.
- **Class:** 3
- **Blocks:** steps 3.3 and 3.4 only. 3.1, 3.2, 3.5 and 3.6 are closed and
  untouched by it; no later phase depends on it.
- **What to do:** nothing in this roadmap until both halves below are
  available. **Do not run the bench against the synthetic `smoke-items.json`** —
  it is self-declaring fixture data and a recognition rate computed over it
  would be a number about the fixtures, not about provider leakage. Do not
  implement style normalization (3.4) in the meantime:
  `normalizationGateVerdict` already refuses to return `below-bar` on empty
  data, and that refusal is the point.
- **Recommendation:** leave both open. The cost of waiting is that two of
  Phase 3's six steps stay unclosed; the cost of not waiting is a published
  recognition rate with no corpus behind it, which is the shape this roadmap's
  own § Prevented items exists to catch.
- **If you do nothing:** Phase 3 stands at 4 of 6, 3.4 stays correctly gated,
  and nothing downstream stalls. No criterion is weakened and no evidence is
  fabricated.
- **Resolved when:** *(REWRITTEN 2026-08-31 — the original value is quoted
  below rather than deleted, because it is the falsified text and a later reader
  needs to see what was wrong, not just that something changed.)* **This entry
  is resolved and its closure condition has moved** to
  `blocker: leakage-bench-needs-assembler-and-design-forks`, which carries the
  >= 30-body floor and the `smoke-items.json` prohibition forward unweakened.
  Nothing further closes here.

  The original read: *"the bench has been run over a corpus of >= 30 real
  anonymised response bodies and both the recognition rate and its chance
  baseline are published … **Two independent halves, and the quota is only the
  first.** (a) The daily CLI cap was exhausted on this run — anthropic 50/50,
  openai 51/50 — and resets at UTC midnight; (b) `agents/runtime/council/` is
  gitignored and auto-pruned, so the corpus cannot be committed and must be
  assembled locally at measurement time. **(b) survives the reset**, so this
  does not unblock at midnight."*

  Both halves are falsified above. Leaving that text standing as a live closure
  condition is the **stale-twin defect this file has already recorded twice** —
  a blocker carrying a closure condition nobody can satisfy while
  `lint_roadmap_blockers` stays green throughout, because the gate matches a
  literal label and never reads the value.

### blocker: leakage-bench-needs-assembler-and-design-forks

- **Status:** open — **created 2026-08-31 as the successor** to
  `leakage-bench-needs-quota-and-an-uncommittable-corpus`, whose two stated
  obstacles were both falsified by measurement (see that entry above). AI
  council 2026-08-31, anthropic seat, **1/2 — DEGRADED** (openai `exit_1`).
  The seat's own framing: the predecessor described an **availability**
  obstacle (quota, storage) and the real one is **unbuilt functionality**, a
  category change substantive enough that correcting the old entry in place
  would have left a misleading audit trail — *"a blocker for X/Y when X and Y
  weren't actually blockers"*.

  **No measurement has been taken and none is claimed.** The NOT RUN state the
  predecessor protected is preserved here verbatim in force.
- **Owner:** council — the disposition keeps both criteria alive and unweakened,
  descopes nothing, and lowers no floor, which the preservation test routes to
  the council. It does not touch the >= 30 floor or the synthetic-fixture
  prohibition, both of which the council named as floors it may not move.
- **Class:** 3
- **Blocks:** steps 3.3 and 3.4 only. 3.1, 3.2, 3.5 and 3.6 are closed and
  untouched by it; no later phase depends on it. Unchanged from the predecessor.
- **What to do:** build the assembler, then settle the three design forks
  before any rater sees an item — a measurement taken with any of them open is
  not interpretable.
  1. **Assembler.** Write a loader from `agents/runtime/council/responses/` to
     `readonly LeakageItem[]`, which
     `src/scripts/ai_council/provider_leakage_bench.ts:90,136` currently take as
     an injected parameter. It MUST refuse
     `internal/bench/council-provider-leakage/smoke-items.json` explicitly —
     that file self-declares `"synthetic": true` and that a live runner must
     refuse it.
  2. **Eligibility + balanced sampling.** Document which of the 716 bodies are
     eligible and how >= 30 are drawn without skewing the provider-family mix.
     The skew failure is already pinned in this file: a constant guesser scores
     above chance on an unbalanced corpus.
  3. **Anonymisation protocol.** Define what is stripped before a rater sees a
     body — provider names, model ids, and self-identifying phrasing at minimum.
     Step 3.3 says *"anonymized"* and defines nothing.
  4. **Rater budget.** Each rater x item is a paid call. 30 items x N raters
     against a 50/provider/day cap. Either it fits one UTC day or the multi-day
     schedule is stated up front — this is a quota constraint of a **different
     shape** than the predecessor's and must not be confused with it.
  5. **Retention quarantine.** The over-retained bodies (117-day mtimes against
     a declared 7-day TTL) are excluded from eligibility until the retention
     defect is diagnosed. See the predecessor's retention finding; the council
     made this a precondition rather than a footnote.
- **Recommendation:** build the assembler and settle the forks; do NOT run the
  bench first. The predecessor's own reasoning still holds and is the reason
  this successor exists rather than a green light: the cost of waiting is two of
  Phase 3's six steps staying unclosed, and the cost of not waiting is a
  published recognition rate with no defensible corpus behind it — the shape
  this roadmap's § Prevented items exists to catch.
- **If you do nothing:** Phase 3 stands at 4 of 6, 3.4 stays correctly gated
  behind 3.3, and nothing downstream stalls — `Blocks` above is unchanged. No
  criterion is weakened and no evidence is fabricated. The only loss is that the
  716 bodies keep accumulating unmeasured.
- **Resolved when:** the assembler exists and refuses the synthetic fixture, the
  three forks above are recorded, the retention quarantine is applied, and the
  bench has been run over a corpus of **>= 30 real anonymised response bodies**
  with both the recognition rate and its chance baseline published — at which
  point 3.3 closes and 3.4 becomes decidable in whichever direction the number
  points. **The >= 30 floor and the `smoke-items.json` prohibition are carried
  forward unweakened**; the council named both as floors it could not move.

### blocker: phase-2-benchmark-cost

- **Status:** open — **created 2026-08-31. The condition is not new; carrying it
  is.** It has gated Phase 2 since the phase was written and lived only in
  2.1's closing note: *"**Steps 2.2-2.5 and 2.7 stay open.** The manifest is a
  precondition for them, never their execution: no arm ran and no quota was
  spent."*

  **Why it is being carried now.** Measured 2026-08-31, this condition gates
  **23 of this file's 46 open steps** — more than every recorded blocker in the
  file combined — while appearing in no gate at all. This frontmatter's own
  earlier growth claim states that the 3.3/3.4 entry was created precisely
  because *"a condition living only in step prose"* was *"the failure the
  previous drain run recorded three times in one run"*. The largest such
  condition in the file was still uncarried. That inconsistency, not a new
  discovery, is what this entry repairs.
- **Owner:** council — the disposition preserves every gated criterion
  unweakened and descopes nothing; it only makes an existing condition
  machine-readable. Nothing here lowers a floor.
- **Class:** 3
- **Blocks:** steps 2.2, 2.3, 2.4, 2.5 and 2.7 directly, and by dependency
  5.2, 5.5, 7.2, 7.4, 7.5, 7.6, 8.5, 9.1, 9.4, 10.4, 11.2, 11.3, 11.5 and
  13.1-13.5. Phase 1B, and steps 5.3, 6.1, 8.2, 8.3, 10.5, 10.6 and 12.1 are
  **not** blocked by it and are executable independently.
- **What to do:** nothing in Phase 2 until one of these is settled.
  (a) Build the benchmark runner —
  `src/scripts/ai_council/topology_bench_manifest.ts` `main()` only `--emit`s
  the JSON and contains no provider dispatch, so there is no runner to run.
  (b) Authorise the spend — `internal/bench/council-topology/call-manifest.json`
  records `minimum_total: 1584`, `worst_case_total: 1804` and `utc_days: 20`
  against a 50/provider/day cap, i.e. **both providers monopolised for 20
  consecutive UTC days**, with 384 cells at 352 `pending` / 32 `not_eligible` /
  **0 complete**.
  (c) Re-scope Phase 2 to a cheaper design that still licenses its claims —
  noting that this file already records the honest limit: *"at N=2 this
  benchmark licenses no promotion claim at all"*, because 2.6's pre-registered
  floors are n >= 5 and n >= 10 and N=2 clears neither.
- **Recommendation:** (c), and take it to the owner rather than the council.
  Both council seats **declined to greenlight the runner** on 2026-08-31, and
  20 days of monopolised provider quota is a spend commitment above what a
  council decides. A re-scope that changes what Phase 2's results may claim
  touches the roadmap's declared purpose, which is owner-reserved.
- **If you do nothing:** Phase 2 stays at its manifest, the 23 dependent steps
  stay open, and — the change this entry actually makes — `gates --all` now
  reports the condition instead of it being discoverable only by reading 2.1's
  closing prose. Nothing regresses; nothing is silently lost.
- **Resolved when:** either the runner exists and the spend is authorised with
  its UTC-day schedule recorded, or Phase 2 is re-scoped by the **owner** with
  the new claim-licensing limit written down — and in either case 2.1's closing
  note is updated to point at this entry rather than carrying the condition
  alone.

### blocker: unlicensed-source-verbatim-scan
- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **(c) now — publish unreachability as the finding and scope the
  step to prose this tree can diff — plus a follow-up stub for pinned-source
  verification.** AI council 2026-08-28. Offline execution cannot establish
  remote licence state; it can still scan and rewrite substantively-verbatim
  prose that exists in the current tree, while reporting explicitly that upstream
  provenance was unreachable.
- **One correction to this blocker's own wording, adopted.** It says "confirm no
  LICENSE → **no grant exists**". That is **too categorical**: a grant may appear
  in file headers, package metadata, accompanying terms, or another document in
  the same repository. The defensible conclusion is *"no licence grant was
  located in the inspected material"*, followed by conservative treatment — not a
  claim that no grant exists anywhere. The step text is read that way from here.
- The source names stay **anonymized** in this roadmap in every branch, and no
  branch of this makes it the license-required-attribution carve-out.
- **Blocks:** 0.4 only. Phases 0.1-0.3, 0.5 and everything downstream ship
  without it.
- **What to do:** two of the three harvest sources reportedly ship no LICENSE
  file. That is unverifiable offline, so a maintainer must fetch each source at
  a pinned revision and record the licence state. Then pick one of:
  (a) confirm no LICENSE → **no grant exists**, so the verbatim scan is
  mandatory and any substantively-verbatim prose is rewritten before P0 closes;
  (b) a permissive licence is found → record it and run the scan as a courtesy
  check; (c) the sources are unreachable → publish that as the finding and
  scope 0.4 to the prose this tree can actually diff.
  **In every branch the source names stay anonymized in this roadmap.** No
  licence means this is *not* the license-required-attribution carve-out, and
  `CREDITS.md` being a denylist carve-out path (`external_sources_denylist.json`
  → `skip_paths`) does not extend to `agents/roadmaps/`.
- **Recommendation:** (a) — fetch and record; the scan is cheap once the
  licence state is written down.
- **If you do nothing:** P0 closes with an unrecorded provenance claim, and the
  first external question about lineage has no answer in the tree.
- **Resolved when:** the licence state of each source is recorded in the
  evidence file with the commit read, and the scan result is recorded or
  explicitly scoped out.

### blocker: parallel-fanout-reopens-a-closed-decision
- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **(a) — keep sequential dispatch and close Phase 4 as a
  published null.** AI council 2026-08-28, **2/2**. Sequential dispatch is a
  recorded decision, not an omission: the orchestrator states the trade (the
  previous parallel executor was traded for predictable mid-flow user prompts),
  `grep -c 'Promise.all'` returns 0, and the dispatch order is pinned
  byte-for-byte by tests. Reopening it without new evidence — a real latency
  complaint, not a topology experiment's convenience — is scope creep, and the
  trade was made at 2-3 members, which is still the typical configuration.
- **A published null here is honest completion**, and it discharges the revisit
  gate: the decision was named, evaluated against the current tree, and left
  standing with the reason recorded. If it is ever reopened, one seat named the
  only shape worth considering — intra-round parallelism behind a ceiling flag,
  preserving the interactive-prompt property that motivated going sequential.
- **Blocks:** all of Phase 4. No other phase depends on it.
- **What to do:** sequential dispatch is a **recorded decision**, not an
  omission — `src/scripts/ai_council/orchestrator.ts:8-12` states the trade
  ("the previous parallel ThreadPoolExecutor was traded for predictable
  mid-flow user prompts"), `grep -c 'Promise.all' src/scripts/ai_council/orchestrator.ts`
  returns `0`, and the dispatch order is pinned byte-for-byte by tests. Run
  [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md) first:
  name the mechanism, state what changed, and route it. Then pick exactly one:
  (a) keep sequential and close Phase 4 as a published null; (b) reopen with a
  concrete answer to the interactive-overrun question **and** a
  `--confirm-ceiling` design that leaves the byte-pinned tests unmodified;
  (c) narrow to intra-round parallelism behind the ceiling flag only.
- **Recommendation:** (a) until a real latency complaint exists — the trade was
  made at 2-3 members, which is still the typical configuration.
- **If you do nothing:** Phase 4 stays closed, which is the safe state; the
  risk is a future session reading the phase as unbuilt work and silently
  reverting a decision.
- **Resolved when:** a revisit record exists with a verdict, a rationale, and a
  `revisit-if` line — a null verdict resolves this blocker.

### blocker: maintainer-blind-ratings
- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **(b) — scope the affected phases to gradeable-only slices and
  publish the human-rubric arms as deferred, with the originating rationale
  intact.** AI council 2026-08-28, **2/2**, not actionable under this run's
  constraints: no human raters are available, and the originating record is
  explicit that *"blind human judgments cannot be substituted with an
  architectural choice or inferred from existing nulls"*.
- **The deterministic and executable-oracle arms are unaffected and land in
  full.** The roadmap stays valuable while narrower — but only if it says so:
  one seat's caveat is adopted, that deferring the rubric arms is fine when
  clearly stated and misleading if a reader assumes "quality" meant
  "human-judged usability".
- **On an LLM-as-judge substitute, asked directly.** The rationale does not
  forbid every model-graded number; it forbids using one **as a substitute for
  blind human judgment**. A separate arm is defensible only if it is named as
  what it is — a **model-graded exploratory arm**, never "the human-rubric arm" —
  and never pooled with, averaged into, or reported as the human arm.
- **Blocks:** the human-rubric arms inside 2.1 and 5.3. The deterministic and
  executable-oracle arms are unaffected.
- **What to do:** this is an **inherited live blocker**, not a new one — it
  originates in `agents/roadmaps/archive/road-to-council-blind-review.md:251`,
  whose Phases 2 and 3 were transferred out to
  `agents/roadmaps/stubs/road-to-council-blind-ratings.md` under the recorded
  disposition, on the adopted rationale that *"blind human judgments cannot be
  substituted with an architectural choice or inferred from existing nulls"*.
  Pick one: (a) the maintainer produces the blind ratings, unblocking the
  rubric arms; (b) scope Phase 2 and 5.3 to gradeable-only slices and publish
  the rubric arms as deferred; (c) close the stub against a published null.
- **Recommendation:** (b) — it lets the whole benchmark land while keeping the
  human-judgment claim honestly unpaid.
- **If you do nothing:** the rubric-scored families in 2.1 have no grader, and
  any quality claim resting on them is unsupported.
- **Resolved when:** the ratings exist, or the rubric arms are explicitly
  scoped out of this roadmap with the null recorded at the stub.

### blocker: persona-seating-gap
- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **promote the existing stub; defer Phase 9's persona-diversity
  claims; do not duplicate the stub's analysis here.** AI council 2026-08-28,
  **2/2**. The decisive argument is that running the benchmark anyway would
  produce **numbers that do not test the stated variable**: with a two-provider
  configuration at most 2 of 5 personas seat, and which two is a config-order
  accident, so the treatment is confounded before the first measurement. A
  five-persona treatment cannot be realised on this configuration at all.
- This is a **roadmap decision, not a benchmark execution** — the gap is already
  measured and the stub already carries a pre-registered bench gate.
- **Blocks:** all of Phase 9. Nothing else.
- **What to do:** **the carrier already exists — point at it, do not duplicate
  it.** `agents/roadmaps/stubs/road-to-council-persona-fanout.md` records the
  measured gap (`ai_council/advisors.ts:140` walks enabled advisors,
  `:151-155` throws `CouncilConfigError` when two bind the same member, so with
  a two-provider configuration at most **2 of 5** personas seat and which two
  is a config-order accident) and carries a **pre-registered bench gate**.
  Decide only whether that stub is promoted; do not restate its analysis here.
- **Recommendation:** leave the stub parked until Phase 2 produces evidence
  that lens diversity moves a measured outcome.
- **If you do nothing:** Phase 9 stays blocked, which is correct; the risk is
  duplicating the stub's analysis in a second file.
- **Resolved when:** the stub is promoted or closed, per its own gate.

### blocker: early-stop-vs-dissent-ordering
- **Status:** resolved 2026-08-25 — **the conjunct is in the predicate and its
  sensitivity is demonstrated red-then-green.**
  `src/scripts/ai_council/argument_exhaustion.ts`, 15 tests.

  **`dissentRepairAttempted` is a required conjunct of `evaluateStop`**, not a
  soft check upstream that the predicate hopes ran. Encoding it as a conjunct
  rather than as call-order discipline is the point: a caller that forgets the
  ORDER produces a wrong answer silently, while a caller that forgets the FIELD
  produces `false` — the safe direction, and a visible one.

  **The sensitivity proof, both arms, on one fixture.**
  `CONFORMITY_COLLAPSE` is indistinguishable from a genuinely exhausted run on
  every cost-visible axis — enough rounds, everyone repeating themselves, no open
  objection — and differs only in that the anti-conformity defence never ran.
  **RED:** through a neutered copy with the conjunct removed, it **stops**, which
  is exactly the failure this blocker names. **GREEN:** through the shipped
  predicate it does not, and reports `dissent-repair-not-attempted`. A third case
  asserts the neutered copy still agrees with the real one on a genuinely
  exhausted run — sensitivity means differing on the ONE axis under test, and a
  copy that disagreed everywhere would prove nothing.

  **Majority size is absent from the predicate on purpose (6.3), and asserted
  absent.** Unanimity is the most available signal here and the least
  trustworthy: it is precisely what conformity collapse produces, so a predicate
  reading it would stop soonest in the case it must not. A test shows a
  twenty-member unanimous-but-unrepaired run is no easier to stop than a
  two-member one.

  **One case the step's four conditions did not cover, found while writing it:**
  `every()` over an empty array is vacuously true, so a council with **no present
  member** would have been the easiest one to stop. `no-members-present` is now
  its own blocker in the verdict.
- **Owner:** agent
- **Blocks:** 6.2, and by dependency 6.5.
- **What to do:** the ordering is the substance, not a detail: anti-conformity
  repair must fire **before** the cost stop, because convergence may be
  conformity collapse rather than solution stability. Encode the ordering as a
  precondition in the stop predicate (`dissent repair attempted` is a required
  conjunct, not a soft check), then prove sensitivity: remove the conjunct,
  watch a conformity-collapse fixture stop when it must not, restore it. Run
  `./scripts-run src/scripts/lint_roadmap_blockers` after editing this section.
- **Recommendation:** encode it as a hard conjunct now — retrofitting an
  ordering constraint into a stop predicate after promotion is the expensive
  version.
- **If you do nothing:** early stop can fire on conformity collapse and be
  reported as convergence, which is exactly the failure Phase 6 exists to
  prevent.
- **Resolved when:** the conjunct is in the predicate and its sensitivity has
  been demonstrated red-then-green.

### blocker: evidence-integrity-unparsed-dependency
- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **verify by lookup, and if the distinction did not ship, REOPEN
  it as its own change — never scope it out quietly.** AI council 2026-08-28
  (anthropic + openai, 1 round, $0.00). One seat called it actionable now (pure
  in-tree lookup: read the archived roadmap's completion state, grep for the
  mechanism, cite `file:line` or confirm its absence); the other declined to call
  it actionable *from the material supplied to the council*, which is a statement
  about the council's inputs rather than about the tree.
- **Both converged on what actually matters, and it is a priority ruling:** of
  the five blockers, **this is the one that must not be descoped.** The others
  narrow which outcomes were measured; this one threatens the meaning of
  measurements already reported. If a parse failure is observationally identical
  to a genuine zero-findings result, Phase 1B's promotion gate cannot be trusted,
  and the roadmap's remaining claims become **positively misleading rather than
  merely incomplete**.
- **Blocks:** all of 1B. 1A ships independently.
- **What to do:** 1B needs the `unparsed` versus zero-findings distinction,
  which `agents/roadmaps/archive/road-to-council-evidence-integrity.md`
  Phase 2 was to expose. Confirm against the archived roadmap whether that
  distinction actually shipped: if yes, drop this blocker and cite the
  `file:line`; if no, either scope 1B out or re-open the dependency as its own
  change.
- **Recommendation:** check first — the roadmap is archived, which usually
  means shipped, and this blocker may be resolvable by one read.
- **If you do nothing:** 1B's promotion gate cannot distinguish a parse failure
  from a genuine zero-findings result, and the 70 % figure is unmeasurable.
- **Resolved when:** the distinction is cited at `file:line`, or 1B is scoped
  out.

---

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A second task-side resolver lands anyway | implementation | The rejected `CouncilTopologyRouter` shape is the intuitive design; a future session reading Phase 7 in isolation may rebuild it beside the ladder | 0.5 locks the invariant in a test that fails on a second router, sabotage-verified; 7.1 excludes `team` and `user_required` from the vocabulary by construction | Phase 0 — Provenance and the one-resolver lock |
| 2 | Rebuilding shipped council mechanics | implementation | Ten proposals in the source drafts already exist in the tree; re-implementing any is a larger risk than the feature's absence | § Prevented items carries a `file:line` per row; 0.2's surface inventory forces a no-duplication check before any phase opens | Prevented items — verified already-shipped |
| 3 | Phase 4 silently reverts a recorded decision | implementation | Sequential dispatch was chosen deliberately and is byte-pinned by tests; reading Phase 4 as unbuilt work would revert it without a record | Phase 4 is framed as a revisit gate; 4.3 requires the byte-pinned tests to stay green **unmodified**; `blocker: parallel-fanout-reopens-a-closed-decision` gates the whole phase | Phase 4 — Parallel fan-out reopens a closed decision |
| 4 | Early stop fires on conformity collapse | product | A run that stops because members converged socially is reported as convergence, degrading exactly the decisions council exists to improve | 6.2 makes dissent repair a required conjunct; 6.3 forbids majority size as a stop condition; `blocker: early-stop-vs-dissent-ordering` requires red-then-green sensitivity proof | Phase 6 — Adaptive depth with anti-conformity before the meter |
| 5 | Quality claims without a single-model baseline | product | "Council improves quality" is the claim most likely to be asserted and least likely to be measured; without a strong single-model arm it is unfalsifiable | 2.2 makes the strong single-model baseline mandatory in the same table; 2.5 separates model quality from topology quality; 2.6 forbids N=1 promotion | Phase 2 — Build the benchmark before automating topology |
| 6 | Source attribution leaks into the tracked tree | product | The source drafts name third-party repos and authors; a landed derivation-attribution violates source confidentiality and the CI denylist gate | Sources are referenced only as Source A/B/C with `ENC1:` links; 0.3 routes real links through encryption; `check_no_external_sources` is the deterministic backstop | Anonymized provenance |
| 7 | Style normalization ships on research alone | implementation | Self-preference research is suggestive but not evidence about this tree; an expensive normalization pipeline could land unjustified | 3.3 measures leakage first; 3.4 requires both above-chance recognition **and** demonstrated judgment distortion before any code | Phase 3 — Independence and judge-bias hardening |
| 8 | Spend authorization weakened by topology choice | product | A topology selector that can pick a parallel or deeper path could effectively upgrade a plain `--confirm` into broader authorization | 4.4 requires `--confirm-ceiling`; 4.6 forbids the silent upgrade with a test; 12.3 blocks the force control from overriding spend or Hard Floor | Phase 4 — Parallel fan-out reopens a closed decision |
| 9 | Learned routing becomes a runtime dependency | implementation | A challenger model that quietly moves onto the live path makes basic council operation depend on an artifact | 11.2 keeps it shadow-only with no runtime path; 11.4 requires the suite to run green with the artifact deleted | Phase 11 — Learned routing as a challenger only |
| 10 | Phase 9 duplicates an existing stub | implementation | The seating analysis already exists in a stub with a pre-registered gate; restating it creates two carriers that can drift | 9.1 points at the stub and forbids a rival implementation; `blocker: persona-seating-gap` makes promotion the stub's own decision | Phase 9 — Advisor composition after seating |

---

## The vacuous-baseline precedent, settled 2026-08-31

> **AI council 2026-08-31, anthropic/claude-sonnet-4-5 + openai/codex-default,
> 2/2 CONVERGENT on Option C.** Recorded here rather than linked: council output
> is gitignored and auto-pruned, so a path would rot.

**The question.** Four open steps in this file (7.3, 12.1, 12.3, 11.1, plus the
near-twin 6.5) assert properties of mechanisms that **do not exist**, so the
property is currently unviolatable. May such a step close `[x]`? The file held
**both precedents and no rule distinguishing them**: 2.1 and 2.6 closed on a
pre-registration document alone, 11.4 and 12.4 closed on pinned negative
baselines — while 0.5 explicitly **declined** a structurally identical clause on
the ground that *"Any check for it today would pass vacuously"*.

**The verdict.** A step whose `verify:` asserts a property of an absent mechanism
may **not** close `[x]` — that overstates the evidence. It gets a new
machine-readable state, `guarded-baseline`: the canonical checkbox stays
`- [ ]`, carries `<!-- roadmap-status: guarded-baseline -->`, and a mandatory
adjacent evidence block records `scope`, `command`, `red_proof`,
`sabotage_model`, `recheck_when`, `discharged_ac`, `pending_ac` and `category`.

**Tool semantics both seats specified.** `update_roadmap_progress` reports it
separately and **excludes it from completed counts**, and rejects the annotation
with no `red_proof`; `archive_completed_roadmaps` treats it as incomplete and
**refuses archival**; a `recheck_when` trigger that now exists marks the evidence
**stale**; only verification against the real mechanism permits `[x]`.

**The RED proof is the discriminator, and it is not optional.** A baseline that
has never been seen red by neutralising the property it asserts is an ordinary
open item and is **not** eligible for the annotation. Both seats were explicit:
sabotage sensitivity is evidence *about the test*, never *about the system*.

**The category split** (anthropic's refinement, uncontested):
*absence-assertion* — asserts something is absent and absence is observable
today — MAY close `[x]` when sabotage-verified, because the AC is about current
state. *future-mechanism* — asserts a property of a mechanism that does not
exist — gets `guarded-baseline`.

**Atomicity was a condition of the verdict, not a preference.** openai, verbatim:
*"C is acceptable only if its tooling lands atomically; otherwise use ordinary
`[ ]` with structured evidence"*, dissenting that *"an enforceable unchecked
state is more honest than an unread third-state annotation"*. A half-wired third
state is the outcome both seats rejected.

**12.3 is excepted, by both seats, and stays plain `[ ]`.** Step 4.6 was
cancelled and its `--confirm`-to-ceiling prohibition deliberately parked onto
12.3 *"and it stays open"*. Closing it in any form would silently drop a
prohibition another step was cancelled in favour of. openai added that absence
guards *"discharge none of the five behavioral prohibitions"*.

**Application, as both seats stated it:** 7.3 and 12.1 → `guarded-baseline` after
a RED proof · 11.1's schema clause → dischargeable as an absence-assertion after
a RED field-addition sabotage, collection clause pending, **step stays
unchecked** · 6.5's pre-registration clause → dischargeable, arms clause pending,
**step stays unchecked** · 12.3 → open, no annotation.

## Acceptance Criteria

1. `judgment_ladder.ts` remains the single task-side orchestration resolver,
   and a test fails on any second one.
2. Council topology selection exists only behind the ladder's council rung;
   `team` and `user_required` are not representable in its vocabulary.
3. `ai_council/necessity.ts` retains a clear, non-duplicative role.
4. Method provenance is recorded as Source A/B/C in `CREDITS.md` and
   `provenance/harvests.jsonl`, with links as `ENC1:` tokens only, and
   `check_no_external_sources` is green.
5. The unlicensed-source verbatim scan is recorded, or explicitly scoped out
   with the licence state written down.
6. Exact repeat council runs warn before new spend, and the warning can never
   become an unconditional block.
7. Near-duplicate warnings print their similarity score against a
   pre-registered threshold.
8. Inline findings reduce analysis-lens extraction calls with no parse-quality
   regression, or the null is published and the change reverts.
9. Deterministic and executable truth outranks council consensus — a
   probe-resolvable question never reaches topology selection.
10. Every council-effectiveness claim carries a strong single-model baseline, a
    trial count, and a variance band.
11. Benchmark results separate topology quality from model quality.
12. Peer reviewers never receive their own authored answer, enforced in payload
    construction rather than in prompt text.
13. Candidate ordering is reviewer-specific and property-tested for position
    bias at N=2..8.
14. Provider-recognition leakage is measured against chance; style
    normalization remains absent unless leakage is both measurable and shown
    harmful.
15. Candidate content cannot override ranking or synthesis contracts.
16. Sequential dispatch remains the default and its byte-pinned tests are
    unmodified; any parallel path requires a confirmed worst-case ceiling and a
    recorded revisit verdict.
17. Majority vote cannot decide finding-level correctness, and material
    minority arguments survive synthesis.
18. Correct-minority / wrong-majority fixtures are permanent benchmark cases.
19. ADR-120 changes only on synthesis evidence, with the artifact pinned.
20. Dissent repair runs before argument-exhaustion stopping can fire, proven
    red-then-green; majority size alone never stops a run.
21. A stopped run is textually distinguishable from a full run.
22. Large councils do not require unconditional O(N²) peer review, and
    targeted cross-examination names the exact disputed claim.
23. The five existing personas are benchmarked before any sixth is proposed,
    and same-provider fan-out is never labelled external-model independence.
24. Every paid call is explainable in replay; useful corrections are
    attributable to a stage; `zero_marginal_value_call_rate` is measurable.
25. Re-council and early-stop savings are measured separately from quality.
26. Learned routing, if explored, stays an offline shadow challenger, and the
    suite runs green with its artifact deleted.
27. User authority, the Hard Floor, and spend gates are never weakened by a
    topology choice.
28. The published proof surface reports where council **loses** as well as
    where it wins.
29. No row in § Prevented items has been rebuilt, and the quota-source split
    has not been re-proposed.

---

## Explicit non-goals

- No second task-side routing architecture beside the judgment ladder, and no
  standalone `CouncilTopologyRouter`.
- No replacing external-model independence with same-provider personas, and no
  new fixed five-agent council.
- No additional personas before existing seating is resolved.
- No majority vote as finding-level truth, and no Borda aggregate as a
  correctness oracle.
- No learned router as a required runtime dependency, and no remote routing
  daemon.
- No third-party transport shortcut that bypasses existing provider spend and
  quota governance.
- No project-local council config as an authoritative enablement source
  ([`council-availability`](../../src/rules/council-availability.md)).
- No auto-authorization by council, and no hiding dissent for cleaner output.
- No trigger-taxonomy work and no HTML verdict surface — both are owned
  elsewhere (§ Deferrals held elsewhere).
- No claim that "council is better" without scoped evidence.
