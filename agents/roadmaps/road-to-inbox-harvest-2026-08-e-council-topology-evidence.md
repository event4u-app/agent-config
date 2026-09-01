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

      **NOT RE-ATTEMPTED on 2026-08-31 (drain run 12), and the reason is
      quota rather than a change of mind.** The remaining unknown — a run in
      which EVERY answering seat carries the block — needs four calls (two per
      seat: deliberation plus consensus scoring) and five were available at run
      start. Before the attempt could be made both seats went over cap
      (`anthropic 50/50 · openai 51/50` against
      `ai_council/cli_call_budget.ts:60`), spent by a parallel worker: this run
      made zero provider calls and the attribution sidecar assigns all of them
      to `unknown`. Recorded because the alternative reading — that the run was
      declined on judgement — would be wrong, and because the known failure mode
      is a **model-compliance** miss by one seat rather than anything this tree
      can fix, so a retry is worth making but is not worth raising a cap for.

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
- [-] 2.2 Mandatory baselines per eligible slice: host solo, strongest
  configured single external model, cheapest configured single external model,
  current default council path, full debate where applicable.
      verify: no result claims "council improves quality" without a strong
      single-model baseline in the same table

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".
- [-] 2.3 Emit the full metric set: deterministic correctness where possible,
  executable test result where possible, rubric quality, cost, latency, calls,
  tokens, parse/gradeability rate, rerun variance, disagreement entropy,
  minority rescue, majority corruption, synthesis delta,
  zero-marginal-value-call rate.
      verify: one run produces every column, or the missing column is recorded
      as a declared gap rather than silently absent

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".
- [-] 2.4 Stage ablation: generation only; + ranking; + peer critique;
  + synthesis; full pipeline.
      verify: an improvement can be attributed to a named stage

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".
- [-] 2.5 Separate model quality from topology quality — same topology across
  model sets, and same model set across topologies.
      verify: both axes appear in the result table

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".
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
- [-] 2.7 Round-count bias arm: rounds 1 vs 2, verdict flips, dissent
  retention, correctness where gradeable, confidence-vs-correctness, cost
  delta. Grounded in **arXiv 2505.19477** (round-1 debate bias amplification) —
  the citation the source draft omitted.
      verify: the arm reports a result **or** a null; a null is a valid
      published outcome and closes the step

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".

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
- [-] 3.3 Provider-recognition leakage bench: ask reviewers and judges to guess
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

      **`[-]` DEFERRED 2026-09-01 (drain run 12) — NOT cancelled, NOT satisfied,
      and NOT RUN.** The AI council's recorded verdict was B1 (build the runner,
      execute both arms) with a hard precondition both seats attached: both arms
      in one coherent session across two UTC days. Each arm is 30 calls per
      provider and the cap is 50 per provider per UTC day
      (`src/scripts/ai_council/cli_call_budget.ts:60`), so the arms cannot share
      a day and this run cannot guarantee a session across the boundary. The
      openai seat named the fallback for exactly that state — *"choose B3
      immediately rather than recording an execution commitment the run cannot
      fulfill"* — so B3 is applied under the verdict, not against it.
      **No measurement was taken and none is claimed.** The design, the pattern
      list, the execution sequence, the four-conjunct close condition and the
      only permitted claim are carried in
      [`stubs/road-to-provider-leakage-bench-execution.md`](stubs/road-to-provider-leakage-bench-execution.md).
      Floors unmoved: `>= 30` items per arm read per arm, the synthetic-fixture
      prohibition, and no population-rate claim from the 1,402-body corpus.
- [-] 3.4 Hold style normalization behind the stronger gate: implement only if
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

      **`[-]` DEFERRED 2026-09-01 (drain run 12) — NOT cancelled, NOT satisfied,
      and NOT RUN.** The AI council's recorded verdict was B1 (build the runner,
      execute both arms) with a hard precondition both seats attached: both arms
      in one coherent session across two UTC days. Each arm is 30 calls per
      provider and the cap is 50 per provider per UTC day
      (`src/scripts/ai_council/cli_call_budget.ts:60`), so the arms cannot share
      a day and this run cannot guarantee a session across the boundary. The
      openai seat named the fallback for exactly that state — *"choose B3
      immediately rather than recording an execution commitment the run cannot
      fulfill"* — so B3 is applied under the verdict, not against it.
      **No measurement was taken and none is claimed.** The design, the pattern
      list, the execution sequence, the four-conjunct close condition and the
      only permitted claim are carried in
      [`stubs/road-to-provider-leakage-bench-execution.md`](stubs/road-to-provider-leakage-bench-execution.md).
      Floors unmoved: `>= 30` items per arm read per arm, the synthetic-fixture
      prohibition, and no population-rate claim from the 1,402-body corpus.
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

- [x] 5.1 One synthesis-strategy interface behind the candidates (host
  convener, dedicated external judge, strongest configured model, top-ranked
  member, dual synthesis + adjudication) — no user-facing mode proliferation.
      verify: the user-facing surface gains no new mode names
      **DONE 2026-08-31 — one interface, five candidates, zero new user-facing
      names.** New mechanism:
      `src/scripts/ai_council/synthesis_strategy.ts` (`SYNTHESIS_STRATEGIES`,
      `STRATEGIES`, `resolveSynthesisStrategy`, `reachableStrategies`). Tests:
      `tests/scripts/ai_council/synthesis_strategy.test.ts` (12 tests, green).
      **Selection is NOT reimplemented.** All five strategies delegate to
      `select_chairman` (`chairman.ts:42`) through one shared resolver, and a
      test asserts exactly that: the module imports `select_chairman`, and the
      five `resolve:` entries name **one** function. A second selection path
      would be two answers to "who chairs", and the second is the one nobody
      updates — the defect 1A.1 forbids for the question hash. What this module
      adds is a NAME for what the existing selection already does per
      configuration, so Phase 5's showdown has something to compare.
      **Four of five resolve from configuration the engine already reads**
      (`ai_council.chairman.mode`, `.member`, `members.<name>.tier` — three keys,
      asserted): `host` → `host_convener`, `member` → `external_judge`, `auto`
      with tiers → `strongest_model`, `auto` without → `top_ranked_member`
      (config order being the only ranking the engine trusts). An unknown mode
      returns `null` rather than a guessed strategy.
      **The fifth is declared UNREACHABLE, which is the honest part.**
      `dual_adjudicated` cannot be selected from today's configuration —
      reaching it needs a new input, and a new input is exactly what this step's
      verify clause forbids. It carries `reachable: false`, a test asserts no
      accepted mode resolves to it, and it is left unselectable rather than
      smuggled in behind a flag.
      **The verify clause is measured over four surfaces, not promised.** No
      strategy id (underscore or hyphen form) appears in `council_cli.ts` or
      `cli_help.ts`; no declared `flag:` or `choices:` value names one (the
      scanners are asserted to have found the real tables — >10 flags, >5
      choices — so an empty result is not an empty scan); `all_synthesis_modes()`
      is pinned to exactly the pre-existing `['analysis', 'default', 'design',
      'optimize', 'pr']`; and no `.md` under `src/agent-src/commands/` or
      `src/domains/` (>100 files scanned) names one. That is 12.4's rule applied
      to synthesis.
      **The chairman's self-judge refusal is re-pinned here**, so a 5.1 edit
      cannot weaken it: a member that deliberated resolves to `member: null`
      with a `cannot self-judge` annotation.
      **Sensitivity was proven twice, not assumed.** Sabotage A — adding
      `{ flag: '--synthesis-strategy', choices: ['host_convener',
      'dual_adjudicated'] }` to `council_cli.ts`'s `run` option table — turned it
      RED (**2 failed / 10 passed**). Sabotage B — adding a `dual_adjudicated`
      row to `_SYNTHESIS_TABLE` in `prompts.ts`, i.e. a new user-visible
      synthesis mode — turned it RED (**1 failed / 11 passed**). Both restored
      to 12/12. The suite also tests the **denial**: both scanners are shown to
      extract a strategy name from constructed violating text and to stay silent
      on a clean line.
      **HONEST SCOPE.** This is the interface and the naming; it changes no
      dispatch. The billable synthesis call stays in `council_cli.ts`
      `_maybe_run_chairman` where it already lives, and 5.2 — benching
      identity-blind against identity-visible — is gated behind
      `blocker: phase-2-benchmark-cost`.
- [-] 5.2 Bench identity-blind against identity-visible synthesis explicitly,
  so vendor prestige cannot leak in accidentally.
      verify: both arms are reported side by side

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".
- [x] 5.3 Majority-laundering test: seed one correct minority against several
  plausible-but-wrong majority answers; the synthesizer must justify accepting
  or rejecting the minority.
      verify: the fixture is permanent, and a synthesizer that silently drops
      the minority fails it
      **DONE 2026-08-31 — fixture frozen, gate shipped, drop-detection
      RED-proven.** Fixture:
      `internal/bench/council-synthesis/majority-laundering.json`, carrying
      `permanent: true` (the loader **throws** on anything else), one correct
      minority (`member-d`) against **three** plausible-but-wrong majority
      answers, each recording its own `why_wrong` so a later reader can check
      the plausibility rather than take it on trust. Ground truth is a property
      of the fixture by construction: an index changes per-query cost, not query
      count, so the N+1 is not fixed by indexing.
      Gate: `src/scripts/ai_council/minority_retention.ts` —
      `auditMinorityRetention` decides three text-answerable questions: does the
      synthesis NAME the minority (an anchor phrase, matched tolerantly so
      `eager load` catches `eager loading`), does it state a DISPOSITION, and is
      a REASON attached to it. Accept and reject are **both** passes; the
      failure 5.3 names is the silent drop.
      Tests: `tests/scripts/ai_council/minority_retention.test.ts` (12 tests,
      green). Six scripted synthesizers, **zero model calls** — a majority-only
      laundering synthesis, an elaborate drop that discusses indexes at length
      and never the minority, an accept-with-reason, a reject-with-reason, a
      mention-without-disposition and a bare-disposition.
      **Honest scope, said out loud rather than implied.** The gate decides the
      SHAPE of the disposition, never its correctness. A synthesis that rejects
      the correct minority with a stated reason **passes** and is wrong — that
      is deliberate, because grading the verdict needs the benchmark, which is
      gated behind `blocker: phase-2-benchmark-cost`. The module header says so
      in the same words.
      **Why a hand-written fixture is legitimate here and refused for the
      leakage bench.** `internal/bench/council-provider-leakage/smoke-items.json`
      is refused by its live runner because a recognition rate over hand-written
      bodies would describe the fixture author rather than a model. Nothing is
      being estimated about a model here: the correct answer is a property of
      the fixture, so a synthesizer that drops it is caught deterministically.
      The fixture states this distinction in its own
      `why_hand_written_is_legitimate_here` field so the two cannot be conflated
      by a later reader.
      **Sensitivity was proven, not assumed.** Sabotage A — disabling the
      no-anchor early return in `auditMinorityRetention` — turned it RED
      (2 failed / 10 passed). Sabotage B — forcing both return sites to
      `passed: true`, i.e. neutralising the gate entirely — turned it RED
      (**5 failed / 7 passed**); restore → 12/12. The suite also tests the
      **denial**: `anchorPresent` must NOT match an unrelated sentence, so a
      `minority-silently-dropped` verdict means "absent" rather than "the
      matcher is broken".
- [ ] 5.4 Final synthesis retains unresolved disagreement, the strongest
  minority evidence, and what evidence would resolve it.
      verify: a run with real dissent renders all three

      **NOT CLOSABLE, and drain run 12 (2026-08-31) establishes why in two
      independent ways rather than one — recorded so the next run does not
      re-derive it.**

      **(i) No synthesis template asks for any of the three.** Four templates
      exist and all four are silent: `DEFAULT_SYNTHESIS` (`prompts.ts:284`),
      `PR_SYNTHESIS` (`:315`), `ANALYSIS_SYNTHESIS` (`:342`),
      `CREATIVE_SYNTHESIS` (`:380`), selected by `synthesis_template(mode)`
      (`:462`) and consumed on both paths — member chairman at
      `council_cli.ts:1410-1419`, host render at `orchestrator.ts:1749-1788`.
      The three nearest sections are each a different thing:
      `### Clashes` / `### Conflicts` (`prompts.ts:291-293`, `:320-322`) state
      both sides of a disagreement but never whether it REMAINS unresolved — and
      `PR_SYNTHESIS` explicitly defers resolution rather than recording
      non-resolution (*"do not pick a winner here"*, `:322`);
      `### Outliers` (`:356-364`) asks for single-reviewer findings and is
      analysis-lens only, with nothing about STRENGTH; `### Kill criteria`
      (`:305-309`) falsifies the RECOMMENDATION, not the disagreement.
      **A correction made in the same run, recorded because the wrong version
      of it was nearly published.** The first form of this note claimed that
      `unresolved` / `would resolve` / `strongest minority` / `minority
      evidence` return **zero** hits across `src/scripts/ai_council/` and
      `tests/scripts/ai_council/`. They return **21**, and the true reading is
      sharper than the false one. Every hit is in a DIFFERENT surface:
      `argument_exhaustion.ts:32,72,100` treats an unresolved adversarial
      trigger as a blocker on stopping early, `information_gain.ts:63,129,225`
      scores it as a reason another call can still change the verdict, and
      `confidence_gate.ts:7,176` detects unresolved alternatives in a reply. So
      the concept of unresolved disagreement is **already modelled in this
      tree** — it simply never reaches the synthesis contract. `prompts.ts`
      itself carries **zero** of those four terms, and the only two matches
      inside the four templates' line range are *"the strongest converged
      point"* and *"the strongest consensus or must-fix line"* — which point at
      the majority, i.e. away from what 5.4 asks for.

      **(ii) The verify names a RUN, and no recorded run can serve it.** The
      corpus under `agents/runtime/council/` carries no chairman synthesis at
      all — every session record predates the chairman path or ran
      `chairman.mode: host`, so the field the step would be read against does
      not exist in any retained artefact. `--chairman-fields` does already append
      two mandatory trailing sections (`blind_review.ts:173-177`, wired at
      `council_cli.ts:1411-1412` and `orchestrator.ts:1761-1765`) — but they are
      `## Collective blind spot` and `## One-line verdict`, neither of which is
      one of this step's three.

      **The gap is content, not plumbing, and the plumbing carries a known
      trap.** `assert_synthesis_sections` (`prompts.ts:522`) with
      `REQUIRED_SYNTHESIS_SECTIONS` (`:501`) and `SynthesisRenderError` (`:493`)
      is the exact architectural precedent a 5.4 checker would extend, and its
      own docstring records why it has zero production call sites (`:511-521`):
      with no chairman the rendered body is the literal
      `*to be summarised by the host agent*` (`orchestrator.ts:1787`), so an
      unconditional checker reds every templated render. A second, smaller trap:
      the addendum uses `##` while every template section uses `###`, so a
      checker written against one shape will not see the other.

      **Nothing was built.** Adding three sections plus an auditor with no run
      able to exercise them is the population-of-zero shape this file refuses;
      the finding is recorded instead, and the step stays open on evidence.
- [-] 5.5 Revisit ADR-120 **only** on results — record keep / amend /
  supersede with the benchmark artifact pin and a revisit condition.
      verify: the ADR record cites the benchmark artifact, not this roadmap

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".

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
      **HALF DONE 2026-08-31 — the gate is RECORDED; the arms have not run, so
      the step stays open.** The verify clause has two halves and only the first
      is dischargeable today.
      **Half one, discharged:**
      `internal/bench/council-early-stop-promotion-PREREG.md`, registered
      2026-08-31. It fixes the four conditions as **conjunctive** (failing one
      is failing the gate, whatever the other three show), declares the margins
      and floors up front — 2 % absolute quality non-inferiority margin, 0 pp
      minority-rescue regression ceiling, ≥ 10 % call reduction with a band
      excluding zero, 0 pp majority-corruption increase — and inherits the
      trial-count floors and paired non-parametric statistics from
      `council-topology-promotion-stats-PREREG.md` rather than forking a second
      house style.
      **Verdict equivalence is excluded from the gate in the strongest form
      available:** an Iron Law block saying it may never be cited as evidence
      the gate passed, plus a *rendering* requirement — the figure appears under
      a `Context (not gate evidence)` heading, physically separated from the
      four conditions, carrying the sentence *"two wrong verdicts can be
      equivalent"* next to the number. The record also states the one direction
      in which the figure IS diagnostic (a **low** equivalence rate signals
      something material changed), so excluding it from the gate does not turn
      into pretending it is worthless.
      **Half two, NOT discharged and not claimable.** "Before the arms run" is
      satisfied trivially and honestly today: **neither arm can run.**
      `evaluateStop` (`argument_exhaustion.ts:82`) has zero production callers,
      so no round has ever stopped early, and `blocker: phase-2-benchmark-cost`
      records that the benchmark runner does not exist. The step therefore
      stays `[ ]` — the pre-registration is a precondition for the measurement,
      never a substitute for it, and the ordering is checkable in the git
      history rather than asserted.
      **No test ships with this and that is deliberate.** A pre-registration is
      a document; a test asserting a document contains its own headings would
      pin formatting, not the property. The property that matters — that the
      equivalence figure is never rendered as gate evidence — becomes testable
      when a report exists to render, which is the same run that closes this
      step.

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
- [-] 7.2 The selector returns an explainable record: topology, council task
  class, impact class, reason codes, estimated calls, estimated cost, latency
  band, evidence/policy source, fallback.
      verify: every field is populated on a real selection

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".
- [ ] <!-- roadmap-status: guarded-baseline --> 7.3 Keep the deterministic/probe path **above** council: a mechanism
  question resolvable by tree fact, schema, script or executable test never
  reaches topology selection.
      verify: a probe-resolvable fixture never enters the selector
      ```yaml
      guarded_baseline:
        category: future-mechanism
        scope: src/scripts/_lib/judgment_ladder.ts classifyLadder rung-0-before-rung-4 precedence
        command: npx vitest run tests/scripts/ai_council/probe_path_above_council.test.ts
        red_proof: sabotage run 2026-08-31 — two independent sabotages, 1 of 7 tests RED each, 7/7 GREEN after both restores
        sabotage_model: (A) moved the rung-4 detectContestedJudgment check ABOVE the rung-0 checks in classifyLadder, inverting the precedence; (B) added src/scripts/ai_council/__sabotage_selector.ts exporting selectTopology, so a selector exists
        recheck_when: src/scripts/ai_council/topology_selector.ts selectTopology
        discharged_ac: the fixtures are frozen and a probe-resolvable question provably never reaches the council rung, even when it also carries a contested-judgment phrase
        pending_ac: "never enters the selector" against a real selector — 7.2 is open, no topology_selector.ts exists, so nothing exercises the constraint at the selection layer
      ```

      **NOT closed: there is no selector to keep anything out of.** 7.2 is open
      and nothing in `src/` is named `topology_selector` or exports
      `selectTopology`. Closing on "the selector never saw it" when no selector
      exists would be the vacuity this file's § Prevented items exists to catch.
      **What IS discharged is the stronger half, one layer up.**
      `classifyLadder` (`src/scripts/_lib/judgment_ladder.ts:342`) checks rung 0
      **before** the rung-4 council signal (`:353-361` precede `:380-383`), so a
      probe-resolvable question never resolves to `council` at all — and a
      question that never reaches the council rung cannot reach a
      council-**internal** selector, whatever that selector turns out to be.
      **Fixtures, frozen:**
      `internal/bench/council-topology/probe-resolvable-fixtures.json`
      (`permanent: true`) — 8 probe-resolvable questions covering all four kinds
      the step names (tree fact, schema, script, executable test), 4 adversarial
      questions that carry BOTH a probe signal and a real contested-judgment
      phrase, and 4 contrast questions that genuinely resolve to rung 4.
      Test: `tests/scripts/ai_council/probe_path_above_council.test.ts`
      (7 tests, green), run with maximally permissive inputs (`halted: false`,
      `subagent_spawn: true`, `agentTeams: true`) so nothing but the precedence
      can explain a non-council verdict.
      **Non-vacuity is tested three ways, because "never reaches council" is
      trivially true if nothing does.** (1) Each adversarial fixture is asserted
      to fire `detectContestedJudgment` AND still resolve to `script`. (2) The
      contrast set is asserted to resolve to rung 4 / `council`. (3) The
      tripwire below.
      **The tripwire is machine-enforced, not a prose reminder.** One test scans
      `src/` for a file named `topology[_-]?selector` or any file exporting
      `selectTopology`, and asserts the result is **empty**. The day 7.2 lands a
      selector it goes RED — which is exactly when this baseline expires and the
      fixtures must be re-run against the real entry point. `recheck_when`
      carries the same path and symbol. **Since 2026-09-01 the dashboard reports
      no line for this record**: `guardedBaselineStaleness` decides a trigger by
      its path token, and reporting a record that is already decidable as *"not
      machine-checkable"* is the mirror of the failure that report exists to
      prevent. The path token is the machine check and the tripwire test is the
      broader one that also covers the symbol.
      **Sensitivity was proven twice, not assumed.** Sabotage A — moving the
      rung-4 contested check above the rung-0 checks — turned it RED (1 failed /
      6 passed), and specifically reddened the precedence assertion rather than
      the population one. Sabotage B — adding
      `src/scripts/ai_council/__sabotage_selector.ts` exporting `selectTopology`
      — turned the tripwire RED (1 failed / 6 passed). Both restored to 7/7; the
      probe file was deleted in the same command and is not in the diff. The
      suite also tests the **denial**: both tripwire predicates fire on
      constructed matches and stay silent on `selectChairman`, so an empty
      result means "absent" rather than "the scanner is broken".
      **A defect the FULL suite caught that the file-scoped run did not, fixed
      in the same change.** The tripwire originally scanned raw source, and the
      later-landed `replay_route.ts` — whose docstring says *"nothing in `src/`
      is named `topology_selector` or exports `selectTopology`"* — tripped it.
      A sentence ABOUT a symbol is not a declaration of it, and a gate that
      cannot tell them apart reddens on its own documentation. The scan now
      strips comments first, the denial set gained two rows pinning that
      direction (a `//` mention and a `/** */` mention must NOT match), and the
      sabotage was re-run afterwards to confirm the fix did not blunt it —
      still 1 failed / 6 passed with a real `selectTopology` export present.
- [-] 7.4 Deterministic policy first, interpretable features only: task class,
  impact, ambiguity type, configured provider diversity, model availability,
  historical benchmark slice, artifact size, cost ceiling, prior-run freshness,
  initial disagreement.
      verify: the policy is readable end-to-end without executing it

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".
- [-] 7.5 Shadow mode first: compute the proposed topology, execute current
  behaviour, record the counterfactual route.
      verify: shadow runs change no observable behaviour

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".
- [-] 7.6 Promote per task slice on benchmark evidence only — no global claim
  that debate is better.
      verify: each promotion names its slice and its evidence artifact

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".

## Phase 8 — Targeted cross-examination and scalable review

- [x] 8.1 Select a disputed finding, a conflicting pair, or a correct-looking
  minority claim, and ask focused rebuttal questions.
      verify: the cross-exam prompt names the exact disputed claim
      **DONE 2026-08-31 — "exact" is enforced at the byte level, not as a
      similarity score.** New mechanism: `src/scripts/ai_council/cross_exam.ts`
      (`selectCrossExamTarget`, `buildCrossExamPrompt`, `crossExamNamesClaim`).
      Tests: `tests/scripts/ai_council/cross_exam.test.ts` (13 tests, green).
      Composition only — nothing is dispatched, so zero paid calls.
      **The verify clause is discharged by a substring check on the ORIGINAL
      string.** `crossExamNamesClaim` is deliberately not a threshold: "exact"
      that tolerates a score is not exact, and the paraphrase is the failure
      mode — *"one reviewer questioned the index approach"* describes a dispute
      and gives the cross-examined model nothing to rebut. Both sides of a
      conflicting pair must be present when a pair was supplied. Tested against
      a claim carrying markdown headings, backticks, double quotes, embedded
      newlines and a forged `</untrusted_content id="deadbeef">` line — the
      whole multi-line string survives unmodified.
      **The claim is untrusted and is fenced, without being modified.** It
      reaches the prompt through `wrapUntrustedBlocks`
      (`src/scripts/_lib/untrusted_content.ts:155`) under a nonce, exactly as
      `build_peer_review_user_prompt` already does (`prompts.ts:932-942`);
      headings sit outside the fences, so a heading-shaped line inside a payload
      is data. Fencing wraps rather than rewrites, which is what lets it coexist
      with the verbatim obligation.
      **Selection order is argued, not arbitrary.** `conflicting-pair` >
      `disputed-finding` > `minority-claim`: a conflicting pair is the only kind
      where at least one side is definitely wrong, so the rebuttal has the
      highest information density; a lone disputed finding may resolve to "both
      partly right"; a correct-looking minority claim is last because the
      majority may simply be right. Ties break on claim id, so input order
      cannot change the pick, and an empty candidate set returns `null` rather
      than inventing a target.
      **Neutrality is preserved:** the prompt names the neutral label
      (`Response-A`) and the test asserts no provider or model name appears.
      **HONEST SCOPE: nothing calls this yet** — 8.5, which would stop on
      expected value, is gated behind `blocker: phase-2-benchmark-cost`.
      **Sensitivity was proven, not assumed.** Sabotage — replacing the fenced
      claim body with a paraphrase (`One reviewer disputed a claim about <first
      20 chars>…`) — turned the file RED (**4 failed / 9 passed**); restore →
      13/13. The suite also tests the **denial** twice: a hand-written
      paraphrased prompt and a truncated claim both FAIL `crossExamNamesClaim`,
      so a pass means the string is there rather than that the predicate is
      broken.
- [x] 8.2 Reviewer budget `k`: balanced assignment approaching O(N×k) rather
  than unconditional O(N²) for larger councils.
      verify: call count at N=8 is measured against both curves
      **DONE 2026-08-31 — measured arithmetically, zero paid calls.** New
      mechanism: `src/scripts/ai_council/reviewer_assignment.ts`, a seeded
      circulant assignment (`assignReviewers`) plus `costCurves` for the
      comparison. Tests:
      `tests/scripts/ai_council/reviewer_assignment.test.ts` (17 tests, green).
      **The shipped baseline, established before anything was designed.**
      `orchestrator.ts:1509-1560` gives **every** reviewer **every** other
      member's answer — N reviewers × (N−1) candidates. That is the
      unconditional quadratic, and at N=8 it is **56 reviewed pairs**.
      **The measurement at N=8, both curves side by side:**

      | k | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
      |---|---|---|---|---|---|---|---|
      | N×k (assignment realises exactly this) | 8 | 16 | 24 | 32 | 40 | 48 | 56 |
      | N(N−1) (unconditional) | 56 | 56 | 56 | 56 | 56 | 56 | 56 |

      k=3 is 24 of 56 — a 57 % reduction — and `k = N−1` reproduces the shipped
      all-pairs behaviour **exactly**, which is what makes it a safe default and
      what makes the row above arithmetic rather than a claim about a change
      nobody has made. The gap widens as intended: N=16 is 48 against 240, N=32
      is 96 against 992.
      **The construction earns the properties without a search.** Order members
      so provider families interleave, then let candidate `i` be reviewed by
      positions `i+1 … i+k` (mod N): no self-review (offsets start at 1), exact
      balance (every candidate reviewed exactly k times, every reviewer reviews
      exactly k — asserted for every N in 2..8 × every k in 1..N−1), and a seed
      replayable from the artefact, never `Math.random`, never `Date` — the same
      discipline `orchestrator.ts:1533-1543` states for its own shuffle.
      **A defect the seed test caught, recorded because it is not obvious.**
      The family interleave originally tie-broke on family **name**. Under the
      one-advisor-per-provider invariant every family has size 1, so every
      comparison is a tie and the whole council sorted alphabetically —
      discarding the seeded permutation and giving one assignment for every
      seed. Tie-breaking on input order (stable sort over the already-permuted
      buckets) fixes it and keeps the result a pure function of the input.
      **HONEST SCOPE: nothing calls this yet.** It is the assignment, not a
      wiring change; the orchestrator still does all-pairs. Wiring it changes
      what reviewers see and belongs behind Phase 2's evidence.
      **Sensitivity was proven, not assumed.** Sabotage — replacing the budget
      bound `d <= effectiveK` with `d <= n - 1`, so the budget is ignored and
      every assignment is all-pairs — turned the file RED (**4 failed / 13
      passed**); restore → 17/17.
- [x] 8.3 Preserve provider diversity in reviewer assignment where
  alternatives exist.
      verify: no candidate is reviewed only by same-family reviewers when a
      cross-family reviewer was available
      **DONE 2026-08-31 — and "available" had to be defined before it could be
      verified.** Same module and test file as 8.2.
      **The interleave alone does NOT deliver this, which is the finding.**
      Six members of family A and two of family B interleave to
      `A B A B A A A A`, whose tail is all one family. So a **repair pass**
      follows: any candidate whose reviewer set is entirely same-family is fixed
      by a **2-swap** with another candidate — exchanging one reviewer between
      two candidates leaves every reviewer's load and every candidate's count
      unchanged, so balance survives the repair by construction, and the tests
      re-assert both after it.
      **"Where alternatives exist" means available UNDER THE BALANCE
      CONSTRAINT, not merely "another family exists".** 6A/2B at k=1 gives eight
      candidates and only two B-reviewer slots, so **four A candidates must be
      reviewed within their own family and no assignment avoids it**. That bound
      is now computable — `diversityCeiling` — and the test asserts the
      assignment **attains** it for every N in 2..8 × every k in 1..N−1 over 2,
      3 and 4 families, and on the 6A/2B skew for every k. `diversityCeiling`
      is documented as an **upper** bound because reviewer capacity is shared
      across families; it was measured tight on 7 family profiles × every k, and
      is treated as a bound elsewhere.
      **Vacuous in production today, and the test says so rather than hiding
      it.** Under the one-advisor-per-provider invariant (`chairman.ts:16-18`)
      every member is its own family, so every reviewer is cross-family by
      construction and `diversityRepairs` is 0. The property is implemented and
      exercised against multi-member-per-family sets that only Phase 9's advisor
      fan-out would produce — the cheapest moment to have it is before it can be
      violated, which is the same argument 12.4 records for its own baseline.
      **Sensitivity was proven, not assumed.** Sabotage — short-circuiting the
      diversity repair loop with an unconditional `continue`, so only the
      interleave remains — turned the file RED (**3 failed / 14 passed**);
      restore → 17/17. The suite also tests the **denial**:
      `nonDiverseCandidates` flags a hand-built all-same-family assignment for
      which a cross-family reviewer *was* available, so an empty result means
      "no violation" rather than "the detector is broken".
- [x] 8.4 Score optional next calls by expected information gain per cost,
  deterministic and inspectable to start.
      verify: the score is reproducible from the recorded inputs
      **DONE 2026-08-31 — deterministic scorer, executable reproduction, zero
      paid calls.** New mechanism:
      `src/scripts/ai_council/information_gain.ts` (`scoreNextCall`,
      `recordNextCall`, `reproduceScore`, `rankByGainPerCost`,
      `renderNextCallScore`). Tests:
      `tests/scripts/ai_council/information_gain.test.ts` (17 tests, green).
      **Every feature is one the tree already computes.** The six gain terms
      read `DisagreementSignal` (`disagreement_signal.ts:134`), which 6.1
      established as zero-cost and structural — no new similarity measure, no
      new threshold, and no model call to decide whether to make a model call.
      Forking a second feature set would be the defect 1A.1 forbids for the
      question hash.
      **The verify clause is executable.** `reproduceScore` recomputes from a
      record's OWN inputs and compares under `JSON.stringify`; the tests assert
      it for a plain record and for one round-tripped through JSON. Every
      published figure is rounded to `SCORE_PRECISION = 6` and `-0` is
      normalised to `0`, so the round trip is bit-exact rather than
      nearly-exact.
      **Inspectable means the total re-derives by hand.** Each term carries its
      raw value, its weight, its direction-applied normalisation and its
      contribution; `renderNextCallScore` prints all of them plus the weight
      denominator, the trigger bonus, both cost divisions and the component
      count. A test sums the printed contributions and reproduces the gain.
      **An unavailable component is dropped from BOTH numerator and
      denominator, never read as 0.** Reading it as 0 would turn "not measured"
      into "measured, and it showed agreement" — the NOT-RUN-is-not-a-null
      failure this file records elsewhere. A signal with nothing observable
      returns `gain: null`, and a test asserts `null !== 0` against a
      fully-agreeing signal that legitimately scores 0.
      **HONEST SCOPE, three parts.** (a) It scores; it does not decide — 8.5 is
      gated behind `blocker: phase-2-benchmark-cost`. (b) The weights are
      **declared priors, not fitted values**; the module carries the
      `revisit-if` (the Phase 2 benchmark shows a term that does not predict a
      changed finding, or one that does and is missing). (c) `reproduceScore`
      catches non-determinism and a tampered record; it **cannot** catch a
      deterministic change to the scorer itself, because both sides run the same
      code — the round-trip is a reproducibility check, not a regression pin.
      **Sensitivity was proven, not assumed.** Three sabotages, each restored to
      17/17: (A) removing the rounding in `roundScore` — RED, 1 failed / 16
      passed; (B) adding a `Date.now() % 7` term to the trigger bonus — RED,
      3 failed / 14 passed; (C) forcing `weightUsed = 1` so an unavailable term
      is effectively read as zero — RED, 1 failed / 16 passed.
      **A weakness the sabotage run exposed, and the fix that shipped with it.**
      Sabotage B initially reddened only two *arithmetic* tests and left the
      "repeated calls give byte-identical output" test **green** — five calls
      inside one millisecond see a constant `Date.now() % 7`, so repetition
      cannot prove purity. A source-level purity gate was added in the same
      change (the module must contain no `Date.`, `Math.random`, `hrtime`,
      `performance.now`, `node:fs` or `fetch(`), and it is what catches the
      clock dependency deterministically. Both tests ship; the comment in the
      test file records why.
- [-] 8.5 Stop when the next call has low expected value — call-level
  extension of argument exhaustion, only after benchmark evidence exists.
      verify: the stop is gated on the Phase 2 artifact, not on intuition

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".

## Phase 9 — Advisor composition after seating

The five personas exist and are shipped (see § Prevented items). The real gap
is **seating**, and it already has a carrier.

- [-] 9.1 Add the same-provider host-subagent fan-out lane **only** as a
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

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".
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
- [-] 9.4 After seating is solved, benchmark governed bundles (architecture /
  code review / roadmap / product) chosen from tracked persona definitions
  only, with persona and provider assignment counterbalanced.
      verify: a "persona won" result cannot be explained by "provider won"

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".

## Phase 10 — Outcome attribution and observability

- [ ] <!-- roadmap-status: guarded-baseline --> 10.1 Extend decision replay (`ai_council/replay.ts`) with: ladder council
  resolution, council-internal topology, initial route, escalation, stage
  outputs, stop reason, synthesis policy, cost, latency, final verdict.
      verify: a replayed run reproduces the recorded route
      ```yaml
      guarded_baseline:
        category: future-mechanism
        scope: src/scripts/ai_council/replay_route.ts CouncilRouteRecord + renderRouteSection/parseRouteSection
        command: npx vitest run tests/scripts/ai_council/replay_route.test.ts
        red_proof: sabotage run 2026-08-31 — 5 of 13 tests RED, 13/13 GREEN after restore
        sabotage_model: three simultaneous edits — auditRouteRecord reporting councilInternalTopology as `populated`, withRouteSection appending a heading even for a null record, and parseRouteSection hard-coding latencyMs to 0
        recheck_when: src/scripts/ai_council/topology_selector.ts
        discharged_ac: ten of eleven fields are populated and the render→parse→compare round trip is exact and RED-proven
        pending_ac: "council-internal topology" — the field is typed `null` and only `null` because no selector exists, so the record cannot describe a topology decision that is never made; and no real council run has been replayed through it
      ```

      **CANNOT CLOSE WHOLE, for one structural reason.**
      `councilInternalTopology` is typed `null` **and only `null`**: 7.2 is open,
      nothing in `src/` is named `topology_selector` or exports `selectTopology`,
      so any value in that field would be invented. `auditRouteRecord` reports it
      as `structurally-unavailable` — a third state, distinct from both
      `populated` and `missing`, because "the tree cannot produce this" and "the
      caller did not supply it" are different claims and collapsing them is the
      failure the record exists to prevent.
      **What shipped:** `src/scripts/ai_council/replay_route.ts`, carrying the
      other ten fields the step enumerates — ladder resolution (rung, verdict,
      reason), initial route, escalation (with `from`/`to`), stage outputs
      (per-stage produced + calls), stop reason, synthesis policy (the 5.1
      strategy id), cost calls, cost USD, latency, final verdict. Tests:
      `tests/scripts/ai_council/replay_route.test.ts` (13 tests, green).
      **The verify clause is discharged at the artefact layer.**
      `replayReproducesRoute` renders, parses and compares under
      `JSON.stringify`, exercised over two shapes — escalated/completed and
      stopped/unescalated/host-synthesis. USD renders at fixed 4-decimal
      precision so the comparison is exact rather than approximate. A `null`
      `stopReason` round-trips as *"ran to completion"* and a `null`
      `synthesisPolicy` as *"host synthesis"*, both distinguished from an absent
      key. **What is NOT discharged is a real run**: no council session has been
      replayed through this record, which is the other half of the pending
      criterion.
      **`replay.ts` is untouched, and that is deliberate.** It is a py2ts parity
      port whose header pins Python-mirroring behaviour down to round-half-to-even
      float formatting and a trailing `rstrip()`; interleaving new sections into
      its renderer would put every one of those notes at risk for a purely
      additive feature. `withRouteSection(body, null)` returns the body
      **byte-identical**, and a test asserts it against a real
      `render_decision_replay` output rather than assuming it.
      **Sensitivity was proven, not assumed.** A three-part sabotage —
      `auditRouteRecord` reporting `councilInternalTopology` as `populated`,
      `withRouteSection` appending a heading even for a `null` record, and
      `parseRouteSection` hard-coding `latencyMs` to 0 — turned the file RED
      (**5 failed / 8 passed**); restore → 13/13. The suite also tests the
      **denial**: a section with one corrupted cost figure must NOT round-trip,
      and a section with no cost line must parse to `null`, so a passing
      round trip means the fields survived rather than that the parser is
      permissive.
- [ ] 10.2 Attribute each useful correction to the first stage where it
  appeared.
      verify: one real run yields a per-correction stage attribution

      **NOT CLOSABLE — measured 2026-08-31 (drain run 12), recorded so the next
      run does not re-derive it.** The target vocabulary EXISTS and has no
      producer: `StageOutput { stage, produced, calls }`
      (`ai_council/replay_route.ts:49-54`) is carried on `CouncilRouteRecord`
      (`:74`), and the module's only importer anywhere is its own test
      (`tests/scripts/ai_council/replay_route.test.ts:21-22`). Nothing in
      `council_cli.ts` or the orchestrator constructs a `CouncilRouteRecord`, so
      the field is a declared shape with nothing to fill it — which is the same
      structural gap 10.1's `guarded-baseline` records from the other side.
      Separately, **nothing anywhere identifies a "useful correction" as an
      object**: `correction` appears twice under `src/scripts/ai_council/`, once
      in a comment (`cli_least_agency_canary.ts:33`) and once inside a prompt
      string (`cross_exam.ts:66`); every `attribut*` hit is SPEND attribution
      (`cli_call_budget.ts:29,63,195,239,262`), not stage attribution. The only
      stage machinery in the tree is design-time ablation in the bench manifest
      (`topology_bench_manifest.ts:239-240`, `:391-440`), which attributes an ARM
      to a stage and is gated behind `blocker: phase-2-benchmark-cost`.
- [ ] 10.3 Track paid calls that change no finding, stance, confidence,
  evidence, or final decision; emit `zero_marginal_value_call_rate`.
      verify: the rate is emitted and is non-null on a real run

      **NOT CLOSABLE, and this step is stricter than its Phase-10 siblings —
      measured 2026-08-31 (drain run 12).** The metric does not exist in any
      form: `zero_marginal|marginal_value|marginalValue|zmv` returns **zero**
      hits across `src/` and `tests/`; the only occurrences in the repository
      are this step and the acceptance criterion that names it. There is no
      emitter and no budget entry (the precedent shape being
      `src/config/quorum-attendance-budget.json`).

      **The 10.5 escape hatch is closed by this step's own verify, and that is
      the load-bearing point.** `recouncil_savings.ts` established the accepted
      pattern for a Phase-10 metric over the retained corpus: reconstruct what
      is recoverable and emit `null` — never `0` — where no mechanism records the
      fact (`RecouncilSavings.duplicates_prevented`, `reruns_confirmed`,
      `spend_saved_usd` are all typed `null`). 10.3 says *"non-null on a real
      run"*, so that route is unavailable here by construction.

      **And the corpus could not supply a non-null numerator anyway.** A
      zero-marginal-value rate needs a per-call before/after over findings,
      stances, confidence or the final decision. Of 118 retained response
      records under `agents/runtime/council/`, **0** carry a `consensus` block
      (so no findings and no scores), 11 carry `peer_review` with no stage label
      and no call count of its own, stances are persisted as booleans only
      (`council_cli.ts:2770-2771`), `stance_tally.ts:14`'s `Confidence` is never
      serialised, and **no `decision-replay.md` has ever been written** — the
      writer is gated on `consensus !== null` (`council_cli.ts:1272-1274`). A
      rate computed over that corpus today would have a numerator with no
      observable events, which is the exact `null` this step forbids.

      **Nothing was built.** An emitter with no producer for its inputs and no
      run able to exercise it is a population-of-zero mechanism; the step stays
      open on evidence rather than acquiring a shape-pin that would measure
      nothing.
- [-] 10.4 Compute route regret offline against the cheapest topology with an
  equivalent-quality outcome.
      verify: the comparison runs offline and never influences a live route

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".
- [x] 10.5 Track re-council savings: duplicates prevented, near-duplicate
  warnings, reruns intentionally confirmed, spend saved.
      verify: the figures reconcile against the retained artifacts
      **DONE 2026-08-31 — the figures reconcile, and three of the four are
      `null` because nothing in the tree can produce them.** New mechanism:
      `src/scripts/ai_council/recouncil_savings.ts` (offline, no provider call,
      no writes), replaying the shipped guard's own detector over the retained
      corpus. Full write-up with the reproduce command, the corpus caveats and
      the pair table: `agents/evidence/analysis/recouncil-savings-reconstruction-2026-08-31.md`.
      **Measured 2026-08-31 on the maintainer checkout** (`agents/runtime/` is
      gitignored and machine-local, so these are not clone-reproducible; the
      command regenerates them where the corpus exists): 355 retained `*.md`
      questions, 355 distinct sha256, **0 exact repeats**; **2 near-duplicate
      pairs** at the pre-registered 0.80 (`recouncil_guard.ts:50` aliasing
      `MERGE_THRESHOLD` at `src/scripts/_lib/text_similarity.ts:19`), covering
      4 questions; 62 response artefacts admitted as prior runs of 85 `.md`
      candidates, of which only **45 name a question file that still resolves**
      (43 distinct); and the guard **would have flagged 0**.
      **The zero reconciles rather than contradicting the two pairs.**
      `readPriorRuns` (`recouncil_guard.ts:102`) reads the responses directory
      non-recursively, so its text-comparable reach is 43 of 355 retained
      questions (12.1 %), and neither member of either pair has a retained
      response artefact pointing at it. Both pairs are round-1/round-2 of one
      deliberation sharing a ~34 KB standing-context preamble — true
      near-duplicates by text, correct re-councils by intent, which is exactly
      why 1A.2 makes the guard warn and never block.
      **Three figures are `null`, not `0`, and that is the load-bearing part.**
      `warnIfRecounciled` (`recouncil_guard.ts:267`) returns `void` and writes
      only to an injected sink (`:273` declares it, `:289` is the only call), so
      no warning, abandonment or confirmation is persisted anywhere. *Duplicates
      prevented*, *reruns intentionally confirmed* and *spend saved* therefore
      have no data behind them; `0` would assert a measured absence. **No spend
      figure was estimated** — a dollar amount needs a prevented run, and
      inventing one from "pairs × average price" is arithmetic worn as evidence.
      **Second limit, printed with every figure rather than footnoted:** the
      denominator is accidental. `SAVINGS_LIMITS` in the module carries both,
      and `renderSavings` prints them under the table.
      **Sensitivity was proven, not assumed.**
      `tests/scripts/ai_council/recouncil_savings.test.ts` (15 tests, green).
      Sabotage A — replacing the three `null` initialisers with `0` in
      `computeSavings` — turned it RED (2 failed / 13 passed); restore → 15/15.
      Sabotage B — deleting the `a.sha256 === b.sha256` guard in
      `nearDuplicatePairs`, so exact repeats double-count as near duplicates —
      turned it RED (2 failed / 13 passed); restore → 15/15. Neither sabotage
      file survives the diff. The suite also tests the **denial** (two unrelated
      texts yield no pair), so a zero pair count means "nothing there" rather
      than "the detector is broken".
- [ ] <!-- roadmap-status: guarded-baseline --> 10.6 Track early-stop savings separately from quality.
      verify: cost and quality are never reported as one number
      ```yaml
      guarded_baseline:
        category: future-mechanism
        scope: src/scripts/ai_council/argument_exhaustion.ts StopRender + renderStop
        command: npx vitest run tests/scripts/ai_council/early_stop_savings_shape.test.ts
        red_proof: sabotage run 2026-08-31 — 4 of 11 tests RED, 11/11 GREEN after restore
        sabotage_model: three simultaneous edits — a src/scripts/ai_council/__sabotage_10_6.ts importing evaluateStop (production caller), a `qualityScore: number` field on StopRender, and renderStop's saved line rewritten to `call(s) at qualityPerCost`
        recheck_when: evaluateStop-gains-a-production-caller
        discharged_ac: the separation is pinned and RED-proven in the only surface that exists — StopRender carries cost fields and no quality field, and renderStop emits calls and cost as two figures with no blended term
        pending_ac: "tracked separately" under a real early stop — no run has ever stopped early, because evaluateStop has zero production callers, so the savings figure itself is structurally 0 and nothing exercises the constraint under live reporting
      ```

      **NOT closed, and the reason is arithmetic rather than judgement.**
      `evaluateStop` (`src/scripts/ai_council/argument_exhaustion.ts:82`) has
      **zero production callers** — across `src/`, the module is imported by
      nothing; its only importer in the repo is
      `tests/scripts/argument_exhaustion.test.ts:19`. No council round can stop
      early, so no call has ever been saved and the tracked figure would be a
      number about nothing. Reporting `0` saved calls as a measurement is the
      NOT-RUN-is-not-a-null failure this file records repeatedly; the state that
      says so is `guarded-baseline`, and this is its second instance.

      **What IS discharged.** The reporting surface the savings would land in
      already exists (`StopRender` at `:113`, `renderStop` at `:121`), so its
      shape is pinnable now — the cheapest moment, before a caller lands.
      `tests/scripts/ai_council/early_stop_savings_shape.test.ts` (11 tests,
      green) asserts: `StopRender` declares only `roundsCompleted`,
      `roundsConfigured`, `savedCalls`, `savedCostUsd`, `exhaustedMembers` —
      cost and provenance, no quality field to blend; `renderStop` emits
      `saved: 4 call(s), $0.1234`, two figures a reader can take apart; and
      neither the rendered text nor the module's declared identifiers contain a
      quality term (`quality`, `score`, `grade`, `accuracy`, `correctness`,
      `nonInferior`) or a blended metric (`qualityPerCost`, `perDollar`,
      `costAdjusted`, …). 6.4's `STOPPED EARLY` / `NOT a full run` lines are
      re-pinned here so a 10.6 edit cannot quietly undo them.

      **The recheck is machine-enforced, not a prose reminder.** One test
      asserts the importer set of `argument_exhaustion.ts` under `src/` is
      **empty**. The day Phase 6 wires the predicate into a council round, that
      test goes RED — which is exactly when this baseline stops being sufficient
      and the separation must be re-verified against a live report. The
      `recheck_when` field above is a bare symbol and the dashboard correctly
      reports it as **not machine-checkable**; the test is the check.

      **Sensitivity was proven, not assumed.** A three-part sabotage —
      a temporary `src/scripts/ai_council/__sabotage_10_6.ts` importing
      `evaluateStop`, a `qualityScore: number` field on `StopRender`, and
      `renderStop`'s saved line rewritten to `call(s) at qualityPerCost` —
      turned the file RED (**4 failed / 7 passed**); restoring gave 11/11. The
      probe file was deleted in the same command and is not in the diff.

      **One honest gap in the sensitivity, stated because the run showed it.**
      The `StopRender carries only cost figures` test builds its object from a
      hand-written literal, so adding a field to the *interface* did not turn
      that particular test red — the source-text test caught it instead. A
      structural-type assertion would be stronger; the pair is what shipped, and
      the gap is named rather than left for a later reader to discover.

## Phase 11 — Learned routing as a challenger only

- [ ] <!-- roadmap-status: guarded-baseline --> 11.1 Collect offline training rows from benchmark and dogfood evidence
  only, without requiring raw private prompt content.
      verify: the row schema has no field capable of holding prompt text
      ```yaml
      guarded_baseline:
        category: absence-assertion
        scope: src/scripts/ai_council/routing_training_row.ts RoutingTrainingRow + ROW_FIELDS
        command: npx vitest run tests/scripts/ai_council/routing_training_row.test.ts
        red_proof: sabotage run 2026-08-31 — 3 of 13 tests RED, 13/13 GREEN after restore
        sabotage_model: added `readonly promptText: string;` to the RoutingTrainingRow interface
        recheck_when: internal/bench/council-routing/training-rows.jsonl
        discharged_ac: the verify clause — no field of the schema can hold prompt text, proven in two layers and RED-proven
        pending_ac: "collect" — no row has been collected, and the benchmark half of the evidence does not exist (blocker phase-2-benchmark-cost)
      ```

      **The verify clause is DISCHARGED; the step is NOT.** 11.1 has two halves
      and only one is buildable today. *"Collect offline training rows from
      benchmark and dogfood evidence"* cannot start: `blocker:
      phase-2-benchmark-cost` records that
      `src/scripts/ai_council/topology_bench_manifest.ts` `main()` only
      `--emit`s JSON and contains no provider dispatch, so there is no benchmark
      evidence to collect from. **No row exists and none is claimed.**
      **What shipped is the schema, and its privacy property is structural.**
      `src/scripts/ai_council/routing_training_row.ts` — every field is an
      integer, a boolean, or an enum over a declared closed set. There is no
      `payload`, `notes`, `extra`, `context`, `promptText`,
      `Record<string, unknown>` or `unknown`-typed field. A row that **cannot**
      hold a sentence has no scrubber to forget to run, which is the same
      PII-exclusion-by-construction principle `domain-safety-pii` § Surface 2
      applies to logs and `artifact-engagement-recording` applies to telemetry.
      **Two layers, because one is not enough.** (1) `auditRowSchema` walks a
      row against the `ROW_FIELDS` manifest and rejects any undeclared field,
      any value outside a declared enum, and any non-integer in a numeric field;
      `serialiseRow` **throws** rather than emitting a row that failed it.
      (2) A source-level gate in the test greps the interface body for
      `: string;`, `: any;`, `: unknown;`, `Record<string, …>` and an index
      signature, plus nine free-text field names — because the manifest cannot
      see a field somebody adds to the interface and forgets to declare.
      A third guard closes the disguise: an enum value longer than
      `MAX_ENUM_VALUE_LENGTH = 40` is rejected, so a "closed set" containing a
      paragraph is caught.
      **The enums are the tree's own, not forked copies** — `topology` is
      identically `COUNCIL_TOPOLOGIES` (asserted by reference, not by value, so
      a fork reds), and `IMPACT_CLASSES` mirrors `necessity.ts:545-550`.
      `evidenceSource` admits exactly `benchmark | dogfood`, so a
      production-transcript row is rejected by the validator rather than by
      convention.
      **Sensitivity was proven, not assumed.**
      `tests/scripts/ai_council/routing_training_row.test.ts` (13 tests, green).
      Sabotage — adding `readonly promptText: string;` to the interface —
      turned it RED (**3 failed / 10 passed**); restore → 13/13. The suite also
      tests the **denial** five ways (an undeclared field, an arbitrary string
      in an enum slot, a non-integer, a missing field, and a constructed
      interface violation the source gate must catch), so a clean pass means
      "no free-text field" rather than "the gates are broken".
      **`recheck_when` is a real path**
      (`internal/bench/council-routing/training-rows.jsonl`): the day rows
      start being written, the dashboard marks this evidence STALE and the
      schema must be re-verified against what was actually collected.
- [-] 11.2 Train an offline challenger classifier; it stays shadow-only.
      verify: no runtime path can reach the model

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".
- [-] 11.3 Promotion requires a material Pareto improvement in
  quality/cost/latency plus acceptable stability.
      verify: the comparison against the deterministic policy is published

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".
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
- [-] 11.5 Relevant model-generation changes mark affected routing evidence
  stale.
      verify: a simulated model-generation bump invalidates the right slices

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".

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
      a guess and is machine-checkable; the symbol is not. **Corrected
      2026-09-01:** the report no longer marks this record *"not
      machine-checkable"*, because its path token already decides staleness —
      the unchecked-companion-symbol line was noise on a decidable record, and
      that noise sat in the same section as the one genuinely undecidable trigger
      in the estate (10.6). Absence of a check is still reported as absence,
      never as a pass — it is now reported only where the check is genuinely
      absent, i.e. where the trigger carries no path token at all.
- [ ] <!-- roadmap-status: guarded-baseline --> 12.2 Add a free explain mode: why task-side orchestration resolved to
  council, which topology would run, estimated spend and calls, evidence
  source — with no paid model call to explain routing.
      verify: explain mode issues zero provider calls
      ```yaml
      guarded_baseline:
        category: future-mechanism
        scope: src/scripts/ai_council/explain_route.ts explainRoute + renderRouteExplanation
        command: npx vitest run tests/scripts/ai_council/explain_route.test.ts
        red_proof: sabotage run 2026-08-31 — 6 of 15 tests RED, 15/15 GREEN after restore
        sabotage_model: three simultaneous edits — an `import { consult } from './orchestrator.js'`, TOPOLOGY_UNAVAILABLE replaced by the literal `peer_review`, and the non-billable early return deleted so a subscription seat is priced at API rates
        recheck_when: src/scripts/ai_council/topology_selector.ts
        discharged_ac: the zero-provider-call property is structural and RED-proven, and three of the four fields are answered
        pending_ac: "which topology would run" — unanswerable while no selector exists, so the field carries an explicit unavailable marker rather than a value
      ```

      **CANNOT CLOSE WHOLE — one of the four fields is unanswerable.** *"Which
      topology would run"* has no answer: 7.2 is open, no selector exists, and
      naming a topology would be a guess dressed as an explanation. The field is
      **present and marked** (`TOPOLOGY_UNAVAILABLE` = *"unavailable — no
      topology selector exists (step 7.2 open)"*) rather than omitted, because a
      field silently missing from an explanation reads as *not applicable* when
      the truth is *not built yet*. A test asserts the rendered output names
      none of the seven topology names.
      **What shipped:** `src/scripts/ai_council/explain_route.ts` —
      `explainRoute`, `estimateSpend`, `renderRouteExplanation`. Tests:
      `tests/scripts/ai_council/explain_route.test.ts` (15 tests, green).
      **The verify clause is discharged STRUCTURALLY, which is stronger than a
      promise.** The module imports exactly two things —
      `../_lib/judgment_ladder.js` (regex-only) and `./pricing.js` (arithmetic
      over a price table) — and the test asserts that distinct import set
      exactly, plus the absence of `clients.js`, `transport`, `orchestrator`,
      `consult`, `fetch(` and `node:https` from the module's **code** (comments
      stripped, since the docstring names the very words the gate forbids). Both
      dependencies are separately asserted free of `fetch(` and `node:http(s)`.
      There is nothing here to make a call with.
      **Field 1 — why it resolved to council:** the full `explainLadder`
      (`judgment_ladder.ts:499`) per-rung trail, with each rung's own status
      (`taken` / `rejected` / `not-reached`) and the detector's own reason. It
      explains a NON-council resolution equally well, so it is a routing
      surface rather than a council-only one.
      **Field 3 — estimated spend and calls:** one call per member per round,
      priced from the table. The subscription-seat distinction `pricing.ts`
      records finding on 2026-08-27 is preserved rather than reproduced: a
      non-billable seat contributes **calls** and **zero dollars**, is listed by
      name in `nonBillableMembers`, and renders with *"calls are real, spend is
      not"* next to the zero. An unpriced model estimates $0 via pricing.ts's own
      fallback rather than throwing.
      **Field 4 — evidence source:** defaults to `none` and is **rendered**
      rather than omitted, which is the same reasoning as field 2.
      **Sensitivity was proven, not assumed.** A three-part sabotage — adding
      `import { consult } from './orchestrator.js'`, replacing
      `TOPOLOGY_UNAVAILABLE` with the literal `peer_review`, and deleting the
      non-billable early return so a subscription seat is priced at API rates —
      turned the file RED (**6 failed / 9 passed**); restore → 15/15. The suite
      also tests the **denial**: the import scanner is shown to extract
      `./orchestrator.js` from constructed text and to find neither it nor
      `orchestrator` in the real module.
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

- [-] 13.1 Shadow: no behaviour change; record proposed topology and
  counterfactual evidence.
      verify: behaviour diff against the pre-phase baseline is empty

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".
- [-] 13.2 Advisory: permit cheaper depth reductions only where
  non-inferiority is demonstrated; no auto-escalation into more expensive
  topology yet.
      verify: no run costs more than today's default under advisory mode

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".
- [-] 13.3 Adaptive: enable escalation and early stop on slices that pass
  holdout gates.
      verify: each enabled slice names its holdout artifact

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".
- [-] 13.4 Default-on per slice only, on: quality non-inferiority or
  improvement, acceptable cost/latency, stable parse/gradeability, no material
  minority-rescue regression, judge-bias metrics within threshold, no weakening
  of user or spend boundaries.
      verify: all six conditions are recorded per slice before the flip

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".
- [-] 13.5 Re-evaluate on model-generation changes — evidence is not timeless.
      verify: a stale-evidence slice blocks its own default-on state

      **`[-]` DEFERRED 2026-09-01 (drain run 12) by AI council verdict A3,
      convergent 2/2 — NOT cancelled and NOT satisfied.** This step is gated on
      `blocker: phase-2-benchmark-cost`, whose frozen schedule needs 20
      consecutive UTC days of exclusive capacity across the only two configured
      seats and, at `N=2`, clears neither of step 2.6's pre-registered `n >= 5`
      / `n >= 10` floors. Spend was pre-authorised; capacity and wall-clock were
      not. The design, the frozen manifest, the missing-runner requirement and
      the resumption trigger are carried in
      [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md).
      **Nothing here may be read as evidence:** the council forbids claiming
      that topology effects were benchmarked, that any topology is superior,
      that topology-driven promotion is supported, or "we tested it at N=2".

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

  **AMENDED 2026-08-31 — the cause IS now established, and the hypothesis above
  is moot.** Additive; the original text is left standing because a superseded
  hypothesis is part of the audit trail. Established in one reference sweep, at
  the commit that lands step 10.5:
  (a) `prune_all_council_artifacts` (`src/scripts/ai_council/session.ts:468`)
  has exactly **one** caller — `src/scripts/council_prune.ts:131`, behind the
  manual `task council-prune` (`taskfiles/content.yml:384`);
  (b) the auto-prune inside `save()` (`session.ts:604`, reached from `save()` at
  `session.ts:506`) has **no production caller at all** — `session.ts` is
  imported by exactly two files in the repo,
  `src/scripts/council_prune.ts:36` (which imports `_load_retention_days` and
  `prune_all_council_artifacts`, **not** `save`) and
  `tests/scripts/ai_council/session.test.ts:18`, while the live writer
  `src/scripts/council_cli.ts:224` never imports it. **This supersedes the
  divergent-root hypothesis**: the pruner is not reached from *any* root, so
  which root it would have resolved never arises;
  (c) `janitor.ts:57-59` declares the same directory at `ttlDays: 7` and is
  bound only to the manual `task janitor` / `task janitor-apply`
  (`taskfiles/content.yml:388,392`) — no hook, no workflow, no `task ci` path.
  **No reaper runs**, and the measurement matches: on 2026-08-31, **764 of 798**
  files under `responses/` and **326 of 357** top-level entries under
  `questions/` carry mtimes older than the declared 7-day TTL. The retention
  quarantine the successor entry requires therefore stands on a settled
  diagnosis rather than an open one; the defect itself is **diagnosed, not
  repaired** — wiring a reaper touches the council write path and belongs in its
  own change. Detail:
  `agents/evidence/analysis/recouncil-savings-reconstruction-2026-08-31.md`.
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

- **Status:** resolved 2026-09-01 (drain run 12) — **DESCOPED by AI council
  verdict. No measurement was taken and none is claimed; the NOT RUN state both
  predecessor entries protected is preserved in force, and every floor stands.**
  Steps 3.3 and 3.4 are `[-]` and point at
  [`stubs/road-to-provider-leakage-bench-execution.md`](stubs/road-to-provider-leakage-bench-execution.md),
  which carries the design, the pattern list, the execution sequence, the
  4-conjunct 3.4 close condition and the single claim the result may ever make.

  **The council verdict was B1, and the disposition applied is B3 under the
  council's own named fallback — this is not an override.** AI council
  2026-09-01, members anthropic (claude-sonnet-4-5) and openai (codex-default),
  2 rounds, blind chairman, subscription transport (`billable=0`, `$0.0000`),
  quorum `2/2 present, needed 1 — concluded`. Both seats chose B1 — build the
  runner, execute both arms — and both attached the same hard precondition:
  anthropic, *"both arms in one coherent session, or neither"*, with partial
  results declared INVALID on mid-execution degradation; openai, *"if the
  autonomous drain cannot remain active across two future UTC boundaries, B1 is
  not a real terminal disposition. In that case, choose B3 immediately rather
  than recording an execution commitment the run cannot fulfill."*

  **The precondition fails on arithmetic, not judgement.** Each arm is 30 calls
  per provider; both arms is 60 against a hard cap of 50 per provider per UTC
  day (`src/scripts/ai_council/cli_call_budget.ts:60`), so the arms cannot share
  a day, and consecutive days require one coherent session across a UTC
  boundary that this run cannot guarantee. B3 is therefore the disposition the
  council pre-authorised for exactly this state.

  **One fact in the entry below had gone stale and is corrected here rather
  than left to mislead.** The `What to do` field says fork 3's pattern list is
  *"DEFERRED and deliberately absent"* and that *"the stripped arm therefore
  cannot run"*. Both clauses are now false: `src/scripts/ai_council/leakage_patterns.ts`
  exists (453 lines), is version-pinned `leakage-patterns-v1-2026-08-31`,
  carries `PATTERN_LIST_DIGEST`, pins `ARM_LABEL = 'pattern-stripped'` and
  asserts the labels condition 6 forbids. Both arms are design-complete. What
  remains unbuilt is the **runner**: `collectGuesses`
  (`src/scripts/ai_council/provider_leakage_bench.ts:90`) and `scoreRecognition`
  (`:136`) have zero production callers outside
  `tests/scripts/ai_council/provider_leakage_bench.test.ts`.

  The historical record below is kept unedited, because it is what was true
  when it was written.

  **Superseded status line:** open — **created 2026-08-31 as the successor** to
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

  **STILL OPEN, and materially advanced 2026-08-31 (drain run 11). Three of the
  five `Resolved when` conjuncts are discharged; the two that remain are the
  measurement itself.**
  Discharged: (1) the assembler exists and refuses the synthetic fixture, with
  sensitivity proven in three sabotage probes; (2) all three design forks are
  recorded, one of them by a 2/2 convergent council verdict; (3) the retention
  quarantine's conditional release fired on a diagnosis, and the diagnosis is
  recorded with its own citation correction.
  **Open: the run.** The bench has not been run and no recognition rate exists.
  Day 1 (the RAW arm, 30 calls per provider) is runnable; **day 2 is blocked on
  fork 3's deferred pattern list**, which the council's condition 1 requires be
  version-pinned before the stripped arm runs and which this change deliberately
  did not write. Publishing a RAW-only rate would satisfy neither conjunct 4 nor
  the verdict's condition 5, so nothing was published.

  **ADVANCED AGAIN 2026-08-31 (drain run 12): the pattern list exists, so day 2
  is no longer blocked on a design decision.** Fork 3 conditions 1 and 2 are
  both discharged by `src/scripts/ai_council/leakage_patterns.ts`
  (version `leakage-patterns-v1-2026-08-31`, 15 rules, digest
  `10045caaec23a1bd7…76da6`) with
  `tests/scripts/ai_council/leakage_patterns.test.ts` at 28/28 green and five
  sabotage arms recorded, four red and one explicitly NOT red. Detail and the
  full sensitivity table:
  [`PREREG-anonymisation-and-sampling.md`](../../internal/bench/council-provider-leakage/PREREG-anonymisation-and-sampling.md)
  § Fork 3.
  **What is still open is only the run, and on 2026-08-31 it was open on
  QUOTA.** Both seats read exhausted when this was written — `anthropic 50/50 ·
  openai 51/50` against a cap of 50
  (`src/scripts/ai_council/cli_call_budget.ts:60`) — and the run that recorded
  this made **zero** provider calls: the counter at
  `~/.event4u/agent-config/cli-calls.json` read 47/48 at run start and 50/51
  eleven minutes later, with the attribution sidecar assigning every one of them
  to `unknown`, i.e. to a parallel worker on the same machine. **This is a
  same-day condition, not a new obstacle**, and it is recorded here rather than
  promoted to a blocker field precisely because the predecessor entry was
  falsified for asserting a quota obstacle as though it were structural. The UTC
  reset removes it.
  **The NOT RUN state is therefore intact in exactly the form the predecessor
  protected**, and the advance is in what is now buildable rather than in what
  is claimed.
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
  1. **Assembler.** ~~Write a loader~~ **DONE 2026-08-31 (drain run 11) —
     `src/scripts/ai_council/leakage_corpus.ts` (385 lines), with
     `tests/scripts/ai_council/leakage_corpus.test.ts` at 24/24 green and
     `npm run typecheck` clean.** `assembleLeakageCorpus` walks a response
     directory **recursively** and returns `{ items, families, excluded,
     census }`; every drop carries a machine-readable `ExclusionReason` rather
     than being silently skipped.
     **The synthetic fixture is REFUSED, not excluded** — `smoke-items.json` by
     basename, any record carrying a truthy `synthetic` key under any name, and
     any directory path containing `council-provider-leakage`, each throw
     `SyntheticCorpusRefusal`. A refusal is a throw because exclude-and-continue
     would let a live run proceed over a corpus that had quietly lost its
     subject.
     **Sensitivity proven in two independent runs, not asserted.** Neutralising
     the synthetic-key refusal: **2 failed / 22 passed**; neutralising the
     basename refusal: **1 failed / 23 passed**; neutralising the
     `response-carried-error` exclusion: **1 failed / 23 passed**. Every restore
     was byte-identical, sha256 `874ff5f4…13a7` before and after, returning
     **24/24**. The synthetic-key probe was re-run independently by the
     orchestrator and reproduced 2 failed / 22 passed → 24/24 at the same hash.
     **Three corrections this step forced, each of which changes a decision** —
     detail and citations in
     [`PREREG-anonymisation-and-sampling.md`](../../internal/bench/council-provider-leakage/PREREG-anonymisation-and-sampling.md):
     (i) `responses/` is **not flat** — it holds directories literally *named*
     `<slug>.json` carrying per-round debate records, so a single-level walk
     drops them and the recursive count is **1,402** eligible items, not 716;
     (ii) the roadmap's `gemini 2` **counted failed calls** — both gemini
     entries carry a non-falsy `error`, so `families` reads
     `['anthropic', 'openai']` and **uniform chance is 0.50, not 1/3**;
     (iii) a basename-derived item id would have **leaked the ground truth** —
     real filenames include `anthropic-design-skills-integration.json` and
     `claude-code-distribution.json`, so the id is an opaque
     `item-<sha1(relpath)[0:12]>-<index>` and a test asserts no id contains any
     of seven provider tokens.
     **Deliberately NOT built: anonymisation.** The module returns RAW bodies,
     says so in a `── What this module does NOT do ──` header section, and
     exposes an `anonymise` seam defaulting to `IDENTITY_ANONYMISE`. Fork 3
     below governs what may be stripped, and its pattern list does not exist
     yet.
  2. **Eligibility + balanced sampling.** **RECORDED 2026-08-31 (drain run 11)**
     in [`internal/bench/council-provider-leakage/PREREG-anonymisation-and-sampling.md`](../../internal/bench/council-provider-leakage/PREREG-anonymisation-and-sampling.md)
     § Fork 2, written **before any rater saw any item** — checkable rather than
     asserted, because `collectGuesses` and `scoreRecognition` have **zero
     production callers** at this commit (test-only), so no rater call has been
     made.
     Eligibility is defined AS the assembler's output rather than described
     beside it, so it cannot drift from what is measured. Census: **1,402**
     eligible items, anthropic **699** / openai **703**.
     The `>= 30` floor is read **per arm**, the stricter reading: 60 distinct
     bodies, each arm stratified at **15 anthropic / 15 openai**, drawn
     deterministically by sorted id under a recorded seed. Exact balance is the
     point rather than neatness — at 15/15 the uniform baseline and
     `chance_majority` **coincide at 0.50**, so a constant guesser gets no free
     lift and the stricter-of-two baseline the p-value uses is unambiguous.
     **The detection floor is computed and pre-registered**, exact one-sided
     binomial against `p0 = 0.50`: pooled n = 60 needs **37/60 (61.7 %)** for
     p < 0.05 (p = 0.0462), power 0.937 at a true rate of 0.70; a single rater's
     n = 30 needs **20/30** (p = 0.0494) at power 0.730, and is therefore
     reported as descriptive only and explicitly not promoted to a finding.
     **A limit the design does not overcome:** two families means chance is
     50 %, so nothing below ~62 % pooled recognition is distinguishable from
     guessing. That is a property of the configured council having two seats.
  3. **Anonymisation protocol.** **SETTLED BY AI COUNCIL 2026-08-31 (drain run
     11) — Option (C), TWO ARMS, 2/2 CONVERGENT** (anthropic/claude-sonnet-4-5 +
     openai/codex-default, 2 rounds, blind chairman). Recorded in the same
     PREREG § Fork 3.
     **The fork was real, and the tree settles why.** The live path strips the
     **label** and nothing else: `src/scripts/ai_council/consensus.ts:507-528`
     (`anonymize_responses`), reached via
     `src/scripts/ai_council/blind_review.ts:76`, assigns a positional
     `Response-A` label and maps it to `text.trim()`. **No transformation is
     applied to the body**, so a body naming its own provider reaches a blind
     reviewer exactly as written.
     **Verdict:** run every selected body in exactly **one** arm and publish
     both — **RAW** (live-path fidelity) and **PATTERN-STRIPPED** (isolates
     house style, which is what 3.4 would target). Quoting the openai seat:
     *"A cannot distinguish explicit labels from style; B cannot characterize
     the deployed path."*
     **Seven binding conditions:** version-pin the patterns and replacement
     semantics before the stripped arm runs; keep a span-level transformation
     log; same corpus, separately randomized arm presentation; **no rater sees
     both versions of an item** (satisfied by construction — each body appears
     in one arm only, so a second version does not exist in the run); report
     both arms and both baselines independently; label the second arm
     **`pattern-stripped`, NEVER `identifier-free`**; and it doubles the rater
     calls and the schedule.
     **The claim limit both seats insisted on, carried here because it bounds
     what may ever be published:** the RAW − STRIPPED delta estimates the effect
     of **the registered transformations**, not *"label leakage"* in general —
     regexes may miss identifiers or remove stylistic material. Both seats also
     refused the weaker premise the question offered: the tree proves labels
     **can** pass through, not their **prevalence**.
     ~~**The pattern list is DEFERRED and deliberately absent.**~~ **REGISTERED
     2026-08-31 (drain run 12), in the separate change the deferral asked for.**
     The deferral's ground was that writing the list inside the change that
     settled the protocol would put an unreviewed floor into the
     pre-registration under cover of the verdict; a later, separate change
     carrying its own rationale and its own sabotage evidence is exactly the
     shape that objection permits, and this is it.
     **Conditions 1 and 2 are both discharged.** Condition 1 (version-pin the
     patterns AND the replacement semantics):
     `src/scripts/ai_council/leakage_patterns.ts`, version
     `leakage-patterns-v1-2026-08-31`, 15 rules, one placeholder per category
     and the SAME placeholder whatever family matched, with
     `PATTERN_LIST_DIGEST` asserted by a test so an edit reds rather than
     passes. Condition 2 (span-level transformation log):
     `applyLeakagePatterns` returns per-removal spans whose offsets index the
     ORIGINAL text, so `original.slice(start, end) === matched` — asserted,
     because that is the property that makes a log auditable without its writer
     — and `attachLogIds` THROWS rather than mis-attributing a log whose length
     disagrees with the item count.
     **Two admission rules, and the second is what keeps the arm
     interpretable.** A token whose only role is to name a vendor or a model is
     admitted bare; a token that is also ordinary English is admitted ONLY
     inside an identifying frame. `meta`, `grok`, `bard`, `gemini` and `mistral`
     are each excluded bare, with seven DENIAL tests requiring sentences like
     *"A meta comment about the metadata table"* to come back byte-unchanged. A
     permissive list would have deleted ordinary prose non-uniformly across
     families, which measures the regex rather than the style.
     **Sensitivity: five arms, four red, one NOT red and recorded as such** —
     overlap guard 3/25 red; module-cached regex **28/28 GREEN, not red**;
     greedy-punctuation regression 2/26 red; unbumped digest 1/27 red;
     `identifier-free` label 3/25 red. Every restore was byte-identical at
     sha256 `accd1a88…7339`, back to 28/28. The green arm is named in the
     module: the `exec` loop resets `lastIndex` itself, so the per-call
     recompile is defensive and **unproven**, not proven.
     **A residue the design cannot remove, and it bounds the published claim.**
     Replacement is family-invariant in TEXT and cannot be made invariant in
     COUNT or POSITION — a family that self-identifies four times and one that
     never does stay distinguishable by placeholder density, a signal the
     stripping CREATES rather than removes. Equalising it would be a second
     transformation with its own distortion, so it is not done.
     **The stripped arm is therefore no longer blocked on a design decision.**
     Both arms are now blocked only on quota and on the absence of any
     production caller for `collectGuesses` / `scoreRecognition`.
  4. **Rater budget.** **RECORDED 2026-08-31 (drain run 11)**, same PREREG
     § Fork 4. Two raters (the configured seats) × 60 distinct bodies = 120
     rater-item pairs = **60 calls per provider** against the 50/provider/day
     cap → **2 UTC days**: day 1 the RAW arm, day 2 the PATTERN-STRIPPED arm.
     Stated up front, which is what this todo asked for.
     **Arm is confounded with day, and that is named rather than hidden** — a
     per-day provider-side change would read as an arm effect; the mitigation at
     this budget is to report the day beside each arm. **A one-day crossover was
     reachable and was rejected**: it pools the `>= 30` floor across arms instead
     of meeting it per arm, and makes the arm delta a between-rater comparison,
     confounding rater with arm for exactly the quantity condition 5 requires be
     reported independently. Trading a named day-confound for an unnamed
     rater-confound plus a weakened floor is not an improvement.
     **Day 1 is runnable now. Day 2 is blocked on fork 3's pattern list, not on
     quota.**
  5. **Retention quarantine.** ~~The over-retained bodies are excluded from
     eligibility until the retention defect is diagnosed.~~ **THE DEFECT IS
     DIAGNOSED 2026-08-31 (drain run 11), so the quarantine's own release
     condition has fired and the quarantine LIFTS.** The clause was conditional
     — *"until the retention defect is diagnosed"* — and this is that condition
     being met, not a floor being lowered.

     **The diagnosis: three retention carriers name this directory and NONE of
     them is automatic.** Every pruner in the tree needs an explicit human
     command.
     (a) **The auto-prune path is dead code.** `session.save()`
     (`src/scripts/ai_council/session.ts:506`) is the only function that calls
     `prune_old_artifacts(QUESTIONS_DIR, days)` / `(RESPONSES_DIR, days)`
     (`:603-604`). Repo-wide, exactly two files import that module:
     `src/scripts/council_prune.ts:36`, which imports `_load_retention_days` and
     `prune_all_council_artifacts` (`session.ts:468`) and **not `save`**, and
     `tests/scripts/ai_council/session.test.ts:18`. There is no barrel or index
     file in `src/scripts/ai_council/` and no dynamic, namespace, or
     string-built import reaches it. `src/scripts/council_cli.ts` — the live
     writer — imports the module **not at all**.
     **Stronger than "uncalled in production": no test exercises the tail
     either.** All six `save()` call sites pass both `sessions_dir: base` (so the
     `if (sessions_dir === null)` branch at `:602-605` is never entered) and
     `retention_days: 0` (which hits the `<= 0 → return []` guard at `:360` and
     `:412`). So wiring `save()` up is an **untested change**, not a switch flip.
     (b) **`council_prune.ts:14` documents a caller that does not exist** —
     *"Same logic as the auto-prune that runs on every `council save()`"*.
     (c) **The janitor is a reporter, not a reaper.** `janitor.ts:12-14` states
     the default is a dry-run report and that deletion needs `--apply`, which
     gates the `fs.unlinkSync` path. Its `TTL_CONFIG` declares
     `agents/runtime/council/responses` at `ttlDays: 7` and **has no entry for
     `questions/` or `sessions/` at all**, so even `janitor --apply` would leave
     two of the three council directories untouched.

     **A citation correction, recorded because a governed artefact must not
     carry it wrong.** An earlier form of this diagnosis cited
     `src/scripts/discovery_graph.ts:422`'s reference to `janitor.ts:10` as
     *"never auto-sweeps"*. That is **wrong twice**: `janitor.ts:10` is a blank
     comment line, and the sentence it means is at `:9` — *"NEVER auto-sweeps
     agents/tmp/ (user inbox — user-owned, no TTL)"* — which is scoped to the
     **user inbox** and is a statement that janitor deliberately excludes one
     directory, not a claim about council artefacts or about janitor in general.
     The load-bearing evidence for (c) is `:12-14` plus the `--apply` gate.

     **The root-mismatch hypothesis is REFRAMED, not rejected.** This entry's
     predecessor hypothesised that `RESPONSES_DIR` (file-relative,
     `session.ts:70`) and `council_cli.ts:217`'s `resolve_project_root(null)`
     (cwd-relative) diverge. It is **not** the operative cause — a root mismatch
     would prune the *wrong* directory, and what is observed is no pruning in
     *any* directory; in the maintainer checkout the two roots coincide. **But it
     is a live trap in the remedy:** from the global install `session.ts`'s
     `REPO_ROOT` resolves to the installed package, so wiring `save()` up would
     prune the package's own tree while artefacts accumulate in the consumer's,
     and the same defect makes `janitor --apply` sweep the wrong tree from an
     install. Fix-blocker, not a dead hypothesis.

     **The measurement, read with a read-only probe that deletes nothing**
     (`src/scripts/probe_council_retention.ts`, 495 lines, no write/unlink/rm
     call in the file, typecheck and lint clean). **Snapshot at
     2026-08-31T16:55Z — these figures DRIFT and are a floor, never a total:**
     a re-run ten minutes later read 1,314 files and 121 days, because a
     parallel worker is writing into the directory. Reproduce with
     `./scripts-run src/scripts/probe_council_retention --root <checkout>`
     rather than quoting the table.

     | directory | files | over TTL | attributed bodies | within TTL | oldest |
     |---|---|---|---|---|---|
     | `responses/` | 798 | 784 | **1,402** | **0** | 117 d |
     | `sessions/` | 157 | 157 | 91 | 0 | 120 d |
     | `questions/` | 358 | 346 | 2 | 0 | 117 d |
     | **totals** | **1,313** | **1,287** | **1,495** | **0** | **120 d** |

     Independently corroborated by `./scripts-run src/scripts/janitor` in its
     default dry-run mode, which reports **784 expired** files in `responses/`
     — the probe's figure exactly.

     **Why lifting the quarantine was the only reading under which this bench
     can ever run, and it is arithmetic rather than judgement: 0 of 1,402
     eligible bodies are within the 7-day TTL.** Held in force, the quarantine
     excludes **100 %** of the corpus, so the `>= 30` floor would be
     unreachable forever and step 3.3 unclosable by construction. The `until`
     clause is what resolves it, and the condition it names is now met.

     **A limit the lift does NOT remove, and it bounds every claim this bench
     may publish.** The corpus is what an unrun reaper left behind — this tree
     already says so, at `src/scripts/ai_council/recouncil_savings.ts:237-240`:
     *"ACCIDENTAL DENOMINATOR — the retained corpus is what an unrun reaper left
     behind … Any rate over this corpus is a rate over an unknown sampling
     frame."* Recognition is a within-item property, so the bench remains
     interpretable; a **population** claim is not. The defensible published form
     is *"over these 60 bodies, raters named the family at rate R against chance
     0.50"* — never *"the council leaks R % in production"*.
     **The corpus is also live:** `responses/` read 798 files and 799 thirty
     seconds later, so every figure above is a snapshot and 1,402 is a floor.
     Once the 60 bodies are drawn they must be **pinned by id** so the arms are
     run over a fixed set.

     **Not fixed, and deliberately.** Wiring an automatic prune now would delete
     the 1,287 over-retained artefacts — the measurement subject. The fix is
     sequenced **after** the bench run, and the assembler contains no fs
     mutation so it cannot cause one. The false-documentation half of the defect
     is tracked at
     [`stubs/road-to-council-retention-doc-drift.md`](stubs/road-to-council-retention-doc-drift.md).
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
- **Resolved when:** the assembler exists and refuses the synthetic fixture
  **[DONE 2026-08-31]**, the three forks above are recorded **[DONE
  2026-08-31]**, the retention quarantine is applied **[DONE 2026-08-31 — its
  conditional release fired on the diagnosis recorded in todo 5]**, and the
  bench has been run over a corpus of **>= 30 real anonymised response bodies**
  with both the recognition rate and its chance baseline published **[OPEN — no
  arm has run]** — at which point 3.3 closes and 3.4 becomes decidable in
  whichever direction the number points. **The >= 30 floor and the
  `smoke-items.json` prohibition are carried forward unweakened**; the council
  named both as floors it could not move.
  **The >= 30 floor is now read PER ARM, which is stricter than the pooled
  reading this sentence would also permit** — 60 bodies, 30 per arm. That is a
  tightening and is recorded so a later reader cannot relax it back to a pooled
  30 by citing this field.
  ~~**The remaining conjunct is not quota-bound today.** Day 1 needs 30 calls
  per provider against a cap of 50; what blocks day 2 is fork 3's deferred
  pattern list.~~ **SUPERSEDED 2026-08-31 (drain run 12): the pattern list
  exists, so nothing here waits on a design decision any more.** Both arms now
  wait on two things and neither is a fork: 30 calls per provider per arm
  against a cap of 50, and the fact that `collectGuesses` and `scoreRecognition`
  still have zero production callers, so no code path in this tree can dispatch
  a rater call at all. Naming that precisely still matters for the reason the
  superseded sentence gave — the predecessor entry was falsified for asserting a
  quota obstacle that had ceased to exist — so the honest form is: **the design
  is settled, the dispatcher is not built, and on the day this is attempted the
  quota must be free.** On 2026-08-31 it was not: both seats read exhausted
  (`anthropic 50/50 · openai 51/50`) at the hands of a parallel worker, with
  this run itself making zero provider calls.

### blocker: phase-2-benchmark-cost

- **Status:** resolved 2026-09-01 (drain run 12) — **DESCOPED by AI council
  verdict A3, convergent 2/2.** Phase 2 and its 23 dependent steps are `[-]` and
  point at
  [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md),
  which carries the frozen manifest, the arm spec, the missing-runner
  requirement, the 3-conjunct resumption trigger, the fresh-manifest trigger and
  the enumerated list of claims this roadmap may NOT make while the steps are
  `[-]`.

  AI council 2026-09-01, members anthropic (claude-sonnet-4-5) and openai
  (codex-default), 2 rounds, blind chairman, subscription transport
  (`billable=0`, `$0.0000`), quorum `2/2 present, needed 1 — concluded`. Both
  seats reached A3 independently with no dissent recorded on it. Their shared
  reasoning: the benchmark is executable procedurally and not in a way that can
  license a claim — 1,584-1,804 calls over 20 UTC days at `N=2` cannot satisfy
  the pre-registered `n >= 5` / `n >= 10` floors, which is the limit this file
  had already recorded about itself.

  **Nothing was descoped for cost.** Token spend is pre-authorised by the
  maintainer. What is unavailable is 20 consecutive UTC days of exclusive
  capacity across the only two configured seats — a wall-clock and capacity
  constraint that authorising spend does not remove. `day_batches` in
  `internal/bench/council-topology/call-manifest.json` books 46-50 calls per
  provider on each of days 1-19 and 15 on day 20; the same two seats are this
  repository's decision mechanism.

  **The runner remains the largest unbuilt piece**, unchanged and verified at
  this commit: `src/scripts/ai_council/topology_bench_manifest.ts:822` handles
  only `--emit` and contains no provider dispatch. Cell state is 352 `pending` /
  32 `not_eligible` / **0 complete**.

  **The `n >= 5` and `n >= 10` floors are carried forward unmoved.** The council
  was asked whether it wished to move them and declined.

  The historical record below is kept unedited, because it is what was true when
  it was written.

  **Superseded status line:** open — **created 2026-08-31. The condition is not new; carrying it
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
  **PARTIALLY DISCHARGED 2026-08-31 (drain run 11) — TWO of the first path's
  three conjuncts are now met; the runner is the one that is not.**

  **(a) The spend IS authorised, by the owner, in the run mandate that
  commissioned this change.** Verbatim: *"Spend-type blockers: token/benchmark
  spend is **pre-authorized by the maintainer** — the council decides *how*, not
  *whether*."* That is the owner authorisation this field asks for, and it is
  what this entry's own **Recommendation** field said to seek — *"take it to the
  owner rather than the council"*, on the ground that *"20 days of monopolised
  provider quota is a spend commitment above what a council decides"*. The
  authorisation settles the *whether*. It does not make the runner exist.

  **(b) The UTC-day schedule IS recorded**, at
  [`internal/bench/council-topology/UTC-DAY-SCHEDULE.md`](../../internal/bench/council-topology/UTC-DAY-SCHEDULE.md).
  It is **emitted, not authored**: `expandManifest()` → `partitionIntoDays()` →
  `summariseManifest()` over the frozen spec, which is greedy and deterministic
  in cell order, so it regenerates byte-identically. It reproduces this entry's
  figures exactly — 384 cells, 352 eligible, 32 `not_eligible`, minimum 1,584
  calls (anthropic 814 / openai 770), worst case 1,804 (924 / 880), 20 UTC days
  at a cap of 50 — and adds the per-day booking table, booked at **worst case**
  so the retry reserve is held before a cell starts. The per-day sums equal the
  worst-case totals, which is the check that the partition loses no cell.

  **(c) The runner does NOT exist**, unchanged: `topology_bench_manifest.ts`
  `main()` only `--emit`s JSON and contains no provider dispatch. **This change
  did not build it**, and the reason is recorded rather than left as an
  omission: both council seats declined to greenlight the runner on 2026-08-31,
  and while the owner's authorisation changes the *spend* premise their refusal
  rested on, it does not by itself commission a 384-cell dispatcher. A runner
  built inside a drain run and then left unexercised for 20 days is a
  population-of-zero mechanism of exactly the kind this file's `guarded-baseline`
  state exists to refuse.

  **A cost the authorisation did not price, recorded because it is a genuine
  tension in the mandate rather than a risk this entry carries.** Mean daily
  booking is 46.2 anthropic and 44.0 openai against a cap of 50, leaving roughly
  3-5 calls per provider per day — **not enough for a two-seat council round at
  two rounds**, which is how this repository's recorded decisions are taken. For
  20 consecutive UTC days no other council work can proceed. The same mandate
  that authorises the spend also requires every contested decision to be settled
  by the council. **Those two obligations cannot both be met during the 20
  days.** The tension is surfaced, not resolved: resolving it is a scheduling
  decision for whoever starts the run, and resolving it by silently preferring
  whichever half permits progress is what this note exists to prevent.

  **Nothing about what Phase 2 may claim has changed.** At `TRIALS_PER_ITEM = 2`
  the benchmark still clears neither of 2.6's pre-registered floors (n >= 5,
  n >= 10), so it licenses descriptive comparison only. No family was cut, no
  ablation deleted, and no unexecuted arm was called a null — the three moves
  both seats refused. All 352 eligible cells still read `pending`, which
  `PHASE2_COMPLETE_STATUSES` excludes at the type layer and at module load.

  **STILL OPEN after drain run 12 (2026-08-31), and the reason is recorded
  rather than left as an absence: the second path could not be attempted,
  because the deciding body was unreachable.** This entry's own
  **Recommendation** is path (c), a re-scope, *"taken to the owner rather than
  the council"*. The run that carried this change was mandated to route every
  owner-class decision to the AI council in the owner's place. That routing was
  attempted and refused **before any question was put**: at run start the
  per-provider counter read `anthropic 47 · openai 48`, and by the time the
  question file was ready it read `anthropic 50/50 · openai 51/50` — over the
  cap at `src/scripts/ai_council/cli_call_budget.ts:60` — with the attribution
  sidecar (`~/.event4u/agent-config/cli-calls.json.attribution.json`) assigning
  all of them to `unknown`, i.e. to a parallel worker. This run made **zero**
  provider calls; a free `council run` dry pass confirmed the refusal without
  spending (`council:quota · anthropic 50/50 · openai 51/50`).

  **What was deliberately NOT done, and why each would have been worse than
  waiting.**
  (a) **Building the runner unilaterally to close the first path.** Two of that
  path's three conjuncts are already met, so a 384-cell dispatcher would have
  discharged the condition on paper. It was refused for the reason this entry
  already gives in its own (c) clause — a runner built inside a drain run and
  left unexercised is a population-of-zero mechanism — and for a second reason
  that only applies now: two council seats declined to greenlight it, and
  overturning a recorded council refusal while the council is unreachable is not
  a decision, it is the absence of one.
  (b) **Re-scoping Phase 2 without the council.** The re-scope changes what the
  phase's results may claim, which this entry classifies as owner-reserved. With
  neither the owner nor their delegate reachable, writing a new claim-licensing
  limit would have been an agent-authored change to a declared purpose.
  (c) **Recording (c) as "the decision" with no deliberation behind it.** That
  is the silent-green shape this file exists to refuse.

  **The state is therefore unchanged and correctly so**: `Blocks` is unchanged,
  all 352 eligible cells still read `pending`, nothing about what Phase 2 may
  claim has moved, and the 23 dependent steps stay open. The only thing this
  note adds is that the second path is now known to be *reachable* — the owner
  authorisation exists, the deciding body simply had no quota on the day — which
  is a different state from the one the entry described when it was written.

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
