# Pack-boundary link classification — which of the 203 degrade safely

<!-- evidence-type: analysis -->

> **Scope:** every one of the 203 links `lint_pack_boundaries` reported at
> baseline on `958257418`, classified against the condition the AI council
> attached to D5 of `road-to-gates-a-pull-request-can-hear` (2026-10-07,
> anthropic + openai, 2/2): an advisory `suggests` edge may permit a link only
> where that link **degrades safely** when the target pack is absent, and the
> whole option is withdrawn if a meaningful share turns out to be load-bearing
> — one seat named **> 20 %** as the figure.

## The question, stated so it can be answered wrongly

For a consumer who installs the SOURCE pack and not the target's, does this
artefact stay correct and executable?

| class | definition | degrades safely |
|---|---|---|
| documentation-reference | a See-also / Related / provenance pointer, or sample output inside a worked example; unlinked, the sentence stays true | yes |
| optional-integration | reached only under a condition the reader may not meet — a stack they do not use, a different task they are not doing, a depth pointer, a hand-back to out-of-scope work, or a path the artefact itself names a fallback for | yes |
| load-bearing | a step of THIS artefact's own procedure cannot be completed without the target, and no in-pack substitute exists | **no** |

The second class carries the weight of the argument, so it is worth being
explicit about why it is safe rather than asserting it. A link of the form
*"Do NOT use for X — route to `laravel-validation`"* disappears together with
the need it serves: a consumer without the `laravel` pack is not doing Laravel
validation. The pointer is not a step of the procedure; it is a statement about
where the boundary of the procedure lies, and the boundary is still true when
the neighbour is absent.

## Result

| class | occurrences | share |
|---|---|---|
| documentation-reference | 126 | 62.1 % |
| optional-integration | 73 | 36.0 % |
| load-bearing, remediated in this change | 2 | 1.0 % |
| **load-bearing, still open** | **2** | **1.0 %** |

**4 of 203 = 2.0 %, under the 20 % abort threshold, so option (a) stands.**
Neither of the two still-open load-bearing links is on a permitted edge.

## Three readings, because two of them were wrong

This page records the method's failures as well as its result. A classification
that was revised until it cleared a threshold is indistinguishable from one
that was corrected — unless every revision and its cause are visible.

**Pass 1 — 33.5 % load-bearing.** Would have aborted the option. It treated any
`route to [X]` as an imperative step, including inside a **negative**, which is
the construction where it occurs most. Three sites were read in full before the
rule changed:

- `src/skills/error-handling-patterns/SKILL.md:29` — under `Do NOT use when:`
- `src/skills/bug-analyzer/SKILL.md:22` — under `Do NOT use when:`
- `src/skills/code-refactoring/SKILL.md:110` — under `Carve-out routing:`,
  a stack-conditional list (`Laravel: …` / `Next.js: …` / `Symfony: …`)

In all three the sentence tells the reader this is the **wrong** artefact for
their task. It cannot be a required step of a procedure it is excluding itself
from. Pass 2 therefore reads a negative or stack-conditional context as
`optional-integration`.

**Pass 2 — 3.0 % load-bearing, and the line numbers were wrong.** Caught by an
independent adversarial review, not by the author. The locator took the **first**
textual match of each link in its source file and gave that line — and that
line's enclosing heading — to **every** reported occurrence of the pair. 27
(file, link) pairs are reported more than once, so 34 rows carried a line number
that was not theirs and a basis copied from a different sentence. Worked
example: `content-funnel-design` links `funnel-analysis` at lines 62, 126 and
142; all three rows read `:62` and all three inherited that line's
`load-bearing` verdict, while line 142 reads *"Quantitative funnel-stage
diagnostics and leak detection — route to …"*, which pass 2's own rule classes
as `optional-integration`.

**Pass 3 — 2.0 %, the reading above.** Each of the 203 reported occurrences is
mapped to its own match, in file order: 190 distinct sites, 0 unlocated, and
every (file, link) pair's reported count equals its textual match count. Where a
pair is reported more often than it appears — a multi-pack artefact is counted
once per source pack — the extra rows share the last match, and that is stated
rather than papered over with an invented line.

The corrections move the number in one direction only: **33.5 % → 3.0 % → 2.0 %**,
and the manual review below moved occurrences **down** and **none up**. That is
worth noticing rather than treating as reassurance: a method whose every error
has pointed the same way has not been shown to be unbiased, only to have been
wrong consistently. What makes the result checkable is the per-link table, not
the direction of its corrections.

## What was checked by hand

**All 22 occurrences pass 3 flagged load-bearing** were read with their
surrounding context; 18 were reclassified down. The per-site basis is in the
table below, prefixed `manual review:`. The 4 survivors:

| source:line | edge | class | why |
|---|---|---|---|
| `src/skills/content-funnel-design/SKILL.md`:62 | `gtm-marketing -> product-basic` | load-bearing | Step 0 is *"Identify the leaking stage from `funnel-analysis`"* — a mandatory input, and the skill states it is "a *response* to a diagnosed leak". **Not on a permitted edge.** |
| `src/rules/architecture.md`:45 | `meta -> frontend-design` | load-bearing | *"audit existing first, per `ui-audit-gate`"* — the obligation is carried by the target. **Not on a permitted edge.** |
| `src/skills/corpus-grounding/SKILL.md`:40 | `engineering-base -> frontend-design` | load-bearing, remediated | names where the full licence obligations live; see below |
| `src/skills/tailwind-engineer/SKILL.md`:97 | `engineering-base -> frontend-design` | load-bearing, remediated | the target carries the single token-discipline linter; see below |

**A 12-occurrence random sample (seed 37) of the links pass 2 called safe** was
read the same way: **0 reclassified**. At n = 12 that bounds the false-negative
rate loosely, not tightly — the honest reading is that the sample found
nothing, not that nothing is there. The sampled sites were See-also indexes
(`legal-safety-floor`, `pdf-tools`, `doc-screenshot-hygiene`,
`ui-apply-generic`) and `route to … instead` disambiguation rows
(`unit-economics-modeling`, `vision-articulation`, `rice-prioritization`,
`build-buy-partner`, `runway-cognition`, `livewire-architect`, `code-review`).

## What the permit actually covers

83 of the 203 are permitted after the change — not the 120 that remain, and not
all 203. Permission follows the **declared edge**, not the classification: a
link is permitted when its source pack declares `suggests` on the target, so a
safely-degrading link on an edge nobody declared is still a violation, by
design.

Of the 83, **73 sit on edges this change added and 10 on edges that already
existed** and that the gate simply did not read (`laravel -> frontend-design` 3,
`product-basic -> product-discovery` 3, `brand -> ai-image` 2,
`react -> frontend-design` 1, `frontend-design -> react` 1).

Two load-bearing links sat on an edge the change permits. Both were remediated
**before the edge was declared** rather than permitted as they stood, so no
permitted link is load-bearing as it stands:

- `corpus-grounding` gained an **engine-scoped `ATTRIBUTION.md`** beside the
  code the MIT notice covers. The split is the point: the vendored corpus ships
  with `frontend-design`, the ported engine sources under `scripts/` ship with
  this skill in `engineering-base`, and the obligation is "retain this notice",
  so an `engineering-base`-only install needs the notice locally. The first
  attempt at this remediation asserted the obligation did not travel at all —
  false for the engine half, and caught in review.
- `tailwind-engineer` now states that without `frontend-design` its
  no-hardcoded-values rule still binds and is checked by reading rather than by
  a linter.

## The residual: the permit is per EDGE, not per link

This classification is a **one-time hand pass**. Once an edge is declared,
every future link on it is permitted without anyone re-checking that it
degrades safely — and `engineering-base` alone now carries 8 of the declared
edges and most of the 83 permits. The gate's guarantee on those edges weakens
from *this link cannot dangle* to *this link may dangle, advisedly*.

The adversarial review demonstrated this rather than arguing it: a planted link
from `code-review` (`engineering-base`) to `laravel-horizon` (`laravel`) left
the count at 120, the ratchet `within`, and the CI argv at exit 0 — where before
the change it would have read 204 against a 203 baseline and failed the pull
request.

What ships against that, and what does not:

- **Ships:** the permitted **count** prints on every run, `--quiet` included,
  because `--quiet` is exactly what CI passes — a mitigation only visible
  without it would not have reached the one log that matters.
  `--show-permitted` names each link and its edge; `--format json` carries
  `permitted_by_suggests` unconditionally for machine consumers.
- **Does not ship:** a per-link classification marker, a ratchet on the
  permitted count, or a recurring re-classification. A reviewer who wants the
  condition re-verified has to re-run the hand pass.

Stated here rather than left implicit, because a reader of the baseline drop
would otherwise have to infer it from the mechanism.

## The sibling gate reads `suggests` the other way, deliberately

`src/scripts/lint_rule_skill_pack_reach.ts` states in its header that
`suggests` is **not** followed, "because it is advisory, the wizard may offer
it and the user may decline, so an invariant that counted it would pass on
installs that do not exist". This gate now does follow it. The two are not in
conflict, and the reason is the direction of the claim each one makes:

- the **reach** gate asserts a route *will resolve* on the installs it covers.
  Counting an advisory edge there would assert resolution on installs that may
  not exist, which is a false positive in the dangerous direction.
- the **boundary** gate reports a link that *may dangle*. An advisory edge is a
  statement that the author accepts the dangle for a declining consumer — so
  reading it here downgrades a finding the author has already answered.

Both headers now carry this paragraph, so the next reader meets the distinction
where they meet the behaviour rather than having to find this page.

## Reproduction

```bash
./scripts-run src/scripts/lint_pack_boundaries --quiet --show-permitted
```

The `~` lines are the permitted set with the permitting edge named; the `✗`
lines are the 120 that remain.

**Sensitivity check, measured rather than derived:** reverting only this
change's `suggests` additions in `src/config/discovery/packs.yml` yields
**193** — the 120 plus the 73 that sat on added edges. It does **not** yield
203: the other 10 permits sit on pre-existing edges a revert does not touch,
and 203 returns only if the gate also stops reading `suggests` at all. An
earlier revision of this page claimed 203 here, which would have told a
reviewer who ran it that either the change or the page was broken.

## The full table

`permitted now` is read from the gate's own `--show-permitted` output on this
branch, not inferred from the edge. `source:line` is the occurrence's own line,
corrected in pass 3.

| # | edge | source:line | target | class | permitted now | basis |
|---|---|---|---|---|---|---|
| 1 | `ai-video -> engineering-base` | `src/rules/media-sync-ground-truth.md`:76 | `src/rules/non-destructive-by-default.md` | documentation-reference | no | reference section: see also |
| 2 | `ai-video -> frontend-design` | `src/skills/canvas-design/SKILL.md`:151 | `src/skills/html-deck/SKILL.md` | documentation-reference | no | reference section: see also |
| 3 | `brand -> ai-image` | `src/skills/brand-identity/SKILL.md`:103 | `src/skills/logo-generation/SKILL.md` | documentation-reference | yes | reference section: see also |
| 4 | `brand -> ai-image` | `src/skills/brand-to-tokens/SKILL.md`:114 | `src/skills/logo-generation/SKILL.md` | optional-integration | yes | disambiguation / routing section: do not |
| 5 | `engineering-base -> ai-video` | `src/skills/evaluate-llm-feature/SKILL.md`:41 | `src/skills/prompt-validator/SKILL.md` | optional-integration | no | disambiguation / routing section: when to use |
| 6 | `engineering-base -> ai-video` | `src/skills/evaluate-llm-feature/SKILL.md`:141 | `src/skills/prompt-validator/SKILL.md` | documentation-reference | no | reference section: see also |
| 7 | `engineering-base -> brand` | `src/skills/accessibility-auditor/SKILL.md`:180 | `src/rules/brand-consistency.md` | optional-integration | yes | manual review: same sentence as :179 |
| 8 | `engineering-base -> brand` | `src/skills/existing-ui-audit/SKILL.md`:151 | `src/rules/brand-source-of-truth.md` | documentation-reference | yes | manual review: parenthetical "— see …" after the rule it cites |
| 9 | `engineering-base -> founder-strategy` | `src/rules/engineering-safety-floor.md`:96 | `src/skills/launch-readiness/SKILL.md` | documentation-reference | no | reference section: see also |
| 10 | `engineering-base -> frontend-design` | `src/skills/accessibility-auditor/SKILL.md`:63 | `src/skills/design-intelligence/SKILL.md` | optional-integration | yes | manual review: the sentence states the WCAG method stays this skill’s own checklists; the target only enriches it |
| 11 | `engineering-base -> frontend-design` | `src/skills/accessibility-auditor/SKILL.md`:179 | `src/skills/design-tokens/SKILL.md` | optional-integration | yes | manual review: "this procedure sits beside that authority, it does not duplicate the values" — the self-test runs against whatever ramp exists |
| 12 | `engineering-base -> frontend-design` | `src/skills/corpus-grounding/SKILL.md`:26 | `src/skills/design-intelligence/SKILL.md` | documentation-reference | yes | index-shaped entry |
| 13 | `engineering-base -> frontend-design` | `src/skills/corpus-grounding/SKILL.md`:40 | `src/skills/design-intelligence/ATTRIBUTION.md` | load-bearing (remediated) | yes | manual review: classified load-bearing on the PRE-remediation text: it named where the full licence obligations live, and the MIT notice covers the ported engine that ships in this pack. Remediated before the edge was declared — an engine-scoped `ATTRIBUTION.md` now sits beside the code it covers |
| 14 | `engineering-base -> frontend-design` | `src/skills/corpus-grounding/SKILL.md`:231 | `src/skills/design-intelligence/SKILL.md` | documentation-reference | yes | reference section: see also |
| 15 | `engineering-base -> frontend-design` | `src/skills/dashboard-design/SKILL.md`:36 | `src/skills/design-intelligence/SKILL.md` | documentation-reference | yes | manual review: parenthetical "(see …)" after a recommendation the row already states |
| 16 | `engineering-base -> frontend-design` | `src/skills/existing-ui-audit/SKILL.md`:18 | `src/skills/design-intelligence/SKILL.md` | documentation-reference | yes | index-shaped entry |
| 17 | `engineering-base -> frontend-design` | `src/skills/fe-design/SKILL.md`:149 | `src/skills/design-intelligence/SKILL.md` | optional-integration | yes | disambiguation / routing section: positioning — reference inside the engine, executor outside it |
| 18 | `engineering-base -> frontend-design` | `src/skills/fe-design/SKILL.md`:187 | `src/skills/design-intelligence/SKILL.md` | optional-integration | yes | manual review: the sentence names its own degraded path: "fall back to the heuristics in this reference … where the corpus reports an evidence gap" |
| 19 | `engineering-base -> frontend-design` | `src/skills/tailwind-engineer/SKILL.md`:97 | `src/skills/design-tokens/SKILL.md` | load-bearing (remediated) | yes | manual review: classified load-bearing on the PRE-remediation text: the target carries the single token-discipline linter. Remediated before the edge was declared — the skill now states that without `frontend-design` the rule still binds and is checked by reading rather than by a linter |
| 20 | `engineering-base -> frontend-design` | `src/skills/ui-apply-generic/SKILL.md`:171 | `src/skills/design-intelligence/SKILL.md` | documentation-reference | yes | reference section: see also |
| 21 | `engineering-base -> frontend-design` | `src/skills/ui-apply-generic/SKILL.md`:175 | `src/skills/design-tokens/SKILL.md` | documentation-reference | yes | reference section: see also |
| 22 | `engineering-base -> laravel` | `src/skills/api-endpoint/SKILL.md`:35 | `src/skills/laravel-api-endpoint/SKILL.md` | optional-integration | yes | disambiguation / routing section: stack routing |
| 23 | `engineering-base -> laravel` | `src/skills/api-endpoint/SKILL.md`:69 | `src/skills/laravel-api-endpoint/SKILL.md` | optional-integration | yes | conditional, stack-gated or depth pointer |
| 24 | `engineering-base -> laravel` | `src/skills/code-refactoring/SKILL.md`:110 | `src/skills/laravel-api-endpoint/SKILL.md` | optional-integration | yes | conditional, stack-gated or depth pointer |
| 25 | `engineering-base -> laravel` | `src/skills/code-review/SKILL.md`:127 | `src/skills/laravel/SKILL.md` | optional-integration | yes | disambiguation / routing section: change-type routing — load only the checklist the diff needs |
| 26 | `engineering-base -> laravel` | `src/skills/code-review/SKILL.md`:127 | `src/skills/laravel-validation/SKILL.md` | optional-integration | yes | disambiguation / routing section: change-type routing — load only the checklist the diff needs |
| 27 | `engineering-base -> laravel` | `src/skills/code-review/SKILL.md`:128 | `src/skills/eloquent/SKILL.md` | optional-integration | yes | disambiguation / routing section: change-type routing — load only the checklist the diff needs |
| 28 | `engineering-base -> laravel` | `src/skills/code-review/SKILL.md`:128 | `src/skills/pest-testing/SKILL.md` | optional-integration | yes | disambiguation / routing section: change-type routing — load only the checklist the diff needs |
| 29 | `engineering-base -> laravel` | `src/skills/code-review/SKILL.md`:129 | `src/skills/blade-ui/SKILL.md` | optional-integration | yes | disambiguation / routing section: change-type routing — load only the checklist the diff needs |
| 30 | `engineering-base -> laravel` | `src/skills/defense-in-depth/SKILL.md`:26 | `src/skills/laravel-validation/SKILL.md` | optional-integration | yes | disambiguation / routing section: when to use |
| 31 | `engineering-base -> laravel` | `src/skills/error-handling-patterns/SKILL.md`:29 | `src/skills/laravel-validation/SKILL.md` | optional-integration | yes | disambiguation / routing section: when to use |
| 32 | `engineering-base -> laravel` | `src/skills/error-handling-patterns/SKILL.md`:146 | `src/skills/laravel-validation/SKILL.md` | documentation-reference | yes | reference section: provenance |
| 33 | `engineering-base -> laravel` | `src/skills/fe-design/SKILL.md`:234 | `src/skills/blade-ui/SKILL.md` | documentation-reference | yes | reference section: related |
| 34 | `engineering-base -> laravel` | `src/skills/fe-design/SKILL.md`:235 | `src/skills/livewire/SKILL.md` | documentation-reference | yes | reference section: related |
| 35 | `engineering-base -> laravel` | `src/skills/fe-design/SKILL.md`:236 | `src/skills/flux/SKILL.md` | documentation-reference | yes | reference section: related |
| 36 | `engineering-base -> laravel` | `src/skills/form-handler/SKILL.md`:20 | `src/skills/laravel-validation/SKILL.md` | documentation-reference | yes | index-shaped entry |
| 37 | `engineering-base -> laravel` | `src/skills/form-handler/SKILL.md`:39 | `src/skills/laravel-validation/SKILL.md` | optional-integration | yes | disambiguation / routing section: when to use |
| 38 | `engineering-base -> laravel` | `src/skills/migration-architect/SKILL.md`:21 | `src/skills/laravel-migration/SKILL.md` | optional-integration | yes | conditional, stack-gated or depth pointer |
| 39 | `engineering-base -> laravel` | `src/skills/migration-architect/SKILL.md`:36 | `src/skills/laravel-migration/SKILL.md` | optional-integration | yes | disambiguation / routing section: when to use |
| 40 | `engineering-base -> laravel` | `src/skills/migration-architect/SKILL.md`:121 | `src/skills/laravel-migration/SKILL.md` | optional-integration | yes | disambiguation / routing section: do not |
| 41 | `engineering-base -> laravel` | `src/skills/security-audit/SKILL.md`:136 | `src/skills/laravel/SKILL.md` | optional-integration | yes | conditional, stack-gated or depth pointer |
| 42 | `engineering-base -> laravel` | `src/skills/security/SKILL.md`:20 | `src/skills/laravel-validation/SKILL.md` | optional-integration | yes | disambiguation / routing section: when to use |
| 43 | `engineering-base -> laravel` | `src/skills/security/SKILL.md`:31 | `src/skills/laravel/SKILL.md` | optional-integration | yes | disambiguation / routing section: stack-specific carve-outs |
| 44 | `engineering-base -> laravel` | `src/skills/security/SKILL.md`:31 | `src/skills/laravel-validation/SKILL.md` | optional-integration | yes | disambiguation / routing section: stack-specific carve-outs |
| 45 | `engineering-base -> laravel` | `src/skills/security/SKILL.md`:31 | `src/skills/laravel-middleware/SKILL.md` | optional-integration | yes | disambiguation / routing section: stack-specific carve-outs |
| 46 | `engineering-base -> laravel` | `src/skills/test-case-discovery/SKILL.md`:165 | `src/skills/pest-testing/SKILL.md` | optional-integration | yes | manual review: the violating link is the stack alternative in "… or to the stack skill (…)" |
| 47 | `engineering-base -> laravel` | `src/skills/test-case-discovery/SKILL.md`:208 | `src/skills/pest-testing/SKILL.md` | documentation-reference | yes | reference section: see also |
| 48 | `engineering-base -> laravel` | `src/skills/test-driven-development/SKILL.md`:370 | `src/skills/pest-testing/SKILL.md` | optional-integration | yes | manual review: routing list row: "Full Pest conventions and Laravel test helpers → …" |
| 49 | `engineering-base -> laravel` | `src/skills/testing-anti-patterns/SKILL.md`:33 | `src/skills/pest-testing/SKILL.md` | optional-integration | yes | disambiguation / routing section: when to use |
| 50 | `engineering-base -> laravel` | `src/skills/testing-anti-patterns/SKILL.md`:297 | `src/skills/pest-testing/SKILL.md` | documentation-reference | yes | reference section: provenance |
| 51 | `engineering-base -> laravel` | `src/skills/testing-anti-patterns/process-anti-patterns.md`:96 | `src/skills/pest-testing/SKILL.md` | documentation-reference | yes | reference section: cross-references |
| 52 | `engineering-base -> laravel` | `src/skills/threat-modeling/SKILL.md`:107 | `src/skills/laravel-validation/SKILL.md` | optional-integration | yes | manual review: STRIDE table: the control is named inline, the link is the stack-specific deepening |
| 53 | `engineering-base -> nextjs` | `src/skills/api-endpoint/SKILL.md`:37 | `src/skills/nextjs-patterns/SKILL.md` | optional-integration | yes | disambiguation / routing section: stack routing |
| 54 | `engineering-base -> nextjs` | `src/skills/code-refactoring/SKILL.md`:111 | `src/skills/nextjs-patterns/SKILL.md` | optional-integration | yes | conditional, stack-gated or depth pointer |
| 55 | `engineering-base -> nextjs` | `src/skills/code-review/SKILL.md`:131 | `src/skills/nextjs-patterns/SKILL.md` | optional-integration | yes | disambiguation / routing section: change-type routing — load only the checklist the diff needs |
| 56 | `engineering-base -> nextjs` | `src/skills/security/SKILL.md`:33 | `src/skills/nextjs-patterns/SKILL.md` | optional-integration | yes | disambiguation / routing section: stack-specific carve-outs |
| 57 | `engineering-base -> ops-people` | `src/skills/data-handling-judgment/SKILL.md`:118 | `src/skills/contracts-cognition/SKILL.md` | documentation-reference | no | reference section: related skills |
| 58 | `engineering-base -> ops-people` | `src/skills/privacy-review/SKILL.md`:124 | `src/skills/contracts-cognition/SKILL.md` | documentation-reference | no | reference section: related skills |
| 59 | `engineering-base -> php` | `src/skills/bug-analyzer/SKILL.md`:208 | `src/skills/php-debugging/SKILL.md` | optional-integration | yes | conditional, stack-gated or depth pointer |
| 60 | `engineering-base -> php` | `src/skills/code-review/SKILL.md`:129 | `src/skills/php-coder/SKILL.md` | optional-integration | yes | disambiguation / routing section: change-type routing — load only the checklist the diff needs |
| 61 | `engineering-base -> php` | `src/skills/systematic-debugging/SKILL.md`:222 | `src/skills/php-debugging/SKILL.md` | documentation-reference | yes | index-shaped entry |
| 62 | `engineering-base -> php` | `src/skills/systematic-debugging/SKILL.md`:351 | `src/skills/php-debugging/SKILL.md` | documentation-reference | yes | index-shaped entry |
| 63 | `engineering-base -> product-basic` | `src/skills/bug-analyzer/SKILL.md`:22 | `src/skills/feature-planning/SKILL.md` | optional-integration | yes | disambiguation / routing section: when to use |
| 64 | `engineering-base -> react` | `src/skills/code-review/SKILL.md`:131 | `src/skills/react-shadcn-ui/SKILL.md` | optional-integration | yes | disambiguation / routing section: change-type routing — load only the checklist the diff needs |
| 65 | `engineering-base -> react` | `src/skills/fe-design/SKILL.md`:237 | `src/skills/react-shadcn-ui/SKILL.md` | documentation-reference | yes | reference section: related |
| 66 | `engineering-base -> symfony` | `src/skills/api-endpoint/SKILL.md`:36 | `src/skills/symfony-workflow/SKILL.md` | optional-integration | yes | disambiguation / routing section: stack routing |
| 67 | `engineering-base -> symfony` | `src/skills/code-refactoring/SKILL.md`:112 | `src/skills/symfony-workflow/SKILL.md` | optional-integration | yes | conditional, stack-gated or depth pointer |
| 68 | `engineering-base -> symfony` | `src/skills/code-review/SKILL.md`:130 | `src/skills/symfony-workflow/SKILL.md` | optional-integration | yes | disambiguation / routing section: change-type routing — load only the checklist the diff needs |
| 69 | `engineering-base -> symfony` | `src/skills/security/SKILL.md`:32 | `src/skills/symfony-workflow/SKILL.md` | optional-integration | yes | disambiguation / routing section: stack-specific carve-outs |
| 70 | `engineering-base+frontend-design -> brand` | `src/rules/design-fidelity.md`:51 | `src/rules/brand-source-of-truth.md` | documentation-reference | yes | manual review: "This rule mirrors …" — analogy |
| 71 | `engineering-base+frontend-design -> brand` | `src/rules/design-fidelity.md`:177 | `src/rules/brand-source-of-truth.md` | documentation-reference | yes | reference section: see also |
| 72 | `engineering-base+frontend-design -> brand` | `src/rules/design-fidelity.md`:177 | `src/rules/brand-consistency.md` | documentation-reference | yes | reference section: see also |
| 73 | `engineering-base+frontend-design -> frontend-design` | `src/rules/design-fidelity.md`:144 | `src/skills/design-intelligence/SKILL.md` | optional-integration | yes | disambiguation / routing section: when not to fire |
| 74 | `engineering-base+frontend-design -> frontend-design` | `src/rules/design-fidelity.md`:179 | `src/rules/ui-audit-gate.md` | documentation-reference | yes | reference section: see also |
| 75 | `finance-advanced -> founder-strategy` | `src/skills/dcf-modeling/SKILL.md`:83 | `src/skills/okr-tree-modeling/SKILL.md` | documentation-reference | no | reference section: related skills |
| 76 | `finance-advanced -> founder-strategy` | `src/skills/scenario-modeling/SKILL.md`:103 | `src/skills/build-buy-partner/SKILL.md` | documentation-reference | no | reference section: related skills |
| 77 | `finance-advanced -> product-basic` | `src/skills/dcf-modeling/SKILL.md`:82 | `src/skills/rice-prioritization/SKILL.md` | documentation-reference | no | reference section: related skills |
| 78 | `finance-basic -> finance-advanced` | `src/skills/forecasting/SKILL.md`:130 | `src/skills/scenario-modeling/SKILL.md` | documentation-reference | yes | reference section: related skills |
| 79 | `finance-basic -> finance-advanced` | `src/skills/runway-cognition/SKILL.md`:102 | `src/skills/scenario-modeling/SKILL.md` | documentation-reference | yes | reference section: related skills |
| 80 | `finance-basic -> finance-advanced` | `src/skills/unit-economics-modeling/SKILL.md`:135 | `src/skills/dcf-modeling/SKILL.md` | documentation-reference | yes | reference section: related skills |
| 81 | `finance-basic -> finance-advanced` | `src/skills/unit-economics-modeling/SKILL.md`:140 | `src/skills/scenario-modeling/SKILL.md` | documentation-reference | yes | reference section: related skills |
| 82 | `finance-basic -> founder-strategy` | `src/skills/runway-cognition/SKILL.md`:103 | `src/skills/fundraising-narrative/SKILL.md` | documentation-reference | no | reference section: related skills |
| 83 | `finance-basic -> founder-strategy` | `src/skills/unit-economics-modeling/SKILL.md`:138 | `src/skills/okr-tree-modeling/SKILL.md` | documentation-reference | no | reference section: related skills |
| 84 | `finance-basic -> gtm-sales` | `src/skills/forecasting/SKILL.md`:127 | `src/skills/deal-qualification-meddic/SKILL.md` | documentation-reference | no | reference section: related skills |
| 85 | `finance-basic -> gtm-sales` | `src/skills/forecasting/SKILL.md`:128 | `src/skills/forecast-accuracy/SKILL.md` | documentation-reference | no | reference section: related skills |
| 86 | `finance-basic -> ops-people` | `src/skills/runway-cognition/SKILL.md`:104 | `src/skills/org-design/SKILL.md` | documentation-reference | no | reference section: related skills |
| 87 | `finance-basic -> product-basic` | `src/skills/unit-economics-modeling/SKILL.md`:136 | `src/skills/funnel-analysis/SKILL.md` | documentation-reference | no | reference section: related skills |
| 88 | `finance-basic -> product-basic` | `src/skills/unit-economics-modeling/SKILL.md`:137 | `src/skills/rice-prioritization/SKILL.md` | documentation-reference | no | reference section: related skills |
| 89 | `founder-strategy -> engineering-base` | `src/skills/launch-readiness/SKILL.md`:27 | `src/skills/finishing-a-development-branch/SKILL.md` | optional-integration | no | disambiguation / routing section: when to use |
| 90 | `founder-strategy -> engineering-base` | `src/skills/launch-readiness/SKILL.md`:176 | `src/skills/finishing-a-development-branch/SKILL.md` | documentation-reference | no | reference section: related skills |
| 91 | `founder-strategy -> finance-advanced` | `src/skills/build-buy-partner/SKILL.md`:109 | `src/skills/scenario-modeling/SKILL.md` | documentation-reference | no | reference section: related skills |
| 92 | `founder-strategy -> finance-advanced` | `src/skills/okr-tree-modeling/SKILL.md`:87 | `src/skills/dcf-modeling/SKILL.md` | documentation-reference | no | reference section: related skills |
| 93 | `founder-strategy -> finance-basic` | `src/skills/market-entry-analysis/SKILL.md`:111 | `src/skills/unit-economics-modeling/SKILL.md` | documentation-reference | no | reference section: related skills |
| 94 | `founder-strategy -> gtm-marketing` | `src/rules/strategy-safety-floor.md`:107 | `src/skills/positioning-strategy/SKILL.md` | documentation-reference | no | reference section: see also |
| 95 | `founder-strategy -> gtm-marketing` | `src/skills/competitive-moat-analysis/SKILL.md`:115 | `src/skills/positioning-strategy/SKILL.md` | documentation-reference | no | reference section: related skills |
| 96 | `founder-strategy -> gtm-marketing` | `src/skills/competitive-moat-analysis/SKILL.md`:116 | `src/skills/competitive-positioning/SKILL.md` | documentation-reference | no | reference section: related skills |
| 97 | `founder-strategy -> gtm-marketing` | `src/skills/fundraising-narrative/SKILL.md`:65 | `src/skills/positioning-strategy/SKILL.md` | optional-integration | no | disambiguation / routing section: step 0: inherit the positioning frame and vision anchor |
| 98 | `founder-strategy -> gtm-marketing` | `src/skills/fundraising-narrative/SKILL.md`:156 | `src/skills/messaging-architecture/SKILL.md` | documentation-reference | no | reference section: related skills |
| 99 | `founder-strategy -> gtm-marketing` | `src/skills/fundraising-narrative/SKILL.md`:157 | `src/skills/positioning-strategy/SKILL.md` | documentation-reference | no | reference section: related skills |
| 100 | `founder-strategy -> gtm-marketing` | `src/skills/launch-readiness/SKILL.md`:28 | `src/skills/release-comms/SKILL.md` | optional-integration | no | disambiguation / routing section: when to use |
| 101 | `founder-strategy -> gtm-marketing` | `src/skills/launch-readiness/SKILL.md`:65 | `src/skills/release-comms/SKILL.md` | optional-integration | no | manual review: parenthetical hand-off "(hand off to … for the prose)"; the checklist row stands without it |
| 102 | `founder-strategy -> gtm-marketing` | `src/skills/launch-readiness/SKILL.md`:161 | `src/skills/release-comms/SKILL.md` | optional-integration | no | disambiguation / routing section: 6. hand back |
| 103 | `founder-strategy -> gtm-marketing` | `src/skills/launch-readiness/SKILL.md`:178 | `src/skills/release-comms/SKILL.md` | documentation-reference | no | reference section: related skills |
| 104 | `founder-strategy -> gtm-marketing` | `src/skills/market-entry-analysis/SKILL.md`:110 | `src/skills/competitive-positioning/SKILL.md` | documentation-reference | no | reference section: related skills |
| 105 | `founder-strategy -> gtm-marketing` | `src/skills/market-entry-analysis/SKILL.md`:112 | `src/skills/content-funnel-design/SKILL.md` | documentation-reference | no | reference section: related skills |
| 106 | `founder-strategy -> gtm-marketing` | `src/skills/vision-articulation/SKILL.md`:111 | `src/skills/positioning-strategy/SKILL.md` | documentation-reference | no | reference section: related skills |
| 107 | `founder-strategy -> gtm-marketing` | `src/skills/vision-articulation/SKILL.md`:111 | `src/skills/messaging-architecture/SKILL.md` | documentation-reference | no | reference section: related skills |
| 108 | `founder-strategy -> ops-people` | `src/skills/build-buy-partner/SKILL.md`:110 | `src/skills/org-design/SKILL.md` | documentation-reference | no | reference section: related skills |
| 109 | `founder-strategy -> product-basic` | `src/skills/launch-readiness/SKILL.md`:180 | `src/skills/stakeholder-tradeoff/SKILL.md` | documentation-reference | no | reference section: related skills |
| 110 | `founder-strategy -> product-basic` | `src/skills/market-entry-analysis/SKILL.md`:112 | `src/skills/funnel-analysis/SKILL.md` | documentation-reference | no | reference section: related skills |
| 111 | `founder-strategy -> product-basic` | `src/skills/okr-tree-modeling/SKILL.md`:85 | `src/skills/rice-prioritization/SKILL.md` | documentation-reference | no | reference section: related skills |
| 112 | `founder-strategy -> product-basic` | `src/skills/okr-tree-modeling/SKILL.md`:86 | `src/skills/funnel-analysis/SKILL.md` | documentation-reference | no | reference section: related skills |
| 113 | `frontend-design -> ai-video` | `src/skills/html-deck/SKILL.md`:40 | `src/skills/canvas-design/SKILL.md` | optional-integration | no | disambiguation / routing section: when to use |
| 114 | `frontend-design -> ai-video` | `src/skills/html-deck/SKILL.md`:149 | `src/skills/canvas-design/SKILL.md` | documentation-reference | no | reference section: see also |
| 115 | `frontend-design -> brand` | `src/skills/html-deck/SKILL.md`:151 | `src/skills/brand-to-tokens/SKILL.md` | documentation-reference | yes | reference section: see also |
| 116 | `frontend-design -> brand` | `src/skills/typography-system/SKILL.md`:98 | `src/rules/brand-source-of-truth.md` | optional-integration | yes | manual review: "— if the brand already registers fonts" — conditional |
| 117 | `frontend-design -> brand` | `src/skills/typography-system/SKILL.md`:186 | `src/skills/brand/SKILL.md` | documentation-reference | yes | reference section: see also |
| 118 | `frontend-design -> react` | `src/skills/design-tokens/SKILL.md`:174 | `src/skills/react-shadcn-ui/SKILL.md` | documentation-reference | yes | reference section: see also |
| 119 | `gtm-marketing -> ai-image+ai-video` | `src/skills/humanizer/SKILL.md`:132 | `src/rules/media-governance-routing.md` | documentation-reference | no | manual review: parenthetical citation of the floors the paragraph already names |
| 120 | `gtm-marketing -> engineering-base` | `src/skills/humanizer/SKILL.md`:45 | `src/rules/untrusted-input-defense.md` | documentation-reference | no | manual review: parenthetical citation; the injection rule is stated inline in the same bullet |
| 121 | `gtm-marketing -> engineering-base` | `src/skills/release-comms/SKILL.md`:91 | `src/skills/incident-commander/SKILL.md` | documentation-reference | no | reference section: related skills |
| 122 | `gtm-marketing -> finance-advanced` | `src/skills/competitive-positioning/SKILL.md`:122 | `src/skills/dcf-modeling/SKILL.md` | documentation-reference | no | reference section: related skills |
| 123 | `gtm-marketing -> finance-basic` | `src/skills/positioning-strategy/SKILL.md`:125 | `src/skills/unit-economics-modeling/SKILL.md` | documentation-reference | no | reference section: related skills |
| 124 | `gtm-marketing -> founder-strategy` | `src/skills/gtm-launch/SKILL.md`:123 | `src/skills/launch-readiness/SKILL.md` | optional-integration | no | disambiguation / routing section: step 6: hand back |
| 125 | `gtm-marketing -> founder-strategy` | `src/skills/gtm-launch/SKILL.md`:138 | `src/skills/launch-readiness/SKILL.md` | documentation-reference | no | reference section: related skills |
| 126 | `gtm-marketing -> founder-strategy` | `src/skills/messaging-architecture/SKILL.md`:111 | `src/skills/fundraising-narrative/SKILL.md` | optional-integration | no | disambiguation / routing section: step 5: hand back |
| 127 | `gtm-marketing -> founder-strategy` | `src/skills/positioning-strategy/SKILL.md`:123 | `src/skills/fundraising-narrative/SKILL.md` | documentation-reference | no | reference section: related skills |
| 128 | `gtm-marketing -> product-basic` | `src/skills/competitive-positioning/SKILL.md`:124 | `src/skills/stakeholder-tradeoff/SKILL.md` | documentation-reference | no | reference section: related skills |
| 129 | `gtm-marketing -> product-basic` | `src/skills/content-funnel-design/SKILL.md`:62 | `src/skills/funnel-analysis/SKILL.md` | load-bearing | no | inline prose, no conditional or reference marker |
| 130 | `gtm-marketing -> product-basic` | `src/skills/content-funnel-design/SKILL.md`:126 | `src/skills/funnel-analysis/SKILL.md` | optional-integration | no | disambiguation / routing section: step 6: hand back |
| 131 | `gtm-marketing -> product-basic` | `src/skills/content-funnel-design/SKILL.md`:142 | `src/skills/funnel-analysis/SKILL.md` | documentation-reference | no | reference section: related skills |
| 132 | `gtm-marketing -> product-basic` | `src/skills/gtm-launch/SKILL.md`:139 | `src/skills/retention-loops/SKILL.md` | documentation-reference | no | reference section: related skills |
| 133 | `gtm-marketing -> product-basic` | `src/skills/release-comms/SKILL.md`:93 | `src/skills/funnel-analysis/SKILL.md` | documentation-reference | no | reference section: related skills |
| 134 | `gtm-marketing -> product-basic` | `src/skills/release-comms/SKILL.md`:94 | `src/skills/rice-prioritization/SKILL.md` | documentation-reference | no | reference section: related skills |
| 135 | `gtm-marketing -> product-discovery` | `src/skills/content-funnel-design/SKILL.md`:128 | `src/skills/activation-design/SKILL.md` | optional-integration | no | disambiguation / routing section: step 6: hand back |
| 136 | `gtm-marketing -> product-discovery` | `src/skills/content-funnel-design/SKILL.md`:143 | `src/skills/activation-design/SKILL.md` | documentation-reference | no | reference section: related skills |
| 137 | `gtm-marketing -> product-discovery` | `src/skills/positioning-strategy/SKILL.md`:55 | `src/skills/customer-research/SKILL.md` | optional-integration | no | manual review: "If you cannot finish the sentence, route to …" — conditional; the marker sits on the preceding line |
| 138 | `gtm-marketing -> product-discovery` | `src/skills/release-comms/SKILL.md`:60 | `src/skills/customer-research/SKILL.md` | optional-integration | no | manual review: "(cite … if a switch-event surfaced)" — conditional |
| 139 | `gtm-marketing -> product-discovery` | `src/skills/release-comms/SKILL.md`:92 | `src/skills/customer-research/SKILL.md` | documentation-reference | no | reference section: related skills |
| 140 | `gtm-marketing -> product-discovery` | `src/skills/release-comms/SKILL.md`:130 | `src/skills/customer-research/SKILL.md` | documentation-reference | no | manual review: inside a worked example ("Sprint 47 ships …"); sample output, not a step |
| 141 | `gtm-sales -> product-basic` | `src/skills/deal-qualification-meddic/SKILL.md`:140 | `src/skills/funnel-analysis/SKILL.md` | documentation-reference | no | reference section: related skills |
| 142 | `gtm-sales -> product-basic` | `src/skills/expansion-playbook/SKILL.md`:141 | `src/skills/churn-prevention/SKILL.md` | documentation-reference | no | reference section: related skills |
| 143 | `gtm-sales -> product-basic` | `src/skills/expansion-playbook/SKILL.md`:143 | `src/skills/onboarding-design/SKILL.md` | documentation-reference | no | reference section: related skills |
| 144 | `gtm-sales -> product-basic` | `src/skills/expansion-playbook/SKILL.md`:145 | `src/skills/retention-loops/SKILL.md` | documentation-reference | no | reference section: related skills |
| 145 | `gtm-sales -> product-basic` | `src/skills/pipeline-strategy/SKILL.md`:133 | `src/skills/funnel-analysis/SKILL.md` | documentation-reference | no | reference section: related skills |
| 146 | `laravel -> frontend-design` | `src/skills/blade-ui/SKILL.md`:24 | `src/skills/design-intelligence/SKILL.md` | documentation-reference | yes | index-shaped entry |
| 147 | `laravel -> frontend-design` | `src/skills/flux/SKILL.md`:23 | `src/skills/design-intelligence/SKILL.md` | documentation-reference | yes | index-shaped entry |
| 148 | `laravel -> frontend-design` | `src/skills/livewire/SKILL.md`:23 | `src/skills/design-intelligence/SKILL.md` | documentation-reference | yes | index-shaped entry |
| 149 | `laravel -> react` | `src/skills/livewire-architect/SKILL.md`:44 | `src/skills/react-shadcn-ui/SKILL.md` | optional-integration | no | disambiguation / routing section: when to use |
| 150 | `legal-review-prep -> engineering-base` | `src/rules/legal-safety-floor.md`:139 | `src/skills/privacy-review/SKILL.md` | documentation-reference | no | reference section: see also |
| 151 | `legal-review-prep -> engineering-base` | `src/skills/dpa-review/SKILL.md`:28 | `src/skills/privacy-review/SKILL.md` | optional-integration | no | disambiguation / routing section: when to use |
| 152 | `legal-review-prep -> engineering-base` | `src/skills/dpa-review/SKILL.md`:28 | `src/skills/data-handling-judgment/SKILL.md` | optional-integration | no | disambiguation / routing section: when to use |
| 153 | `legal-review-prep -> engineering-base` | `src/skills/dpa-review/SKILL.md`:82 | `src/skills/privacy-review/SKILL.md` | documentation-reference | no | reference section: related skills |
| 154 | `legal-review-prep -> engineering-base` | `src/skills/dpa-review/SKILL.md`:83 | `src/skills/data-handling-judgment/SKILL.md` | documentation-reference | no | reference section: related skills |
| 155 | `legal-review-prep -> ops-people` | `src/rules/legal-safety-floor.md`:138 | `src/skills/contracts-cognition/SKILL.md` | documentation-reference | no | reference section: see also |
| 156 | `legal-review-prep -> ops-people` | `src/skills/contract-review/SKILL.md`:28 | `src/skills/contracts-cognition/SKILL.md` | optional-integration | no | disambiguation / routing section: when to use |
| 157 | `legal-review-prep -> ops-people` | `src/skills/contract-review/SKILL.md`:82 | `src/skills/contracts-cognition/SKILL.md` | documentation-reference | no | reference section: related skills |
| 158 | `legal-review-prep -> ops-people` | `src/skills/nda-triage/SKILL.md`:73 | `src/skills/contracts-cognition/SKILL.md` | documentation-reference | no | reference section: related skills |
| 159 | `meta -> ai-image` | `src/rules/doc-screenshot-hygiene.md`:101 | `src/skills/image-editing/SKILL.md` | documentation-reference | no | reference section: see also |
| 160 | `meta -> ai-image` | `src/skills/screenshot-hygiene/SKILL.md`:170 | `src/skills/image-editing/SKILL.md` | documentation-reference | no | reference section: see also |
| 161 | `meta -> ai-video` | `src/rules/doc-screenshot-hygiene.md`:101 | `src/skills/image-analyser/SKILL.md` | documentation-reference | no | reference section: see also |
| 162 | `meta -> ai-video` | `src/skills/screenshot-hygiene/SKILL.md`:169 | `src/skills/image-analyser/SKILL.md` | documentation-reference | no | reference section: see also |
| 163 | `meta -> finance-basic` | `src/skills/docx-authoring/SKILL.md`:89 | `src/skills/spreadsheet-authoring/SKILL.md` | documentation-reference | no | reference section: related skills |
| 164 | `meta -> finance-basic` | `src/skills/pdf-tools/SKILL.md`:89 | `src/skills/spreadsheet-authoring/SKILL.md` | documentation-reference | no | reference section: related skills |
| 165 | `meta -> frontend-design` | `src/rules/architecture.md`:45 | `src/rules/ui-audit-gate.md` | load-bearing | no | inline prose, no conditional or reference marker |
| 166 | `meta -> frontend-design` | `src/skills/docx-authoring/SKILL.md`:89 | `src/skills/html-deck/SKILL.md` | documentation-reference | no | reference section: related skills |
| 167 | `meta -> gtm-marketing` | `src/skills/doc-coauthoring/SKILL.md`:162 | `src/skills/humanizer/SKILL.md` | optional-integration | no | disambiguation / routing section: do not |
| 168 | `meta -> gtm-marketing` | `src/skills/readme-writing-package/SKILL.md`:355 | `src/skills/humanizer/SKILL.md` | optional-integration | no | disambiguation / routing section: do not |
| 169 | `meta -> gtm-marketing` | `src/skills/readme-writing/SKILL.md`:250 | `src/skills/humanizer/SKILL.md` | optional-integration | no | disambiguation / routing section: do not |
| 170 | `meta -> laravel` | `src/rules/architecture.md`:39 | `src/skills/laravel/SKILL.md` | optional-integration | no | disambiguation / routing section: general principles |
| 171 | `meta -> laravel` | `src/rules/architecture.md`:39 | `src/skills/laravel-validation/SKILL.md` | optional-integration | no | disambiguation / routing section: general principles |
| 172 | `meta -> nextjs` | `src/rules/architecture.md`:41 | `src/skills/nextjs-patterns/SKILL.md` | optional-integration | no | disambiguation / routing section: general principles |
| 173 | `meta -> product-basic` | `src/skills/complexity-first-planning/SKILL.md`:122 | `src/skills/feature-planning/SKILL.md` | documentation-reference | no | reference section: related skills |
| 174 | `meta -> product-basic` | `src/skills/decision-record/SKILL.md`:222 | `src/skills/stakeholder-tradeoff/SKILL.md` | documentation-reference | no | reference section: related skills |
| 175 | `meta -> product-basic` | `src/skills/decision-record/SKILL.md`:230 | `src/skills/rice-prioritization/SKILL.md` | documentation-reference | no | reference section: related skills |
| 176 | `meta -> product-basic` | `src/skills/reasoning-orchestrator/SKILL.md`:24 | `src/skills/feature-planning/SKILL.md` | documentation-reference | no | manual review: analogy ("like X and Y"), not an instruction |
| 177 | `meta -> product-basic` | `src/skills/refine-prompt/SKILL.md`:30 | `src/skills/refine-ticket/SKILL.md` | optional-integration | no | conditional, stack-gated or depth pointer |
| 178 | `meta -> product-basic` | `src/skills/refine-prompt/SKILL.md`:46 | `src/skills/refine-ticket/SKILL.md` | optional-integration | no | disambiguation / routing section: when not to use (near-misses) |
| 179 | `meta -> product-basic` | `src/skills/refine-prompt/SKILL.md`:264 | `src/skills/refine-ticket/SKILL.md` | optional-integration | no | disambiguation / routing section: do not |
| 180 | `meta -> product-basic` | `src/skills/refine-prompt/SKILL.md`:288 | `src/skills/refine-ticket/SKILL.md` | documentation-reference | no | reference section: see also |
| 181 | `meta -> python` | `src/skills/prompt-engineering-patterns/SKILL.md`:148 | `src/skills/async-python-patterns/SKILL.md` | documentation-reference | no | reference section: provenance |
| 182 | `meta -> symfony` | `src/rules/architecture.md`:40 | `src/skills/symfony-workflow/SKILL.md` | optional-integration | no | disambiguation / routing section: general principles |
| 183 | `ops-people -> engineering-base` | `src/skills/contracts-cognition/SKILL.md`:113 | `src/skills/privacy-review/SKILL.md` | documentation-reference | no | reference section: related skills |
| 184 | `ops-people -> engineering-base` | `src/skills/contracts-cognition/SKILL.md`:114 | `src/skills/data-handling-judgment/SKILL.md` | documentation-reference | no | reference section: related skills |
| 185 | `ops-people -> finance-basic` | `src/skills/throughput-vs-morale-tradeoff/SKILL.md`:131 | `src/skills/runway-cognition/SKILL.md` | documentation-reference | no | reference section: related skills |
| 186 | `ops-people -> founder-strategy` | `src/skills/contracts-cognition/SKILL.md`:115 | `src/skills/build-buy-partner/SKILL.md` | documentation-reference | no | reference section: related skills |
| 187 | `ops-people -> product-basic` | `src/skills/onboarding-program/SKILL.md`:27 | `src/skills/onboarding-design/SKILL.md` | optional-integration | no | disambiguation / routing section: when to use |
| 188 | `ops-people -> product-basic` | `src/skills/onboarding-program/SKILL.md`:121 | `src/skills/onboarding-design/SKILL.md` | documentation-reference | no | reference section: related skills |
| 189 | `product-basic -> finance-advanced` | `src/skills/funnel-analysis/SKILL.md`:119 | `src/skills/dcf-modeling/SKILL.md` | documentation-reference | no | reference section: related skills |
| 190 | `product-basic -> finance-advanced` | `src/skills/rice-prioritization/SKILL.md`:95 | `src/skills/dcf-modeling/SKILL.md` | documentation-reference | no | reference section: related skills |
| 191 | `product-basic -> finance-basic` | `src/skills/funnel-analysis/SKILL.md`:116 | `src/skills/unit-economics-modeling/SKILL.md` | documentation-reference | no | reference section: related skills |
| 192 | `product-basic -> finance-basic` | `src/skills/rice-prioritization/SKILL.md`:96 | `src/skills/unit-economics-modeling/SKILL.md` | documentation-reference | no | reference section: related skills |
| 193 | `product-basic -> founder-strategy` | `src/skills/funnel-analysis/SKILL.md`:118 | `src/skills/okr-tree-modeling/SKILL.md` | documentation-reference | no | reference section: related skills |
| 194 | `product-basic -> founder-strategy` | `src/skills/rice-prioritization/SKILL.md`:93 | `src/skills/okr-tree-modeling/SKILL.md` | documentation-reference | no | reference section: related skills |
| 195 | `product-basic -> gtm-sales` | `src/skills/churn-prevention/SKILL.md`:112 | `src/skills/expansion-playbook/SKILL.md` | optional-integration | no | disambiguation / routing section: step 5: hand back |
| 196 | `product-basic -> gtm-sales` | `src/skills/churn-prevention/SKILL.md`:128 | `src/skills/expansion-playbook/SKILL.md` | documentation-reference | no | reference section: related skills |
| 197 | `product-basic -> gtm-sales` | `src/skills/onboarding-design/SKILL.md`:128 | `src/skills/expansion-playbook/SKILL.md` | documentation-reference | no | reference section: related skills |
| 198 | `product-basic -> gtm-sales` | `src/skills/retention-loops/SKILL.md`:132 | `src/skills/expansion-playbook/SKILL.md` | documentation-reference | no | reference section: related skills |
| 199 | `product-basic -> product-discovery` | `src/skills/onboarding-design/SKILL.md`:132 | `src/skills/activation-design/SKILL.md` | documentation-reference | yes | reference section: related skills |
| 200 | `product-basic -> product-discovery` | `src/skills/retention-loops/SKILL.md`:113 | `src/skills/activation-design/SKILL.md` | optional-integration | yes | disambiguation / routing section: step 5: hand back |
| 201 | `product-basic -> product-discovery` | `src/skills/retention-loops/SKILL.md`:134 | `src/skills/activation-design/SKILL.md` | documentation-reference | yes | reference section: related skills |
| 202 | `react -> frontend-design` | `src/skills/react-shadcn-ui/SKILL.md`:36 | `src/skills/design-intelligence/SKILL.md` | documentation-reference | yes | index-shaped entry |
| 203 | `scale-discipline -> history-discipline` | `src/rules/scale-discipline.md`:112 | `src/rules/history-discipline.md` | documentation-reference | yes | reference section: see also |
