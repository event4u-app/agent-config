---
complexity: lightweight
parent_roadmap: road-to-inbox-harvest-2026-08-b.md
---

# Road to an enforced authoring contract

> Take the three sections `skill-writing` labels **required** from 0-of-3
> enforced and 0-of-4 complied to 1-of-3 enforced with its population at 100%,
> and the other 2 explicitly reclassified with a citation — plus bind the
> estate's 14 external research ids into the claims ledger, from 0 bound today.

> Source (consumed inbox): `agents/tmp.old/ac-skill-template`,
> `agents/tmp.old/ac-failure-signatures`, `agents/tmp.old/ac-doctrine-cited-briefs`,
> `agents/tmp.old/ac-positional-doctrine` — part of the 2026-08-10 batch triaged
> by [`road-to-inbox-harvest-2026-08-b.md`](road-to-inbox-harvest-2026-08-b.md).

## Context / What is verified

Measured in this worktree at HEAD, not asserted:

- **Three sections are labelled required and enforced by nothing.**
  `src/skills/skill-writing/SKILL.md:533` (`## Rationalizations-to-reject
  section (required, security-stop-routed skills)`), `:556`
  (`## Non-negotiable-deliverable section (required, adjacent-technology
  clusters)`), `:619` (`## Security-constraints section (required pattern,
  script-bearing skills)`). `grep -rlE 'Rationalizations-to-reject|Non-negotiable-deliverable|Security constraints' src/scripts/*.ts`
  returns nothing.
- **The enforcement pattern already exists.**
  `src/scripts/skill_linter.ts:98` `REQUIRED_SKILL_SECTIONS = ['When to use',
  'Gotcha', 'Procedure', 'Output format', 'Do NOT']`, aliased at `:100-105`
  (`Do NOT` → `Anti-patterns`), emitting `error/missing_section` at `:1356-1359`.
  Budget is ample: `skill_linter --all` scans **437 artefacts in 0.56 s**.
- **Compliance with all three is zero.** 4 skills ship a `scripts/` directory
  (`corpus-grounding`, `design-tokens`, `react-shadcn-ui`, `tailwind-engineer`)
  and **none** carries `## Security constraints`. Exactly one file matches
  `^## Rationalizations` and one matches `^## Non-negotiable` — both are
  `skill-writing/SKILL.md` itself, describing the pattern, not an instance.
- **Only one of the three has a filesystem-decidable population.**
  "script-bearing" is `test -d src/skills/<n>/scripts`. "security-stop-routed"
  and "adjacent-technology cluster" are judgement calls; `security-sensitive-stop.md:72-75`
  names 4 analysis skills and the `*-routing.md` rules name 4 cluster heads, but
  neither list is a declared skill property. `src/scripts/schemas/skill.schema.json:8`
  sets `additionalProperties: false`, so a declarative key is a schema change.
- **The claims ledger has the format and zero usage for external cites.**
  `docs/CLAIMS.md:46` already defines `https://… (YYYY-MM-DD)` as pointer
  grammar #3 of 4; 43 backed / 10 unbacked / 5 resolved-null entries exist and
  **no `- evidence:` line carries an http or arXiv pointer**. The tree cites
  **14 distinct arXiv ids across 49 lines in 33 tracked files**. Ledger entries
  render into `docs/proof.md` via `src/scripts/build_proof.ts`, drift-checked by
  `task build-proof-check` (`Taskfile.yml:293`).
- **Hedge words are measured, never linted.** `src/scripts/bench_honesty_score.ts:528`
  `HEDGE_WORDS`, `:593` `countHedgeWords`, `:606-621` `hedge_count` /
  `hedge_per_100_words` — all scoring agent *output*, not artefact prose. No
  `src/scripts/*hedge*` lint exists.
- **`## Known pitfalls` is at 4 of 289 skills** and its content is already
  governed by `src/rules/size-enforcement.md:29` ("never a new skill per
  pitfall", cap 5 sourced entries). No work is planned on it here — an optional
  pattern with low uptake is not a defect.

Estate: **116 rules, 289 skills, 437 linted artefacts.** Every step below names
the existing artefact it extends; nothing here adds a rule or a skill.

## Phase 1 — Enforce the one required section whose population is decidable

- [x] **1.1 Write `## Security constraints` into the four script-bearing skills.**
      `src/skills/{corpus-grounding,design-tokens,react-shadcn-ui,tailwind-engineer}/SKILL.md`
      each ship a `scripts/` directory and none carries the section. Use the
      four-bullet shape already specified at `src/skills/skill-writing/SKILL.md:629-643`
      — what it may touch, what it must never do, default-invocation behaviour
      (read-only or mutating, and the gating flag if any), what it sends
      outbound. Must land **before** 1.2 or the gate reds four shipped skills.
      <!-- verify: grep -lc '^## Security constraints' src/skills/corpus-grounding/SKILL.md src/skills/design-tokens/SKILL.md src/skills/react-shadcn-ui/SKILL.md src/skills/tailwind-engineer/SKILL.md -->
- [x] **1.2 Add a conditional required-section check to `skill_linter.ts`, keyed on
      `scripts/` directory existence.** Extend the `REQUIRED_SKILL_SECTIONS` loop
      at `src/scripts/skill_linter.ts:1356-1359` with a conditional tier that
      emits `error/missing_conditional_section` when a skill directory contains
      `scripts/` and the body has no `## Security constraints`. **The
      false-positive class is empty by construction**: the predicate is a
      filesystem existence test on the skill's own directory, not a heuristic
      over prose — a skill either ships a script or it does not. After 1.1 the
      violation set is 0, so the check ships as `error` on day one rather than
      advisory (the stage-vs-hedge argument in
      `src/scripts/check_suppression_hygiene.ts:38-42`).
      <!-- verify: ./scripts-run src/scripts/skill_linter --all -->
- [x] **1.3 Pin the new check in the linter's own test file.** Add cases to
      `tests/scripts/skill_linter.test.ts`: a fixture skill with `scripts/` and
      no section → one `missing_conditional_section` error; the same fixture with
      the section → clean; a skill with no `scripts/` and no section → clean (the
      discrimination case, without which the check is indistinguishable from an
      unconditional one).
      <!-- verify: npx vitest run tests/scripts/skill_linter.test.ts -->
- [x] **1.4 Reclassify the other two sections — option 2, per council 2026-08-11.**
      Blocker `conditional-section-population-key` resolved: 2/2 (anthropic,
      openai) for reclassification over a declared frontmatter key. The decisive
      argument was not cost but coverage — an authored opt-in key cannot see the
      skill that *should* have opted in and did not, so option 1 buys a gate
      without buying the guarantee that makes the `scripts/` predicate worth
      having; and 0-of-289 voluntary uptake is evidence the requirement was never
      operative. Landed as three edits: both headings at
      `src/skills/skill-writing/SKILL.md` now read `(recommended pattern, …)`,
      and the `CONDITIONAL_SKILL_SECTIONS` docblock in `src/scripts/skill_linter.ts`
      records why the two are absent from the table so the next reader does not
      re-open it as an oversight. No schema change; `additionalProperties: false`
      is untouched.
      <!-- verify: grep -c 'recommended pattern' src/skills/skill-writing/SKILL.md -->

      **What the reclassification does not buy, stated plainly:** the two patterns
      are now unenforced by construction, so uptake stays voluntary and will
      probably stay at zero. That is the honest end state for a pattern whose
      population is a judgement call — the alternative was a label that claimed an
      enforcement nothing performed.

## Phase 2 — Extend the skill-writing pattern registry

`src/skills/skill-writing/SKILL.md:482-645` already **is** a conditional
section-pattern registry (Self-QA loop, Known-pitfalls, Rationalizations-to-reject,
Non-negotiable-deliverable, Upstream-version-notes, Security-constraints). Every
step below extends that registry. No new artefact; no new skill against 289.

- [x] **2.1 Add a mechanism-teaching pattern.** One screen, mechanisms only — the
      currently-unnamed sibling of the existing patterns. No section pattern and
      no linter signal exists for it (`grep -n '^## ' src/skills/skill-writing/SKILL.md`
      lists all 20 headings; none covers it). Land it as an *optional* pattern:
      "teaches a mechanism" is a prose judgement, so it gets no gate — see the
      Risk Register row on FP classes.
- [x] **2.2 Add an illustrative-not-verbatim marker pattern for reference code.**
      `grep -c illustrative` over both `src/skills/skill-writing/SKILL.md` and
      `src/scripts/skill_linter.ts` returns **0**; the nearest existing guidance
      is `skill-writing/SKILL.md:265` "### 4. Add safe/unsafe example". Specify a
      one-line marker above a reference block so a reader can tell shape-teaching
      code from copy-me code.
- [x] **2.3 Add a headline-metric-plus-closing-report pattern for optimization
      skills.** `grep -rn 'headline metric' src/ docs/` returns exactly one
      unrelated hit (`src/scripts/measure_projection_bytes.ts:11`). Specify: name
      the single number the skill moves, and the closing report shape that states
      it before and after.
- [-] **2.4 Read-only reconnaissance as a new pattern — already shipped.**
      `src/scripts/skill_linter.ts:704-708` `_INSPECT_VERB_PATTERN` /
      `hasInspectStep`, enforced at `:1515`; the authored counterpart is
      `src/skills/skill-writing/SKILL.md:111` "### 0. Inspect, then run the
      Drafting Protocol".
- [-] **2.5 Negative knowledge as a new pattern — already mandatory.** `Do NOT`
      is in `REQUIRED_SKILL_SECTIONS` (`src/scripts/skill_linter.ts:98`) with
      `Anti-patterns` aliased at `:103`, so all 289 skills already carry it.
- [-] **2.6 The validation half of verification — already shipped.**
      `src/scripts/skill_linter.ts:670-705` `hasValidationStep`, enforced at
      `:1508` against both the procedure block and the full body.
- [x] **2.7 Name the contrastive-example slot in `skill-writing` and
      `rule-writing`.** The practice is already house style with six live corpora
      — `docs/guidelines/agent-infra/{direct-answers-demos,asking-and-brevity-examples,language-and-tone-examples}.md`
      and `src/agent-src/contexts/execution/{autonomy-examples,interrupt-examples,cheap-question-mechanics}.md`
      — but neither authoring skill names the slot, so it does not propagate.
      `src/skills/rule-writing/SKILL.md:349-357` has an `## Examples` section that
      shows good-vs-bad for descriptions only. Point at the existing exemplars;
      do not invent a format.
- [-] **2.8 A new rule for contrastive examples — cancelled.** 116 rules already
      ship; this is a template slot in two existing skills, not a behaviour
      constraint needing its own always-loaded file.

## Phase 3 — Failure signatures: a stable code, and a drill per row

`docs/guidelines/agent-infra/failure-signatures.md` already exists (35 lines,
10-row table, read by `src/skills/systematic-debugging/SKILL.md:224-228`). Its
own header records the file-first council decision of 2026-06-15.

- [x] **3.1 Give each row a stable identifier.** The first column is headed
      `Signature (what you see)` (`failure-signatures.md:15`) but holds prose, so
      nothing can be cited by name. Add a short kebab code per row and point the
      gate/guard/coercion rows at the identifiers the tooling already emits —
      `skill_linter.ts:1358` emits `missing_section`, `:1255`
      `invalid_execution_handler`, and the whole `Issue` code set is stable
      strings a signature row can name verbatim.
- [x] **3.2 Add a discrimination drill per row.** A row's "first check" is only
      worth following if the documented signature is what actually appears. For
      each row, state the one-line drill that produces it (break the named layer,
      assert the documented signature). Doc-only step; the drills are text a
      human runs, not a CI gate.
- [x] **3.3 Add one row: stale capability self-claim.** Signature — budget
      exhausted plus repeated attempts at a tool that is not available. Likely
      cause — a capability the session claimed for itself rather than resolved.
      First check — `agent-config hooks:status` and `agent-config routing:doctor`,
      both live verbs (`src/cli/registry.ts:82` and `:84`), the latter printing
      per-field provenance.
- [-] **3.4 Per-subsystem `TROUBLESHOOTING.md` files — cancelled.** Reverses the
      file-first decision recorded in the guideline's own header
      (`docs/guidelines/agent-infra/failure-signatures.md:9-11`, council
      2026-06-15): one table the skill reads, deliberately not scattered.

## Phase 4 — Bind the external research citations to the ledger

- [x] **4.1 Inventory the citations — and the planned count was wrong.**
      The step's own verify command undercounts: its pattern is
      `arxiv[:/ ]*(abs/)?<id>`, which cannot match the `arxiv.org/abs/<id>` URL
      form because `.org/` sits between `arxiv` and the separator class. Run as
      written it finds **14 ids in 8 files**, all under `agents/`. Corrected to
      `arxiv(\.org/abs)?[:/ ]*<id>`, the tree holds **20 distinct ids across 90
      lines in 32 files**. The "49 lines in 33 files" in the Context above
      matches neither reading and is superseded by this measurement.
      <!-- verify: grep -rhoiE 'arxiv(\.org/abs)?[:/ ]*[0-9]{4}\.[0-9]{4,5}' $(git ls-files) | grep -oE '[0-9]{4}\.[0-9]{4,5}' | sort -u | wc -l -->

      **The split that decides 4.2.** Of the 32 citing files, 11 are `src/`
      sources (the rest are `dist/` projections of those 11, roadmaps under
      `agents/`, one evidence review, and one MCP content blob). Every `src/`
      citation sits in a `## References` section and grounds a normative design
      claim — six distinct ids:

      | id | Cited from | The sentence it holds up |
      |---|---|---|
      | `2306.05685` | `judge-{bug-hunter,code-quality,security-auditor,synthesis,test-coverage}/SKILL.md`, `domains/engineering-base/review/changes/command.md` | the judge family's whole premise, plus position bias / self-consistency as its named failure modes |
      | `2305.10601` | `adversarial-review/SKILL.md` | branching critique with explicit pruning |
      | `2303.17651` | `analysis-autonomous-mode/SKILL.md` | self-critique between steps, not only at the end |
      | `2309.11495` | `bug-analyzer/SKILL.md` | verify each root cause against a concrete trigger — the mechanism behind "never invent issues" |
      | `2201.11903` | `sequential-thinking/SKILL.md` | CoT with a thought cap and a mandatory validation step |
      | `2303.11366` | `skill-improvement-pipeline/SKILL.md` | post-task outcomes become written lessons, not in-context retries |

      The other 14 ids appear **only** in roadmap prose (12 of them in
      `archive/`) and one evidence review. Planning prose is not a public or
      normative sentence, so they stay unbound per 4.2's own instruction —
      recorded here rather than silently omitted.
- [x] **4.2 Bind the load-bearing cites using pointer grammar #3.** Use the
      already-specified `https://… (YYYY-MM-DD)` form (`docs/CLAIMS.md:46`) —
      **do not invent a dossier format**; a second source of truth is exactly
      what `src/scripts/generate_subagent_floor.ts` exists to prevent. Bind only
      cites that a public or normative sentence rests on; a citation that decorates
      prose needs no ledger row. Re-run `build_proof` after editing the ledger
      (`docs/CLAIMS.md` renders into `docs/proof.md` per
      `src/scripts/build_proof.ts:8`).
      **Nothing here ingests external content, and nothing may start to.** The
      pointer grammar is an existence-and-date check that the tooling never
      dereferences — `check_claims.ts` documents its pointers as not fetched in
      CI, and `build_proof.ts` renders an external cite with that same statement.
      The citation universe is the closed set already committed to this tree,
      enumerated by the command in 4.1; pointers stay scoped to it. A phase that
      fetched a citation would be a different phase and would need its own
      egress review under [`lethal-trifecta-guard`](../../src/rules/lethal-trifecta-guard.md).
      <!-- verify: ./scripts-run src/scripts/check_claims -->
- [x] **4.3 Add a successor pointer to retired claims.** The retire-never-delete
      lifecycle already ships as `status: resolved-null` (`docs/CLAIMS.md:23-31`).
      What it lacks is a forward link when a closed question is later reopened by
      a different mechanism. One optional field, schema-documented at
      `docs/CLAIMS.md:37-44`.
      <!-- verify: npx vitest run tests/scripts/check_claims.test.ts -->

## Phase 5 — Hedge-word lint, diff-scoped, with a declared escalation stage

- [x] **5.1 Add a diff-scoped hedge-word check reusing the existing lexicon.**
      Export and reuse `HEDGE_WORDS` from `src/scripts/bench_honesty_score.ts:528`
      rather than restating a list. Diff-scoped, not corpus-wide: ADR-218:93 states
      the preference outright — "one that watches diffs, not one that counts the
      corpus". Adjacent precedent for a vocabulary floor over prose is
      `src/scripts/lint_provenance_vocabulary.ts:14-17` (a phrase banned "anywhere,
      even hedged", with a quote-the-ban carve-out this check needs too).
      <!-- verify: ./scripts-run src/scripts/lint_hedge_words -->
- [x] **5.2 Ship it with a declared escalation stage — and the first measurement
      says the stage may never advance.** The trigger is written into the script
      header before any data: advisory → error only when (a) ≥ 30 merged PRs are
      measured, (b) a human read classifies ≤ 10% of ≥ 50 sampled findings as
      legitimate calibrated hedging, and (c) a maintainer binds the resulting
      threshold in `docs/CLAIMS.md`. The (b)-fails branch is pre-authorised in the
      same header: the check stays advisory permanently or is removed — it does
      **not** get a lowered bar.

      **First measurement, this branch's own diff:** 4 hedged lines over 264 added
      prose lines / 3,284 words — `hedged_per_100_words: 0.12`. A human read of
      all four classifies **4 of 4 as legitimate**: a table header (`Likely
      cause`), two descriptive sentences about what a reader *could* reference and
      what *appears*, and one about what a reader *might* assume. That is a **100%
      false-positive rate at n = 4** — a small sample, and pointing the same way
      the risk register predicted. Recorded here rather than left for the
      escalation review to discover.

      **Not wired into `task ci` or any workflow, deliberately.** The parity gate
      (`check_ci_local_parity`) derives both sides from those two chains, so an
      unwired advisory script is invisible to it rather than a declared exception.
      The honest cost of that choice: findings only accrue when someone runs the
      command, so condition (a) accrues slowly or not at all — the gate may sit at
      n = 4 indefinitely. Wiring it would trade that for a line of advisory output
      on every CI run, which is the trade a maintainer should make deliberately,
      not one this step should make silently.
- [-] **5.3 Estate-wide hedge count as the gate — cancelled.** ADR-218:93 already
      settled the diff-vs-corpus question for prose-shape tooling; a corpus count
      over 116 rules and 289 skills produces a number nobody can act on.

## Phase 6 — Cancelled with citation

- [-] **6.1 Per-turn doctrine-recency cue (inject 3-6 kernel constraints at the
      payload tail every turn) — cancelled, hard-blocked three ways.** (a)
      `docs/decisions/ADR-054-rule-adherence-decay-triggered-restate.md:3` is
      `status: rejected` and is this exact proposal. (b)
      `agents/settings/contexts/reminder-injection-verdict.md:54` records the
      pilot at **Δ = 0 pp on both hosts**, with the hook, manifest wiring and
      settings flag "removed in the same branch that built it" (`:75-77`) per a
      pre-committed teardown at `<5 pp` (`:28`). (c) The premise itself failed a
      pre-registered search: `agents/evidence/analysis/activation-red-baseline.md:15`
      swept **1,158 sessions** and `:25-27` records qualifying rows spanning
      **9,464 to 727,537 tokens** against a 3,000-token bar — "distance was never
      the limiting factor". And the one carrier that does fire per turn on this
      exact surface is measured at **24 of 29 misses** with the honesty clause
      firing **0** times (`src/rules/session-canary.md:105-106`), whose own
      conclusion is that a reminder in context is not a mechanism for this
      obligation.
- [-] **6.2 The 97-of-111 absoluta point estimate — cancelled, re-derive instead.**
      `./scripts-run src/scripts/measure_rule_absoluta` at HEAD reports **116
      rules scanned, 84 strict (72.4%), 102 case-insensitive (87.9%), 99 carrying
      an Iron Law (85.3%), 287 strict occurrences**. `docs/decisions/ADR-218-absoluta-census-is-a-closed-decision-input.md:43`
      and `:88` require citing the range and the structural figure, never a point
      estimate.
- [-] **6.3 "Positional doctrine is new" — cancelled, already shipped.**
      `src/rules/token-budget-discipline.md:117` ships `## Rich artifacts lead
      with a non-negotiable band`, and `src/scripts/check_iron_law_prominence.ts:14-19`
      enforces both halves: no Iron-Law heading at H3 or deeper, and at least one
      Iron-Law H2 among the file's first two H2 headings.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Gate lands before its population complies | implementation | 1.2 turns a missing `## Security constraints` into `error/missing_conditional_section`, and all 4 script-bearing skills are non-compliant today — wiring it first reds four shipped artefacts and the fix looks like a linter regression | 1.1 strictly precedes 1.2 in the same change; 1.3's third case pins that a script-free skill stays clean | Phase 1 — Enforce the one required section whose population is decidable |
| 2 | Hedge-word lint has a live false-positive class | product | Hedges are legitimate in this tree's own honesty prose; a check over rule bodies will flag "may", "typically", "in doubt" in the very rules that teach calibrated language | Diff-scoped per ADR-218:93; measured FP rate plus a written advisory→error trigger before it can fail a build; quote-the-ban carve-out modelled on `lint_provenance_vocabulary.ts:14-17` | Phase 5 — Hedge-word lint, diff-scoped, with a declared escalation stage |
| 3 | A declarative frontmatter key is a wider surface than it looks | implementation | `skill.schema.json:8` is `additionalProperties: false`, so keying the other two sections on a declared property touches the schema, the frontmatter validator, and every generator that reads skill frontmatter | Held behind `blocker: conditional-section-population-key`; the reclassification alternative (drop `required` from the two headings) needs no schema change at all | Phase 1 — Enforce the one required section whose population is decidable |
| 4 | A bound external cite can rot silently | implementation | Pointer grammar #3 is an existence-and-date check — `docs/CLAIMS.md:46` says plainly "not fetched in CI" — so a bound arXiv row stays green after the paper is withdrawn or renumbered | Bind only cites a normative sentence rests on (4.2), carry the dated stamp the grammar requires, and leave decorative citations unbound rather than manufacturing ledger rows | Phase 4 — Bind the external research citations to the ledger |
| 5 | skill-writing outgrows its budget | product | `src/skills/skill-writing/SKILL.md` is 661 lines and already carries 20 H2 sections; three more patterns plus a contrastive slot push it further against `size-enforcement` | Keep each new pattern to the ~15-line shape the existing patterns use (`:505-532` is the model); if the file crosses its budget, the pattern registry splits out rather than the patterns being dropped | Phase 2 — Extend the skill-writing pattern registry |

## Blockers

### blocker: conditional-section-population-key
- **Status:** resolved 2026-08-11 — **option 2 (reclassify)**, AI council, quorum
  2/2 (anthropic, openai), both members independently for option 2. Recorded
  reasoning: an authored frontmatter opt-in cannot detect the skill that should
  have opted in and did not, so it produces a gate with no coverage guarantee —
  unlike the `scripts/` predicate, whose population is a filesystem fact. Zero of
  289 skills had voluntarily adopted either section while both were labelled
  required, which is evidence the requirement never bound. Step 1.4 carries the
  three landed edits.
- **Owner:** maintainer
- **Blocks:** step 1.4 only. Phase 1 steps 1.1-1.3 (the script-bearing section
  and its gate), and all of Phases 2-7, proceed independently.
- **What to do:** Decide between two options for
  `## Rationalizations to reject` (`src/skills/skill-writing/SKILL.md:533`) and
  `## Non-negotiable deliverable` (`:556`), whose populations are not decidable
  from the tree. (1) Add a declarative skill-frontmatter key naming the pattern
  a skill opts into — a schema change under
  `src/scripts/schemas/skill.schema.json:8` `additionalProperties: false`, plus
  the frontmatter validator and every generator reading skill frontmatter.
  (2) Drop `required` from both headings so the label matches the enforcement
  that exists, leaving them optional patterns like `:505` and `:592`.
- **Resolved when:** The maintainer records option 1 or option 2 in this
  blocker, and step 1.4 is rewritten as the concrete steps that option needs.
