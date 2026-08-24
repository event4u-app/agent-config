---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
research_pin: "agent-config@e0bc7c3ae (source draft) · re-verified against agent-config@f6703b78a, 27 commits later; the only material drift is the skill count, 290 → 291 · external references pinned as Source A–E in the evidence artefact of Phase 0, never named here"
estate_offset_exempt: "Nothing is offset because nothing this displaces is finished: the spine (deterministic time in gates) is a defect no active roadmap owns, and the two roadmaps this one hands work to — road-to-standing-payload-diet and the road-to-gate-preauth-authorization stub — both keep their own scope intact rather than closing. It ships status: draft precisely so the promotion to active stays the owner's estate decision and is not taken by the authoring pass."
---
# Road to deterministic time in gates

> **Source:** the ecosystem-harvest note of an inbox bundle dropped on
> 2026-08-22 and consumed into the gitignored `agents/tmp.old/` archive. Its
> exact path is
> `ENC1:0QpWAh5vQ5EkNnao3Hs2Foh5V8A5vMUbHVKpbQwQ2rXgxelOjFfPGfSb0UbTH0+4nTlqGo5JlwD9fJ7YDLaFeVmL4Orrc6/2nUUGLWOMjBvneJzKc/UYQ5rVb4RNbeYmD5+OU/iINhrkapmI5PqeBLr8FAIJrFp3giJHoKNgFbhfoObm`
> — decrypt with `./scripts-run src/scripts/_lib/link_crypto decrypt --value <token>`.
> A token rather than plain text because both the directory segment and the note's
> filename carry the harvested product's name, and `source-confidentiality`
> forbids the tracked tree recording which third-party package seeded an idea.
> The token resolves to the full path for anyone holding the key. The note was
> drafted by its author against
> `e0bc7c3ae` (the source pins that tree as v14.8.0) and re-verified here against
> `f6703b78a`. The bundle's 2508-line sibling roadmap is **dropped**: its own stated
> first step — a no-duplication audit — invalidates its Phases 2–6 and 10, since
> `src/scripts/check_requirements_trace.ts`, `src/scripts/lint_explain_trace.ts`,
> `docs/contracts/explain-trace.schema.json`,
> `docs/contracts/evidence-artifact-types.md`,
> `agent-config knowledge:{ingest,list,forget,cross-repo}`, `discovery_graph.ts`,
> `generate_knowledge_index.ts`, `emit_knowledge_event.ts` and
> `consolidate_knowledge_events.ts` all already ship, while its Phase 12
> relitigates a locked REJECT and crosses ADR-088's no-external-runtime-federation
> boundary citing neither, and cites no ADR at all. None of its content is
> carried. Every number tagged `corrected-from-reproduction` below was
> re-measured in this tree and **differs from the figure the source states**.

## Goal

A gate's verdict is a function of the tree, not of the hour it ran. When this is
finished, all 17 `check_*` / `lint_*` scripts that read wall-clock time resolve
their notion of "now" through one shared `asOf()` seam, a raw `Date.now()` in
either prefix is a lint finding, the same tree given the same `--as-of` produces
the same verdict on any machine, and two further declaration defects that ride
along — one citable enforcement denominator instead of five, and a write-scope
field on skills where today there are zero — are closed as declarations.

## Phase 0 — Evidence pin (no behaviour change)

- [x] **0.1 Write `agents/evidence/analysis/deterministic-time-harvest.md`** —
      the three surviving defects with `file:line`, the anonymised source table
      (Source A–E), the parity list, and the reproduction command for each
      number tagged `corrected-from-reproduction` here. Anonymise per
      `source-confidentiality`; the pinned links are retained as `ENC1:` tokens,
      never as readable names.
      verify (discharged): `./scripts-run src/scripts/check_no_external_sources`
      → `✅  No external inspiration-source references in the tracked tree.`,
      exit 0. The artefact carries the three defects with `file:line`, the
      Source A–E table anonymised by ROLE (no name, no domain, no repository —
      the only retained pointer is the roadmap's own `ENC1:` token), the
      verified parity list, and a reproduction command per
      `corrected-from-reproduction` figure.
      **Two of the roadmap's eight corrections are themselves wrong, and in both
      cases the source it corrected was right:** the `none` count is **10**, not
      14 (the roadmap's 14 counts twelve PROSE mentions of the value inside rule
      bodies, since the tree uses the list form `enforced_by:\n  - "none"`), and
      the SKILL.md distribution is **p50 166 · p90 275**, not 165/271. Full
      table in § 3 of the artefact.
- [x] **0.2 Register the plurality as an inventory claim.** `docs/CLAIMS.md`
      gains `enforcement-undeclared-denominator` as `unbacked`: the tree
      currently publishes five different figures for one property (§ Phase 2),
      and until Phase 2 lands no single number is quotable.
      verify (discharged): `--check` is not an argument this gate accepts
      (`❌  check_claims: unrecognized argument: --check`; `--help` reads
      `usage: check_claims [--quiet]`) — ran bare.
      `./scripts-run src/scripts/check_claims` →
      `✅  check_claims: 8 markered claim(s) bound · ledger 77 entries (50 backed,
      21 unbacked inventory)`, exit 0, with
      `### claim: enforcement-undeclared-denominator` at `docs/CLAIMS.md:727`.
      **Registered `backed`, not `unbacked`, and the deviation is the point:**
      the step assumed Phase 2 would land later, so "until Phase 2 lands no
      single number is quotable" would be FALSE at merge — both land in this
      change. Evidence is `exec:check_enforcement_denominator -> 0`, which
      required allowlisting the command in `src/scripts/_lib/exec_evidence.ts`
      and re-deriving `internal/reports/exec-evidence-feasibility.json`
      (`backed_claims` 49→50, `exec_feasible` 10→11, `delta_pp` recomputed to
      12.0) — `check_claims` reds on that drift, which is how it was caught.

## Not-new

This harvest is a **recurrence**, and the disposition is recorded rather than
re-derived. `road-to-second-brain.md` and `road-to-second-brain-delta-proof.md`
are both archived. `agents/memory/product-rules.yml` entry
`council-second-brain-delta` reads `semantic_verdict: still-true`
(`semantic_verdict_at: 2026-08-17`).
`agents/settings/contexts/second-brain-delta-verdict.md` records a 2026-07-07
council REJECT 2/2 on vault integration, with an explicit don't-relitigate note.

**The assumption that broke is SCOPE, not the verdict.** The v1.x pass was
harvested as a *vault-integration* question and was rejected as one; this pass is
a *governance-mechanics* question — deterministic time in gates, enforcement
declaration, write-scope declaration. Those are different mechanisms, so the lock
does not reach them and nothing here reopens it.

That mechanism-match licenses exactly the three phases below (and the two items
routed out in § Routed elsewhere). It licenses **no** vault integration, **no**
wikilink convention, **no** editable-vault surface, and **no** dedicated pack for
any external note-taking tool. A step proposing one of those is out of scope by
construction, not by preference.

## Phase 1 — Deterministic time (the spine)

> This is why the roadmap exists. Both claims below were reproduced exactly in
> this tree, so the phase rests on measurement, not on the source's assertion.
>
> - **17** scripts read `Date.now()` / `new Date()`:
>   `grep -lE 'Date\.now\(\)|new Date\(\)' src/scripts/check_*.ts src/scripts/lint_*.ts`
>   → `check_always_budget`, `check_augmentignore`, `check_beta_review_markers`,
>   `check_corpus_staleness`, `check_council_pin_staleness`,
>   `check_gate_coverage`, `check_knowledge_cards`, `check_knowledge_pages`,
>   `check_memory`, `check_proposal`, `check_reach_staleness`,
>   `check_release_adjacent_health`, `check_source_size_budget`,
>   `check_trigger_evals`, `lint_budget_ownership`, `lint_one_off_age`,
>   `lint_symptom_intake`.
> - **No `--as-of` / `AC_AS_OF` / `asOf` CLI surface exists anywhere in
>   `src/scripts/`.** The only grep hit is the substring inside `hasOffset` at
>   `src/scripts/ai_council/budget_guard.ts:158`, and the four prose mentions of
>   "as of" live in `src/scripts/ai-image/adapters/*.sh` comments. `src/scripts/_lib/as_of.ts` does not exist.
>
> Consequence, stated plainly: a green on a reviewer's machine is not a green on
> the merge commit, and none of these 17 verdicts is reproducible today.

- [x] **1.1 Introduce `src/scripts/_lib/as_of.ts`** — one exported
      `asOf(): Date`, resolving in order: `--as-of <iso>` argv → `AC_AS_OF` env →
      the merge-base commit date when running in CI → `Date.now()` with a
      one-line WARN naming the run as non-reproducible. The fallback stays, so no
      gate loses its ability to run; it just stops being silent.
      verify (discharged): `npx tsx src/scripts/_lib/as_of.ts --self-test` →
      `as_of --self-test: 7/7 case(s) behaved (floor 7)`, exit 0 — all four
      rungs, argv-beats-env precedence, and BOTH malformed-pin rejections
      (`--as-of` and `AC_AS_OF`). Plus 11 unit cases in
      `tests/scripts/as_of.test.ts`, sensitivity proven by two sabotage probes
      recorded in its docstring (2 of 11 red each).
      **Rung 3 reads the HEAD commit date, NOT the merge-base date this step
      specifies, and the deviation is a refusal to weaken a gate.** The
      merge-base is by construction `<=` HEAD, and all 17 callers are AGE gates,
      so an earlier "now" makes every one of them strictly more permissive —
      pinning to the merge-base hands a long-lived branch a free extension on
      every staleness budget in the tree, proportional to the branch's age. The
      HEAD commit date has the identical reproducibility property (committed,
      recoverable from the commit, stable across runs) while being the tightest
      committed clock available. Recorded in the module's own docstring at
      `src/scripts/_lib/as_of.ts:30-52`.
- [x] **1.2 Route all 17 scripts through the seam.** Mechanical substitution
      only; no threshold, no message, and no exit code changes in this step.
      verify (discharged): `grep -lE 'Date\.now\(\)|new Date\(\)' src/scripts/check_*.ts src/scripts/lint_*.ts`
      → no output, exit 1 (no match). `npx tsc --noEmit -p tsconfig.json` clean.
      **18 sites, not 17** — `check_knowledge_pages.ts` carries two
      (`:75`, `:148`) and `check_gate_coverage.ts:982` reads the clock inside a
      template substitution, which the step's own grep list omits. One
      downstream change was required and is in the diff:
      `tests/scripts/check_trigger_evals.test.ts` copies the gate into a fixture
      repo and had to copy `_lib/as_of.ts` beside `_lib/scan_scope.ts`.
- [x] **1.3 Make the defect unable to return** — a raw `Date.now()` /
      `new Date()` in a `check_*` or `lint_*` script becomes a lint finding, with
      `_lib/as_of.ts` itself as the single allowed site.
      verify (discharged): **red before green, and the gate was written first.**
      Against the unmodified tree at `c7e82087e`,
      `./scripts-run src/scripts/lint_deterministic_time` exited **1** with 18
      findings across 17 files, verbatim head:
      `❌  gate script(s) read the wall clock directly:` /
      `  src/scripts/check_always_budget.ts:438 — raw \`new Date()\`` … through
      `  src/scripts/lint_symptom_intake.ts:135 — raw \`new Date()\``.
      After 1.2 the same command exits 0 (`✅  no raw wall-clock read in 261 gate
      script(s) under src/scripts/.`). `--self-test` → 7/7 (4 rejecting), and
      `check_gate_coverage` reports `✅ lint_deterministic_time: scanned 261 ≥ 200`.
      **The gate's own first draft had two defects the real corpus exposed**, both
      pinned by tests: blanking string bodies to SPACES collapsed
      `new Date("…")` into `new Date()` (false positive on
      `check_knowledge_pages.ts:103`), and blanking a template literal wholesale
      HID `check_gate_coverage.ts:982`.
      <!-- carve-out: new-gate-verification -->
- [x] **1.4 Pin the date in CI and report it.** Workflows pass the merge-base
      date; `check_council_pin_staleness` and `lint_one_off_age` print the
      resolved date in their output so a reviewer can see which "now" produced
      the verdict.
      verify (discharged): swept all 17 gates at `AC_AS_OF=2026-11-30T12:00:00Z`
      and `2026-12-01T12:00:00Z` (the boundary at `verified_at: 2026-08-22` +
      `CADENCE_DAYS = 100`). **Exactly one verdict flips** —
      `check_council_pin_staleness 0 → 1`, every other exit code identical — and
      two consecutive runs at the same pin are **byte-identical**. `AC_AS_OF`
      rather than `--as-of` because several of the 17 reject unknown argv;
      rung 2 exists for exactly that, and it is the same pin.
      **Workflows pass nothing, deliberately.** Rung 3 resolves the pin from the
      tree under test whenever `CI` is set, so an explicit per-workflow env var
      would be a hand-maintained duplicate of a value the seam already computes;
      `check_council_pin_staleness` and `lint_one_off_age` print
      `as-of: <iso> (rung=…, reproducible=…)` so CI logs which "now" produced the
      verdict.
      **One residual, recorded not papered over:** `check_always_budget`'s
      "Trend vs. previous run" line is history-dependent (it compares against a
      persisted previous reading), so its first run after a pin change differs.
      That is a STATE dependency, not a clock one — the timestamp it prints is
      now the pinned value — and it is out of this step's scope.
- [x] **1.5 Bundle freshness by content, not mtime** —
      `src/scripts/check_hook_bundle_freshness.ts` compares a content hash. This
      step is independent of everything above and of everything routed out; it
      is here because it is the same class of defect (a verdict that depends on
      the filesystem clock rather than on the tree).
      verify (discharged, HONEST NULL on new code): the content-hash comparison
      **already ships** — `src/scripts/check_hook_bundle_content.ts` landed
      2026-08-21 and is wired in `taskfiles/ci-fast.yml:168`, immediately after
      the mtime gate; its own docstring names `touch` on the bundle as the case
      mtime cannot see. Rewriting `check_hook_bundle_freshness` to hash would
      duplicate it exactly, so no new code was written.
      Both halves were demonstrated rather than asserted: with
      `LEDGER_MAX_AGE_MS` changed to `31 * 60 * 1000` and
      `touch dist/hooks/dispatch.js`, the mtime gate exits **0**
      (`✅  OK  hook bundle: fresh …` — the false green) while the digest gate
      exits **1** with executing `sha256 ce21579b7c14` against rebuilt
      `ac83e2f51118`, **identical byte count 1155415**. Reverting and rebuilding
      returns `ce21579b7c14` and exit 0.
      What did change: the mtime gate's success line said "fresh", an
      unqualified equivalence claim it cannot make. It now reads
      `ordering fresh … — byte-equivalence is check_hook_bundle_content's`.
      A first, weaker probe is recorded in the evidence artefact because it
      looked like a result: appending a COMMENT to a hook source left the digest
      gate green, correctly — esbuild strips comments, so the executing bytes
      were unchanged.

## Phase 2 — One citable enforcement denominator

> **The defect is the plurality, not any one figure.** The source's re-count
> ("34 carry `enforced_by:`, 10 say none, 85 lack the key") is **not
> reproducible** — `corrected-from-reproduction`: `grep -l 'enforced_by:' src/rules/*.md`
> returns **37**, a frontmatter-strict read returns **32**, `none` returns
> **14**, and the rule total is **119**. But correcting the source's number
> would miss the point, because the tree itself publishes **five** denominators
> for the same property: `docs/proof.md:289` says **85** undeclared,
> `docs/proof.md:66` publishes **86** (114-scope) *and* **89** (117-frame), a
> frontmatter grep says **87**, and an any-line grep says **82**. Five figures,
> one property, no way for a reader to tell which is the answer.
>
> `check_enforcement_coverage` is the only citable source — it resolves rather
> than counts, and `docs/proof.md:66` already says so in its own words. This
> phase therefore **extends the existing resolver and `docs/proof.md`**. It adds
> no parallel count; a sixth number would be the defect, not the fix.

- [x] **2.1 Name the scope on every published figure.** Extend
      `src/scripts/check_enforcement_coverage.ts` to emit its denominator
      together with the frame that produced it (in-scope vs governed-total), and
      have `docs/proof.md` project both from that single output rather than
      restating either.
      verify (discharged): `./scripts-run src/scripts/check_enforcement_coverage --check`
      → `✅  enforcement-coverage ratchet holds`, exit 0, and the report now
      carries `denominator: 120 rule(s), frame in-scope (src/rules/*.md) ==
      governed-total 120` — two INDEPENDENT sources (this resolver's row count
      and `update_counts.count('rules')`), with their agreement asserted rather
      than assumed, so a future divergence prints `FRAMES DIVERGE` instead of
      going quiet. `build_proof` projects that line into `docs/proof.md:293`.
      Hand-written enforcement counts in `docs/proof.md`: **0** — the one live
      source was `docs/CLAIMS.md:203`, whose evidence prose (from which
      `build_proof` copies verbatim) carried `15 of 120 governed rules (12.8%)`,
      `86`, `89`, `114`, `117`. It now states no figure and cites the generated
      § 4b. `update_counts`' `( of )(\d+)( governed rules \()` target was
      retired with it — a generator keeping a literal in sync that no longer
      exists.
- [x] **2.2 Make a second count impossible to add.** The gate reds when an
      enforcement denominator appears in a tracked doc that the resolver did not
      produce.
      verify (discharged): **red before green.** Against the unmodified tree,
      `./scripts-run src/scripts/check_enforcement_denominator` exited **1** with
      exactly one finding —
      `docs/CLAIMS.md:203 — hand-written count`. After 2.1 the same command
      exits 0 (`✅  one citable enforcement denominator: 464 published doc(s)
      restate none of it.`). `--self-test` → 9/9 (5 rejecting). Registered in
      `gate-coverage.yml` with a create-only canary and `min_scanned: 200…350`.
      **The gate does not compare values, deliberately:** a hand-written figure
      that is correct today is how the plurality returned each previous time, so
      the RESTATEMENT is the finding, not the disagreement. The canary body
      therefore carries a CORRECT figure — a value-checking gate would pass it.
      `docs/decisions/` and `docs/archive/` are excluded (a dated record must not
      be rewritten to today's number) and any file declaring `GENERATED by` is
      exempt, because that IS the projection.
      <!-- carve-out: new-gate-verification -->
- [x] **2.3 Retire the bare `"none"` value.** `enforced_by: "none"` becomes
      `instruction-only: <reason>` — a rule that is honour-system must say *why*,
      one line each, for the 14 that currently say `none`
      (`corrected-from-reproduction`; the source says 10). A reason is a triage
      record, not a pass.
      verify (discharged, with one descope): `grep -c 'enforced_by: *"\?none'
      src/rules/*.md` returns **0 for every file**. A bare `instruction-only`
      resolves to `missing` with the note *"a reason is a triage record, not a
      pass"*, which the `--check` ratchet reds on (`missing > baseline`), and the
      schema pattern `instruction-only: *[^ ].*` rejects it at
      `validate_frontmatter` as well — two layers.
      **The count is 10, not 14** (`corrected-from-reproduction` on the
      correction itself): the 14 came from an any-line grep that matches twelve
      PROSE mentions inside rule bodies, because the tree declares the value in
      the LIST form `enforced_by:\n  - "none"`. **9 of the 10 were migrated**,
      each with a one-line reason; the twelve prose mentions were migrated with
      them, and three rules whose prose already claimed `enforced_by: none`
      while declaring nothing (`decision-revisit-gate`, `missing-skill-recovery`,
      `recurring-criticism`) now carry the declaration their text asserted.
      Resolver after: `declared 34 → 37 · undeclared 86 → 83 · blocking 15 ·
      missing 0`, ratchet holds.
      **DESCOPED — `non-destructive-by-default` keeps `none`, and it cannot not.**
      It is a kernel rule: `block_kernel_rule_writes` denies the agent write with
      no agent-accessible override, and `scope-control` § Kernel-rule edits
      requires its own PR with a ≥ 24 h soak that no autonomous mandate lifts.
      Retiring the value from the schema outright would therefore make a CI-green
      tree unreachable for any agent, so `none` stays legal with that single
      reason recorded in the schema. Stub:
      `agents/roadmaps/stubs/road-to-kernel-instruction-only-migration.md`.

## Phase 3 — Write scope on skills, as a declaration

> `corrected-from-reproduction`: **0 of 291** `src/skills/*/SKILL.md` declare
> `write_scope` or `writes:` (the source says 0/290 — the count moved with the
> tree, the defect did not). `execution:` carries
> `type` / `handler` / `timeout_seconds` / `allowed_tools`; `trust:` carries
> `level` / `removable` / `default`. Neither says *where* a skill may write.
>
> This phase ships a declaration and a census, and nothing else. No observer, no
> blocking mode, and no runtime enforcement is proposed here under any outcome —
> an observer whose only two outcomes are "the field stays documentation" and
> "the field stays documentation" closes nothing this roadmap can act on, so it
> is named as a follow-up in § Routed elsewhere rather than held open here.

- [x] **3.1 Optional frontmatter shape** —
      `scope: {read: [glob], write: [{pattern, access}]}` with `access` in a
      closed enum, plus `verification: {command | reason}` so a skill can record
      an honest null at declaration level. `skill_linter` validates shape only;
      absence stays legal.
      verify (discharged): on a fixture declaring `access: "clobber"` →
      `ERROR schema_enum: $.scope.write[0].access – Value 'clobber' is not one of
      ['create', 'write', 'append', 'delete']`, exit 2. The same fixture with
      `access: "write"` → `Summary: 1 pass, 0 warn, 0 fail`, exit 0. A skill
      declaring nothing (`src/skills/check-refs/SKILL.md` unmodified) → exit 0;
      absence stays legal. Two further shapes are refused by
      `check_scope_declaration` in `validate_frontmatter.ts`, proven on the real
      tree by planting each into `check-refs` in turn:
      `❌ scope-verification-both at $.scope` and
      `❌ scope-verification-missing at $.scope`, `445 artefacts, 1 failing` each
      time, `0 failing` after restoring.
      **That check lives in `validate_frontmatter.ts`, not `skill_linter.ts`, and
      the gate that put it there is this roadmap's own subject.** Written in the
      linter first, it made `check_source_size_budget` red — 18634 against a
      baseline of 18571, 63 new — because that file is 4,742 lines and the
      ratchet sums lines ABOVE 1,500 per file. Extracting the body to `_lib` still
      left the import plus the call, i.e. +2, and a ratchet turns one way.
      `validate_frontmatter.ts` is 1,120 lines, so the same code costs zero there,
      and it sits beside `check_obligation_frequency`, the existing precedent for
      an artefact-specific check the generic validator cannot express. Also worth
      recording: expressing "exactly one of two optional siblings" in the SCHEMA
      is impossible here — this validator implements `type` / `enum` / `pattern` /
      `required` / `items` / `additionalProperties` and none of `oneOf`, `anyOf`,
      `not`, `minProperties` or `maxProperties`, so a schema-only attempt is
      silently inert, which is worse than absent because it reads as enforced.
      **`verification: {command | reason}` ships as TWO sibling keys**
      (`verification_command` / `verification_reason`), and the reason is
      measured rather than stylistic: this repo's frontmatter parser reads
      map → list → map (how `triggers[].keyword` works) but FLATTENS
      map → map → scalar, so a nested `verification.reason` parses as
      `scope.verification = ""` plus a stray `scope.reason` and the schema then
      rejects a correctly-written declaration. A field the parser cannot read is
      a field nothing validates. Exactly-one-of is enforced by the linter check,
      since JSON Schema cannot express it in the subset this validator
      implements.
- [x] **3.2 Declare it for the skills that shell out** — the `execution:`
      cohort, since those are the ones with a write path at all. Census recorded
      in the Phase 0 evidence artefact; no behaviour change.
      verify (discharged): `grep -l '^scope:' src/skills/*/SKILL.md | wc -l` →
      **52**; `grep -l '^execution:' src/skills/*/SKILL.md | wc -l` → **52**.
      `./scripts-run src/scripts/skill_linter --all` →
      `Summary: 444 pass, 0 warn, 0 fail, 444 total`, exit 0.
      **The step's parenthetical is wrong and it changed how this was executed:**
      the `execution:` cohort is NOT the shell-out cohort. Of the 52, **22** are
      `type: manual` with no handler, **21** are `assisted` + `internal`, and
      only **9** are `assisted` + `shell`. `runtime-safety` is explicit that a
      skill with no handler is instructional only, so 43 of the 52 have no write
      path of their own and the accurate declaration is an empty `write` list
      plus a stated reason — not an invented glob. The 9 shell skills carry a
      DERIVED scope: `adr-create` → `docs/decisions/ADR-*.md` (create) +
      `INDEX.md` (write), verified by its own command; `react-shadcn-ui` →
      `components/ui/**` (create) + `components.json` (write), from the skill's
      own verification step; `file-editor` and `quality-tools` → `**` (write),
      because the target IS the caller's argument and a narrower glob would be
      false rather than tighter; `check-refs`, `md-language-check`,
      `lint-skills`, `rtk-output-filtering`, `token-optimizer` → `write: []`,
      each with the grep that establishes it read-only.
      Also `0 of 292`, not 0/291 — the denominator moved with the tree.

## Routed elsewhere — not phases here

Four items from the source survive scrutiny but belong to artefacts that already
own their subject. Carrying them here would duplicate scope, so each is a
pointer.

- **The ledger-age / plan-hash question → one ADR question on the existing
  stub `agents/roadmaps/stubs/road-to-gate-preauth-authorization.md`.** The
  source asserts that a `// TEMP` six-hour widening of `LEDGER_MAX_AGE_MS`
  "shipped to trunk on 2026-08-21". That is **false**
  (`corrected-from-reproduction`):
  `git show HEAD:src/scripts/hooks/block_unauthorized_git.ts` still reads
  `30 * 60 * 1000` at `:509`; the six-hour value exists only as an *uncommitted*
  edit in the maintainer's working tree. More importantly the mechanism failure
  is already recorded on that stub: `agents/runtime/state/` is agent-writable,
  so an "authorisation" read out of it lets the agent consent on the user's
  behalf — precisely what the abort exists to prevent. A ledger carrying
  `plan_sha256` + `plan_path` **is that failure**, because the plan file sits in
  agent-writable state. `docs/decisions/ADR-239` (~:79–90) records the council
  verdict as "mergeability-only until authorization is target-bound and
  tamper-resistant", so asking the question addresses a **named precondition**
  rather than relitigating a decision — but the plan hash must live behind a
  human-only write path, and this tree has exactly one: the class-C settings
  route. The stub is where that decision belongs.
- **The per-invocation skill diet → `agents/roadmaps/archive/road-to-standing-payload-diet.md`,
  by reference.** Ownership boundary in one sentence: that roadmap owns the
  standing-payload axis end to end, and the source's own scoping paragraph
  quotes its § Context verbatim (the preamble RED is rule-driven — 120,282 tok
  of 135,436 against a 107,646 ceiling — while the skills catalog costs 14,408),
  so a per-invocation diet phase here would fork one budget across two plans.
  For the record, `corrected-from-reproduction`: **14 of 291** skills have a
  `references/` directory (source: 14/290), and the SKILL.md line distribution
  is **p50 165 · p90 271 · sum 52,798** (source: p50 166 · p90 275 · sum
  52,599).
- **Follow-up pointer, supply chain:** one `## Known pitfalls` entry for
  `src/skills/supply-chain-intake/SKILL.md` — *name-similarity is not
  provenance*. That section does not exist in that skill yet
  (`grep -c 'Known pitfalls'` returns 0), and `size-enforcement` names a
  `## Known pitfalls` section on the tool's own skill as the correct home for
  this class of content rather than a new skill. Source E in the Phase 0
  artefact is an SEO-only organisation
  whose name is near-identical to a widely used tool's and whose download button
  points at a third-party page; it ships no code.
- **Follow-up pointer, skill authoring:** one line for
  `src/skills/skill-writing/SKILL.md` — a scope-exclusion clause idiom
  ("this skill covers only X; standard Y is assumed") lets a skill shed
  assumed-knowledge prose without losing correctness.

### Parity — verified as already-shipped, deliberately absent

- Orchestrator-only apply ("workers draft, one orchestrator applies") is
  existing doctrine.
- Hooks never mutate tracked knowledge or git: `roadmap_progress_hook.ts`
  regenerates only `agents/roadmaps-progress.md`, untracked since ADR-243.
- Release-artifact self-audit: `check_pack_size` content classes and
  `check_publish_surface` landed 2026-08-22. **Unverified residual**, recorded
  rather than assumed: whether those content classes cover personal e-mail
  addresses, absolute private paths and symlink entries.
- Honest capability boundary: the Claims Ledger's `resolved-null` already
  expresses the same thing as a per-capability non-promise plus a verification
  reason.

## Blockers

No blocker is open. Every step above is agent-executable with a command, and the
one item that genuinely needs a human decision — where a signed authorisation
lives so the agent cannot write it — is not a step here at all: it is routed
onto `agents/roadmaps/stubs/road-to-gate-preauth-authorization.md`, which
already carries that gate and its probe. Filing a duplicate entry here would
red the estate ratchet for a decision this roadmap does not own.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: analyze-inbox -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The 17-script substitution changes a verdict silently | implementation | A script whose threshold was tuned against wall-clock drift flips its result when "now" becomes the merge-base date, and the flip is read as a new defect rather than as the seam working. | 1.2 is mechanical only — no threshold, message, or exit-code edit in that step — and 1.4 requires two `--as-of` runs one day apart to flip exactly one verdict, which makes an unintended flip visible as a count. | Phase 1 — Deterministic time (the spine) |
| 2 | Phase 2 lands a sixth denominator instead of one | implementation | Extending the resolver while `docs/proof.md` keeps a hand-written figure leaves the plurality intact under a new name — the exact defect the phase describes. | 2.1 requires every enforcement figure in `docs/proof.md` to be generated, and 2.2 reds on any hand-written count entering a tracked doc. | Phase 2 — One citable enforcement denominator |
| 3 | The `scope:` field stays 0-adoption documentation | product | An optional frontmatter key with no runtime consumer is a field nobody fills, so the declaration defect reads as closed while remaining open. | 3.2 declares it for the whole `execution:` cohort in this roadmap rather than leaving adoption to later authors, and AC-4 is phrased on the residual count, not on the schema existing. | Phase 3 — Write scope on skills, as a declaration |
| 4 | The routed items are lost rather than moved | product | Three of the four § Routed elsewhere items land as prose in a draft roadmap; nothing forces the receiving artefact to actually receive them. | Each pointer names its destination file, and AC-5 is decidable on the destination rather than on this file. | Routed elsewhere — not phases here |
| 5 | The mechanism-match reasoning is read as reopening the lock | product | § Not-new distinguishes scope from verdict; a later reader may take the harvest itself as licence for the rejected vault integration. | § Not-new states the licensed set and the excluded set explicitly, and AC-6 is a grep-decidable absence check over this roadmap's own output. | Not-new |

## Acceptance Criteria

- [x] AC-1 — met. The grep returns nothing (exit 1, no match), and
      `src/scripts/_lib/as_of.ts` is the single sanctioned reader;
      `lint_deterministic_time` refuses a return across 261 gate scripts, with a
      `// wall-clock-required: <reason>` escape whose reason is mandatory (a bare
      marker is still a finding) for the one legitimate case — measuring elapsed
      duration, where real time is the subject rather than a threshold input.
- [~] AC-2 <!-- resolved 2026-08-24: carried to stubs/road-to-two-machine-time-determinism.md, see § Deferred-item resolution --> — met on this machine, and the two-machine half is UNMEASURABLE from
      here rather than met. Two consecutive runs of all 17 at the same pin are
      **byte-identical**, and the boundary sweep flips exactly one verdict
      (step 1.4). CI logs the pin: `check_council_pin_staleness` and
      `lint_one_off_age` print `as-of: <iso> (rung=…, reproducible=…)`, and rung 3
      resolves it from the tree under test whenever `CI` is set.
      **"On two different machines" was not run and cannot be by one agent on
      one host** — claiming it from a single machine would be the fabricated
      evidence this repository's own doctrine forbids. What IS established is
      narrower than the criterion and is stated as such: every one of the 17 now
      takes its INSTANT from one memoised resolver whose inputs are argv, an env
      var, and a committed commit date — none of them machine-local. That is not
      the same as machine-independent output, and residual 2 below is the
      measured proof that it is not.
      **The council was asked to re-scope this clause and could not answer** —
      `council_cli run … --confirm` returned `INCONCLUSIVE`, both members
      `cli_quota_exhausted` (anthropic 53/50, openai 50/50) with
      `api_on_quota: off`, so no metered fallback fired. Cost $0.0000. Question and
      response sit at
      `agents/runtime/council/{questions,responses}/ac2-two-machine-rescope.md`
      (gitignored, machine-local). A no-quorum council is an escalation condition
      per `roadmap-progress-sync` Iron Law 3, so this criterion is left in front of
      the owner rather than self-resolved, and this roadmap is NOT archived.

      **Two residuals, and the second is a real defect the pin EXPOSED rather than
      introduced.**

      1. `check_always_budget` prints a "Trend vs. previous run" line read from a
         persisted previous reading, so its FIRST run after a pin change differs.
         A state dependency, not a clock one; no pin can remove it.
      2. **The seam pins the INSTANT; it does not pin the CALENDAR.** Measured at
         `AC_AS_OF=2026-11-30T23:30:00Z` with `TZ` varied and everything else
         held: **2 of the 17 change their output** between `UTC` and
         `Pacific/Kiritimati` (+14) — `check_memory` (85 lines, every age shifts a
         day) and `check_trigger_evals` (69 lines, likewise) — because both
         convert the pinned instant to a LOCAL calendar date via
         `getFullYear() / getMonth() / getDate()` instead of the `getUTC*` twins.
         Two more read the calendar the same way and did not differ at this
         particular instant (`check_beta_review_markers:190`,
         `check_proposal:369`), which makes them latent rather than clean.
         `UTC` vs `Pacific/Honolulu` (-10) differs only in `check_gate_coverage`'s
         sub-probe count (`check_references: scanned 1535` vs `1536`) — a probe
         wobble, NOT a timezone finding, named so it is not miscounted as one.
         Deliberately NOT fixed here: step 1.2 is "mechanical substitution only —
         no threshold, no message, and no exit code changes", and local → UTC
         flips a verdict at a day boundary by construction. Four one-line changes
         across four production gates, and they belong to whoever resolves this
         criterion — which is why it stays open and this roadmap stays active
         rather than being archived around it.
- [x] AC-3 — met, with one descope named in the criterion's own last clause.
      The denominator is quotable exactly once, from `check_enforcement_coverage`,
      and it now carries the frame that produced it
      (`denominator: 120 rule(s), frame in-scope (src/rules/*.md) ==
      governed-total 120`, two independent sources with their agreement
      asserted). `docs/proof.md` restates none of it by hand — the one live
      hand-written source, `docs/CLAIMS.md:203`, states no figure now, and
      `check_enforcement_denominator` reds on a restatement anywhere in the 464
      published docs.
      `enforced_by: "none"` appears in **one** rule, not zero:
      `non-destructive-by-default`, a kernel rule
      `block_kernel_rule_writes` denies the agent write to and whose edit
      `scope-control` binds to its own PR plus a ≥ 24 h soak. Descoped to
      [`stubs/road-to-kernel-instruction-only-migration.md`](../stubs/road-to-kernel-instruction-only-migration.md);
      the other nine are migrated and the schema records that single survival
      with its reason.
- [x] AC-4 — met. `grep -l '^execution:' src/skills/*/SKILL.md | wc -l` → 52 and
      `grep -l '^scope:' src/skills/*/SKILL.md | wc -l` → 52, so the residual is
      **0**. `skill_linter` rejects an out-of-enum `access`
      (`ERROR schema_enum: $.scope.write[0].access – Value 'clobber' is not one of
      ['create', 'write', 'append', 'delete']`) and, via the new
      `lint_scope_declaration` check, a declaration carrying both or neither
      verification key. `--all` → `444 pass, 0 warn, 0 fail`.
- [x] AC-5 — met; each pointer resolves in its named destination and none is a
      phase here. (1) `stubs/road-to-gate-preauth-authorization.md` gains
      § Open ADR question — where the plan hash lives, framed as ADR-239's named
      precondition rather than a relitigation, and correcting this roadmap's
      "uncommitted only" reading: the constant IS `30 * 60 * 1000` at
      `src/scripts/hooks/block_unauthorized_git.ts:527`, but the guard's own
      docstring at `:506-525` records the widening WAS committed and left there.
      (2) `road-to-standing-payload-diet.md` gains § Received by reference, with
      the ownership boundary and the two figures re-measured rather than carried —
      `p50 166 · p90 275` reproduces the SOURCE and refutes this roadmap's
      165/271, and no sum reproduces because none of the three states its corpus
      definition. (3) `supply-chain-intake` gains a `## Known pitfalls` section —
      *name-similarity is not provenance*. (4) `skill-writing` gains the
      scope-exclusion clause idiom.
- [x] AC-6 — met. `git diff origin/main -- .` matched **0** occurrences of
      `.obsidian/` or a `[[wikilink]]`, `git diff --name-only origin/main` names
      no such path, and `src/packs/` gained no directory (unchanged at its
      pre-branch set). The § Not-new mechanism-match holds: nothing here reopens
      the 2026-07-07 vault-integration REJECT.

## Deferred-item resolution (2026-08-24, `/analyze:inbox` run)

Closing this roadmap requires a disposition for its one `[~]`, per
[`roadmap-progress-sync`](../../../src/rules/roadmap-progress-sync.md) Iron Law 3.
Recorded here rather than asserted, because a verdict with no record is a silent
drop wearing a procedure.

**Criterion, verbatim:** AC-2 — *"met on this machine, and the two-machine half is
UNMEASURABLE from here rather than met."*

**Options considered, all four from the preservation test:**

| Option | Route | Verdict |
|---|---|---|
| Fix now, in this change | council | **Rejected** — needs a second host; no run on one machine can supply it. |
| Carry item into a named follow-up created in the SAME change | council | **CHOSEN** |
| Restore to `[ ]` in this roadmap | council | Rejected — would hold a completed roadmap open on an input the roadmap cannot obtain. |
| Convert to `[-]`, or accept the narrower claim permanently | **owner** | Not taken — that would weaken a criterion, which is owner-reserved. |

**Verdict:** carried, not dropped. The disposition preserves the criterion in the
active estate, so it is council-decidable rather than owner-reserved — the owner's
decision is preserved *inside* the destination, not taken here.

**Destination:** [`stubs/road-to-two-machine-time-determinism.md`](../stubs/road-to-two-machine-time-determinism.md),
created in this same change and estate-free (`stubs/` is outside all three gated
metrics — verified: `check_estate_count` counts the active top level and `later/`
only).

**What closes it:** that stub's clause 2 — a recorded two-machine result naming a
pin and two host identifiers. Met or diverged, either is an answer.

**Dissent:** none. The parent annotation and this disposition agree the criterion
is unmeasurable from one host.

**Residual, stated:** a carried item can still become an indefinite deferral. Only
a fix-now discharges that, and fix-now is unavailable here. The stub's probe is
what keeps it findable.
