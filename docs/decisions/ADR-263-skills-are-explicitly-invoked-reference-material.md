---
adr: 263
status: accepted
date: 2026-09-08
decision: skills-are-explicitly-invoked-reference-material-no-automatic-routing
supersedes: —
superseded_by: —
type: structural
reopen_policy: owner
protected_dimensions: external_commitment
provenance:
  kind: agentic
  agentic_mode: council
  decision_makers: [council]
  human_directed: true
evidence:
  strength: E2
  basis:
    - agents/evidence/metrics/skill-activation-census.json
    - agents/evidence/analysis/skill-activation-populations-2026-09-06.md
    - agents/evidence/analysis/skill-trigger-frontmatter-has-no-host-reader-2026-09-08.md
    - src/scripts/skill_tools/score_skill_relevance.ts
    - src/scripts/compile_router.ts
    - docs/CLAIMS.md
review_trigger: >-
  A named host publishes a skill-frontmatter contract that includes a
  triggers-shaped key and demonstrates selection on it; or `keyword-v2` becomes
  the shipped default of the skill ranker and a census over a comparable store
  moves off zero; or a second transcript store (a consumer install, a second
  host, a CI-visible corpus) becomes readable and disagrees with this one.
---

# ADR-263 — Skills are explicitly-invoked reference material; the package claims no automatic skill routing

## Status

Accepted 2026-09-08. Decided by an AI council under a written owner delegation
covering an autonomous drain run; see § Authority.

## Context

`agents/roadmaps/archive/road-to-the-skill-surface-framing-choice.md` held an open,
owner-reserved menu of two substantive options plus a publication option. Option
C (publish the zero with its reason) was taken on 2026-09-07 and did not consume
the menu. A and B stayed open, and their staying open also held the first of five
conditions on `road-to-skill-menu-economy`'s
`step-1-2-menu-exclusion-lever-unbuilt` blocker.

The measurement underneath: over 30 sessions and 11,338 assistant turns in one
Claude Code transcript store, `report_skill_activation` records **0 Skill
invocations of 0 of 299 distinct skills**
(`agents/evidence/metrics/skill-activation-census.json`). The 299 were read as
three populations — 12 declaring a machine-matchable trigger key, 100 carrying an
`evals/triggers.json` corpus, 189 reachable only by a human naming them — and the
published claim read the zero as a **defect** for the first of those.

## The finding that decided it

The council locked Option B conditionally, naming one precondition: *document
which hosts were census-tested and whether they claim frontmatter routing; if
unknown, Option D (close the menu) is the honest choice.*

The precondition was discharged. Recorded in full at
`agents/evidence/analysis/skill-trigger-frontmatter-has-no-host-reader-2026-09-08.md`,
pinned to `8a3160242`:

1. **One host was tested.** The census `stores` array carries a single entry, a
   Claude Code project store. The other eight hosts this package projects to
   contributed no session and are unmeasured.
2. **The key is delivered.** `src/`, `dist/agent-src/` and `.augment/` agree
   file-for-file; `_render_native_model_md` (`src/scripts/condense.ts:1623-1627`)
   substitutes `model_tier:` → `model:` and changes nothing else. An earlier
   reading that the projection stripped the key measured seven weeks of local
   staleness in a gitignored install artifact and is retracted in that document.
3. **Nothing reads it.** `dist/router.json` carries `kernel` / `tier_1` /
   `tier_2` / `profiles` and no skills key; `compile_router.ts` contains zero
   occurrences of `skills`. The one in-tree reader is this package's own ranker,
   and `score_skill_relevance.ts:170` documents the field as indexed **only under
   `keyword-v2`** — while `:261-262` records that the default, keyword-v1, scores
   `tokenize(name + ' ' + description)`. Claude Code's own skill contract is
   `name` + `description`; `triggers:` is not in it.

So for the trigger-declaring population the zero is not a mechanism that failed.
No mechanism exists. The three populations collapse to one.

## Decision

**Option B, in the corrected form the council locked.** The package does not
support automatic skill routing as a capability. Skills are indexed reference
material, reached by explicit invocation or by this package's own ranker over
name and description.

The claim this package makes about its skills is corrected to say so. The council
supplied the replacement wording, and it is adopted verbatim as the target:

> This package does not support automatic skill routing as a capability. Skills
> are indexed knowledge artifacts invoked explicitly by name or discovered via
> search.
>
> - 12 skills declare trigger metadata with no validated host contract.
> - 100 skills carry eval fixtures not consumed by hosts for routing.
> - 187 skills declare neither trigger nor eval data.
>
> All 299 require explicit invocation until a named host with a documented
> routing contract demonstrates otherwise.

Two wording points are load-bearing and are recorded rather than left implicit:

- **"by observation", never "by design".** The council rejected "reference
  material by design" because design intent is an ownership claim this repository
  cannot make about hosts it does not own. What is established is what is
  observed.
- **187, not 189.** 12 declare a trigger key and 100 carry a corpus, of which 2
  do both, so 110 are in at least one set and **187** are in neither. The 189 in
  the earlier framing counted the two overlaps twice out of the remainder.
  **WRONG — see Amendment 1 (2026-09-09). This bullet is kept as written because
  an amendment that edits the error away leaves the next reader unable to tell a
  correction from a decision. 189 is the figure that stands.**

**Option A is rejected**, on two grounds the council named: there is no host
contract to build against, and shipping a documented routing capability that
still yields zero would convert an implementation cost into a credibility cost —
consumers would cite the claim as a bug.

**Option D is not taken**, because its trigger condition did not fire: it was the
honest closure only if the provenance hole could not be closed, and it was
closed.

## Amendment 1 (2026-09-09) — the `187` figure is an arithmetic error; 189 stands

Scope, stated first so it cannot be misread: this amendment corrects **one
number in a supporting bullet**. The Decision is untouched — Option B stands, in
the "by observation" form, Option A stays rejected, Option D stays not-taken, and
nothing this record locks is reopened.

**What is wrong.** The bullet states the union correctly at 110 and then
subtracts 112. With `total = 299`, `trigger key = 12`, `corpus = 100` and
`both = 2`, the union is 12 + 100 − 2 = 110 and the remainder is
299 − 110 = **189**. The bullet's diagnosis is also inverted: 189 is the
inclusion–exclusion result, and 187 is what you get by removing the two
overlapping skills a second time — from a remainder they were never in.

**How it was established.** `populations()` in
`src/scripts/report_skill_activation.ts:226-237` computes the remainder as
`census.total - eitherOne.size`, where `eitherOne` is the set union. The
implementation is the definition, so no reading of "human-named only" produces
187 without changing that line. Run today, the report prints its own
reconciliation: `12 + 100 - 2 + 189 = 299 of 299`. The committed record
`agents/evidence/metrics/skill-activation-census.json` holds
`human_named_only: 189`, and `check_skill_activation_claim` is green against
`docs/CLAIMS.md` at that figure.

**What this changes downstream.** The § Consequences bullet below says correcting
the ledger text is tracked as work rather than performed here. That work is
`road-to-the-14-22-0-disposition-residuals` step 1.3, and it lands the *prose*
half only: the claim's sentence that both alternatives "stay OPEN rather than
closed" is false after this record and is corrected, while the figure 189 is
left exactly as it is. The census was deliberately **not** re-emitted — see that
step for the measurement, in short: the only transcript store reachable from the
executing worktree is a 2-session one, and re-emitting would have replaced a
30-session zero-invocation reading with it.

**Authority.** AI council 2026-09-09, 2 seats (anthropic, openai), both
converging on this disposition: the defect is here rather than in the ledger, an
arithmetic correction that touches no floor and no commitment is
council-decidable under `decision-revisit-gate`, and the original bullet is
preserved rather than rewritten. `reopen_policy: owner` on this record is
unaffected — it governs reopening the decision, which this does not do.

## Consequences

- The published claim `skill-activation-census-zero` (`docs/CLAIMS.md:245`) reads
  the zero as a defect for the trigger-declaring population. That reading is now
  wrong and is superseded by this record. Correcting the ledger text, and the
  consumer-facing surfaces that imply topic-matched selection, is the execution
  of this decision and is tracked as work rather than performed here.
- `road-to-the-skill-surface-framing-choice`'s blocker
  `skill-surface-framing-ab-choice` resolves: its `Resolved when` is satisfied by
  the existence of a decision record for A or B, and this is that record for B.
- The first of the five conditions on `road-to-skill-menu-economy`'s
  `step-1-2-menu-exclusion-lever-unbuilt` — "the owner-reserved surface decision
  is recorded" — is satisfied. The other four are untouched by this ADR.
- The 12 trigger declarations are not deleted. They are reclassified as
  unvalidated metadata with no host contract, which is what they are, and they
  remain the thing a future host contract would bind to.

## Evidence

Every row is verifiable in the tree at `8a3160242`, the commit this record was
written against.

| Claim | Where |
|---|---|
| The census is zero over one store | `agents/evidence/metrics/skill-activation-census.json` — `invocations: 0`, `distinct_skills_invoked: 0`, `sessions: 30`, `assistant_turns: 11338`, and a `stores` array with exactly one entry, a Claude Code project store |
| Twelve skills declare the key, not thirteen | Parsing the frontmatter block of `src/skills/*/SKILL.md` yields 12, matching the census's `with_trigger_key: 12`. A bare `grep -l '^triggers:'` returns 13 because `rule-writing` carries the token in its body |
| The projection delivers the key unchanged | `src/scripts/condense.ts:1623-1627` — `_render_native_model_md` performs one substitution, `model_tier:` → `model:`, and returns the rest of the file. `src/skills/`, `dist/agent-src/skills/` and `.augment/skills/` agree file-for-file |
| The earlier "projection strips it" reading was wrong | `agents/evidence/analysis/skill-trigger-frontmatter-has-no-host-reader-2026-09-08.md` § 3 — the comparison was against gitignored install artifacts dated `Jul 5`, whose `dist/` sources are dated `Aug 23`. Retracted there, in that document, rather than quietly dropped |
| The rule router does not read skill triggers | `dist/router.json` carries `schema_version`, `kernel`, `tier_1`, `tier_2`, `profiles` and no skills key; `src/scripts/compile_router.ts` contains zero occurrences of `skills` |
| The one in-tree reader is off by default | `src/scripts/skill_tools/score_skill_relevance.ts:170` — "`triggers[].keyword` / `.phrase` prose. Indexed only under keyword-v2"; `:261-262` — under keyword-v1, the default, `skill.terms` is `tokenize(name + ' ' + description)` |
| `evals/triggers.json` was already known not to be a host input | `docs/CLAIMS.md:245` — a test fixture read by `check_routing_coverage` / `lint_skill_trigger_corpus` / `check_trigger_evals`, "no host reads it at routing time" |
| The council reached B on one seat, not two | `council:run` recorded quorum `1/2 present`, status `concluded`, marked `⚠️ DEGRADED`; the openai seat returned `os_error: ENOBUFS`. Stated again in § Authority so a reader meets it without opening the session record |

**What this record does not establish.** It does not measure the eight hosts the
census never saw — the router and ranker rows above are facts about this tree and
hold host-independently, but the "one host was tested" row bounds the census
itself to Claude Code. It does not establish that skills are unreachable:
`suggest_skill_for_task` ranks name and description and is a real path. And it
does not establish what `keyword-v2` would measure, because no such run exists.

## Alternatives considered

- **A — build a host-side activation path for the 12.** Rejected above.
- **D — close the menu.** Held as the fallback while the provenance hole was
  open; not reached.
- **Leave C standing and defer again.** Rejected because C's own recorded
  falsifier ends it the moment a second store exists, so deferral buys a fourth
  round of re-derivation rather than an answer.

## Authority — how a council came to take an owner-reserved decision

This transition is a public commitment and sits in `decision-revisit-gate`'s
owner-reserved set, which is why an agent recorded C on 2026-09-07 and
deliberately did not touch A or B. For this run the maintainer delegated the
decision in writing, instructing that every open question be settled by the AI
council and that the council's recorded decision substitute for owner sign-off.
This ADR records that delegation as the authority basis; it does not claim that
councils hold this authority generally, and the reserved set is unchanged.

**The council was degraded and this is not convergence.** Two seats are
configured; one answered. `council:status` reported the anthropic seat
`unavailable` before the run and it nonetheless returned a two-round response,
while the openai seat failed with `os_error: ENOBUFS` and returned nothing.
Quorum concluded at 1 of 2 with the run marked `⚠️ DEGRADED`. A single-seat
verdict is a considered opinion, not agreement between independent seats, and
this record should be read at that strength.

## References

- Council convergence, 2026-09-08 — seats `anthropic/claude-sonnet-4-5` (answered,
  2 rounds) and `openai/codex-default` (`os_error: ENOBUFS`, no answer); quorum
  1 of 2, `concluded`, `⚠️ DEGRADED`. Verdict: Option B with corrections, held
  conditional on the provenance precondition, with Option D named as the fallback
  had it stayed open. The question packet is not linked: council artefacts are
  gitignored and auto-pruned, so a path here would rot into a broken reference
  for every reader. Its substance is § Context and § The finding that decided it.
- `agents/evidence/analysis/skill-trigger-frontmatter-has-no-host-reader-2026-09-08.md`
- `agents/roadmaps/archive/road-to-the-skill-surface-framing-choice.md`
- `docs/CLAIMS.md:245` — the claim this decision corrects.
