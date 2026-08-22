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

- [ ] **0.1 Write `agents/evidence/analysis/deterministic-time-harvest.md`** —
      the three surviving defects with `file:line`, the anonymised source table
      (Source A–E), the parity list, and the reproduction command for each
      number tagged `corrected-from-reproduction` here. Anonymise per
      `source-confidentiality`; the pinned links are retained as `ENC1:` tokens,
      never as readable names.
      verify: `./scripts-run src/scripts/check_no_external_sources` exits 0.
- [ ] **0.2 Register the plurality as an inventory claim.** `docs/CLAIMS.md`
      gains `enforcement-undeclared-denominator` as `unbacked`: the tree
      currently publishes five different figures for one property (§ Phase 2),
      and until Phase 2 lands no single number is quotable.
      verify: `./scripts-run src/scripts/check_claims --check` exits 0 and lists
      the new id.

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

- [ ] **1.1 Introduce `src/scripts/_lib/as_of.ts`** — one exported
      `asOf(): Date`, resolving in order: `--as-of <iso>` argv → `AC_AS_OF` env →
      the merge-base commit date when running in CI → `Date.now()` with a
      one-line WARN naming the run as non-reproducible. The fallback stays, so no
      gate loses its ability to run; it just stops being silent.
      verify: `npx tsx src/scripts/_lib/as_of.ts --self-test` exits 0, covering
      all four resolution rungs plus a malformed `--as-of` rejection.
- [ ] **1.2 Route all 17 scripts through the seam.** Mechanical substitution
      only; no threshold, no message, and no exit code changes in this step.
      verify: `grep -lE 'Date\.now\(\)|new Date\(\)' src/scripts/check_*.ts src/scripts/lint_*.ts`
      returns nothing.
- [ ] **1.3 Make the defect unable to return** — a raw `Date.now()` /
      `new Date()` in a `check_*` or `lint_*` script becomes a lint finding, with
      `_lib/as_of.ts` itself as the single allowed site.
      verify: the new gate reds on a planted `Date.now()` in a `check_*` script
      and greens on the clean tree.
      <!-- carve-out: new-gate-verification -->
- [ ] **1.4 Pin the date in CI and report it.** Workflows pass the merge-base
      date; `check_council_pin_staleness` and `lint_one_off_age` print the
      resolved date in their output so a reviewer can see which "now" produced
      the verdict.
      verify: the same tree run with two `--as-of` values one day apart flips
      exactly one staleness verdict, and both runs are byte-reproducible.
- [ ] **1.5 Bundle freshness by content, not mtime** —
      `src/scripts/check_hook_bundle_freshness.ts` compares a content hash. This
      step is independent of everything above and of everything routed out; it
      is here because it is the same class of defect (a verdict that depends on
      the filesystem clock rather than on the tree).
      verify: `touch dist/hooks/dispatch.js` no longer passes; a rebuilt but
      byte-identical bundle still passes.

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

- [ ] **2.1 Name the scope on every published figure.** Extend
      `src/scripts/check_enforcement_coverage.ts` to emit its denominator
      together with the frame that produced it (in-scope vs governed-total), and
      have `docs/proof.md` project both from that single output rather than
      restating either.
      verify: `./scripts-run src/scripts/check_enforcement_coverage --check`
      exits 0, and every enforcement figure in `docs/proof.md` is generated —
      `grep -c` of hand-written enforcement counts in that file returns 0.
- [ ] **2.2 Make a second count impossible to add.** The gate reds when an
      enforcement denominator appears in a tracked doc that the resolver did not
      produce.
      verify: the gate reds on a planted hand-written count and greens on the
      clean tree.
      <!-- carve-out: new-gate-verification -->
- [ ] **2.3 Retire the bare `"none"` value.** `enforced_by: "none"` becomes
      `instruction-only: <reason>` — a rule that is honour-system must say *why*,
      one line each, for the 14 that currently say `none`
      (`corrected-from-reproduction`; the source says 10). A reason is a triage
      record, not a pass.
      verify: the resolver reds on a bare `instruction-only` with no reason, and
      `grep -c 'enforced_by: *"\?none' src/rules/*.md` returns 0.

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

- [ ] **3.1 Optional frontmatter shape** —
      `scope: {read: [glob], write: [{pattern, access}]}` with `access` in a
      closed enum, plus `verification: {command | reason}` so a skill can record
      an honest null at declaration level. `skill_linter` validates shape only;
      absence stays legal.
      verify: `./scripts-run src/scripts/skill_linter` reds on an `access` value
      outside the enum and greens on a skill that declares nothing.
- [ ] **3.2 Declare it for the skills that shell out** — the `execution:`
      cohort, since those are the ones with a write path at all. Census recorded
      in the Phase 0 evidence artefact; no behaviour change.
      verify: the declared count equals `grep -lc '^execution:' src/skills/*/SKILL.md | wc -l`,
      and `./scripts-run src/scripts/skill_linter` exits 0.

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
- **The per-invocation skill diet → `agents/roadmaps/road-to-standing-payload-diet.md`,
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

- [ ] AC-1 — `grep -lE 'Date\.now\(\)|new Date\(\)' src/scripts/check_*.ts src/scripts/lint_*.ts`
      returns nothing, and `src/scripts/_lib/as_of.ts` is the single site that
      reads the wall clock.
- [ ] AC-2 — the same tree, given the same `--as-of`, produces byte-identical
      output from all 17 scripts on two different machines; CI logs the pinned
      date it used.
- [ ] AC-3 — exactly one enforcement denominator is quotable, it comes from
      `check_enforcement_coverage`, and `docs/proof.md` restates none of it by
      hand; `enforced_by: "none"` appears in zero rules.
- [ ] AC-4 — the number of `execution:` skills declaring no `scope:` is 0, and
      `skill_linter` rejects a malformed `access` value.
- [ ] AC-5 — each of the four § Routed elsewhere items is present in its named
      destination (the stub's ADR question, the payload-diet roadmap, the
      `supply-chain-intake` pitfalls section, the `skill-writing` line), and none
      of them is a phase in this file.
- [ ] AC-6 — this roadmap shipped no vault surface: a grep of the diff it
      produces finds no `.obsidian/` path, no wikilink convention, and no pack
      directory for an external note-taking tool.
