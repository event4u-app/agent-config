---
adr: 275
status: accepted
date: 2026-09-11
decision: standing-payload-ceiling-is-measured-at-the-base-ref-stage-1-retains-the-stored-allowance
supersedes: —
superseded_by: —
type: structural
reopen_policy: owner
protected_dimensions: governance
provenance:
  kind: agentic
  agentic_mode: council
  decision_makers: [council]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/evidence/analysis/git-archive-drops-a-declared-payload-surface-2026-09-11.md
    - src/config/preamble-payload-budget.json
    - src/config/preamble-payload-exceptions.json
    - src/scripts/check_preamble_payload_budget.ts
    - src/scripts/_lib/measured_payload_ceiling.ts
    - src/scripts/_lib/base_ref_payload.ts
    - src/scripts/_lib/payload_catalogue_completeness.ts
    - src/scripts/_lib/standing_bound_ratchet.ts
    - .github/workflows/standing-payload-delta.yml
    - tests/scripts/measured_payload_ceiling.test.ts
review_trigger: >-
  Stage 2 is attempted — the stored allowance removed from `ci_delivery` and the
  payload check added to `required_status_checks` — at which point this record is
  reopened to confirm that the base ref carries recovery-aware gate code and that
  the bypass-and-recovery exercise the council made blocking has actually been
  run. Also reopened if a second repository admin exists, because the exception
  path's authenticated-approval requirement is unsatisfiable with one admin who
  is also the author of every pull request, and a second one changes that
  premise. Also reopened if any numeric exception cap is proposed: both seats
  refused to derive one from a sample censored by the ratchet it would relax, and
  the rejection stands until rejection instrumentation and derived consumption
  have uncensored the distribution.
---

# ADR-275 — the standing-payload ceiling is measured at the base ref, and stage 1 keeps the stored allowance

## Status

Accepted 2026-09-11. Decided across two AI-council rounds (2/2 present and
convergent on the operative moves in both, blind peer review, three rounds in the
second) under a written owner delegation covering an autonomous run of
`road-to-delivery-for-every-host` step 4.4.

## Context

`ci_delivery.grace_ceiling` was a STORED number, 138,490, compared against a
measured payload of ~138,413 on every pull request. ADR-264 fixed it as
shrink-only; ADR-274 deleted its unenforced expiry and left it undated. Step 4.4
of the roadmap asks for it to be gone, with the exit condition
`grep -c grace_ceiling src/config/preamble-payload-budget.json == 0`.

The defect in the stored form is not its value. It is that a stored ceiling stays
where it was put until a human lowers it, so payload that a merge REMOVED can be
added straight back into the space it freed and nothing objects. Its own
`grace_ceiling_history` records it rising twice under a sentence forbidding
exactly that.

## Decision

**The ceiling is computed per run:**

```
ceiling = max(design_ceiling, effective_base + active grant, stored_allowance?)
effective_base = active grant ? min(payload_at_base_ref, watermark) : payload_at_base_ref
```

Five parts, each from a converged verdict:

1. **Base-measured, no per-PR headroom.** The ordinary path is zero net growth
   while the tree is over design, and the design ceiling once it is at or below.
   Both seats refused a percentage or fixed allowance against a moving base
   because both authorise cumulative growth — 138,413 × 1.05^10 ≈ 225,000 after
   ten pull requests. A capped variant (`min(base × 1.05, 138490)`) was raised in
   review and refused by both: it locks today's overage in place, and its
   reduction tracking stays dormant until the base drops ~6,500 tokens.

2. **Fail-closed.** `--require-base` makes an unestablishable base REFUSE rather
   than skip. Under a stored ceiling an unreadable base cost a comparison; under
   a measured one it would grant an unbounded budget on an infrastructure
   failure. The four fail-open returns in `_lib/standing_bound_ratchet.ts` were
   already mode-gated behind this flag; the ceiling path now uses it too.

3. **The gate is pinned to the base ref.** CI materialises the base tree's
   `src/` and runs THAT gate against the head tree via `--repo-root`, so a pull
   request cannot edit the code that measures it. Both seats chose this over
   code-owner review on the gate, which would put the sole maintainer in the path
   of every gate-editing pull request and fails the owner's autonomy constraint.

4. **A break-glass ledger with six contract rules**, in
   `src/config/preamble-payload-exceptions.json`, shipped empty. At most one
   active grant; approval must be verified outside the diff; deletion cannot
   discharge debt; `repaid_at` records a measurement rather than asserting one;
   consumption is derived, never stored; expiry is evaluated at gate time.

5. **Catalogue exhaustiveness.** Every tree under `dist/agent-src/` is either a
   declared prefix-stable surface or carries an explicit on-demand
   classification with its mechanism, and a rule-shaped file outside the rules
   bucket refuses. Payload the census cannot see is payload no ceiling bounds —
   and it defeats a stored ceiling exactly as it would defeat this one, which is
   why it is an independent defect rather than an argument for the stored form.

**And the stored allowance stays, for now.** This is stage 1 of two.

## Why stage 1 keeps the number step 4.4 asks to delete

Because the gate cannot validate its own introduction. Under part 3 the
authoritative measuring code is the code at the base ref, and while the
implementation pull request runs, the base ref still carries the OLD
implementation. openai, verbatim: *"If required-check configuration and ceiling
removal happen before the base contains working recovery-aware code, step N
directly blocks step N+1."* anthropic reached the same sequencing independently.

So stage 1 lands the entire mechanism with the stored number retained as an
ADDITIONAL term. It enters through a `max`, so it can only ever widen the bound —
nothing binds more tightly than it did yesterday, the measured number is computed
and reported on every run, and stage 2 removes one term from a base that already
carries this code.

**Step 4.4 therefore stays open, and that is the verdict rather than a shortfall
of this change.** openai: *"Step 4.4 must remain open. 'Grace ceiling gone' is
false. The roadmap must not be closed as complete."* The `grep` exit condition is
necessary and not sufficient: the same round held that 4.4 closes only once the
stored exception has been replaced by an active, required, fail-closed measured
ratchet, and "required" is branch-protection configuration this change does not
touch.

## Consequences

- A bare local invocation and the CI invocation now make the IDENTICAL
  comparison, because both compute the ceiling. `--ceiling` is removed and
  refused with an explanatory exit 2 rather than ignored: a caller still passing
  a number believes it is setting the bound.
- `task ci` goes from red to green on an unchanged tree. That is the ceiling
  parity defect closing from the other side, not a weakening: the gate was red
  locally against the design ceiling on a tree remote CI passed against the
  stored one.
- The shrink-only ratchet's subject moved with the ceiling. It bounded one
  number; it now bounds `design_ceiling`, the retained allowance, and every
  existing grant and watermark, and it refuses a DELETED grant — the one failure
  a shrink-only comparison misses by construction, because a removed number is
  not a smaller number.
- A latent measurement defect was found and fixed on the way: `git archive`
  honours `export-ignore`, and `/CLAUDE.md` is export-ignored, so an
  archive-based base reading came back 746 tokens light on an unchanged tree — a
  ceiling too TIGHT by that much, reddening work nobody did. Evidence:
  `agents/evidence/analysis/git-archive-drops-a-declared-payload-surface-2026-09-11.md`.

## Honest limits

- **The trust boundary is forensic, not preventive.** anthropic: *"the mechanism
  does not prevent the exploit; it makes the exploit auditable."* A gate
  weakening merged first and exploited second is visible in `git log` and is not
  blocked. Its price is also real: a legitimate gate FIX does not protect the
  pull request that ships it, and the gate must stay executable at recent `main`
  refs.
- **The exception path is unusable with one repository admin, deliberately so.**
  A grant is honoured only when an approval event outside the diff is verified,
  and the only platform signal available is an approving review from someone
  other than the author. With a single admin who authors every pull request, no
  such review can exist, so no grant can be authenticated and every grant is
  refused. That is the fail-closed reading, and the recovery path for a genuine
  emergency is the repo-admin bypass stage 2 configures — not a self-approved
  entry in a file.
- **The check is not required today.** Measured live at this date:
  `required_status_checks` carries exactly one context, `Sync + Generate Tools
  Consistency`. The workflow comment claiming this job was already required was
  false and is corrected in the same change.
- **No numeric cap is enforced.** Both seats refused to derive one: the 250-PR
  delta distribution is censored by the very ratchet a cap would relax, so every
  percentile describes what got through rather than what was attempted. The
  rejection instrumentation this change ships is what uncensors it.

## Evidence

- `agents/evidence/analysis/git-archive-drops-a-declared-payload-surface-2026-09-11.md`
  — the reproduction of the `export-ignore` defect: the direct and
  archive-based bucket tables side by side, the `git archive HEAD -- CLAUDE.md`
  empty-tarball command, the `git check-attr` confirmation, and why the first
  (symlink) hypothesis was wrong.
- `src/scripts/_lib/measured_payload_ceiling.ts` — the formula, the watermark
  pin and the six ledger contract rules, each carrying the verdict clause it
  comes from.
- `src/scripts/_lib/base_ref_payload.ts` — the base measurement and why it does
  not use `git archive`.
- `src/scripts/_lib/payload_catalogue_completeness.ts` — the exhaustiveness
  check and the on-demand classification with a mechanism per tree.
- `src/scripts/_lib/standing_bound_ratchet.ts` — the bound set after the move,
  including the deletion check.
- `src/config/preamble-payload-exceptions.json` — the ledger contract as shipped.
- `tests/scripts/measured_payload_ceiling.test.ts` — 31 cases; the watermark pin
  proven sensitive by neutralising it (2 red) and restoring it (31 green), and
  the base-reading equality that pins the `export-ignore` regression.
- The live branch-protection reading behind the "not required today" limit:
  `gh api repos/:owner/:repo/rulesets` on 2026-09-11 — one required context,
  `bypass_actors: []`, `current_user_can_bypass: "never"`.
- Council transcripts for both rounds are local-only and gitignored under
  `agents/runtime/council/`, per this repository's output-path convention; the
  operative quotations are reproduced above and in the roadmap's step 4.4 rather
  than cited by path.

## Alternatives rejected

- **Remove the stored ceiling in this change** — refused above on sequencing.
  Refused a second way as well: it would satisfy step 4.4's `grep` while the
  required-check limb stays unmet, which openai named in terms as closing the
  roadmap through *"cosmetic grep compliance"*.
- **`min(base × 1.05, stored)`** — refused by both seats; see part 1.
- **Code-owner review on the gate files** — refused in favour of base-ref
  pinning, because it puts the maintainer in the path of every gate-editing pull
  request and fails the owner's stated autonomy constraint.
- **A pre-commit hook forbidding a diff that touches both gate and policy** —
  openai: it *"is controlled by the same PR and is not a meaningful trust
  boundary."*
- **Moving the gate to a separate repository or submodule** — considered and
  judged disproportionate unless base-pinned execution proves insufficient.
- **Running the gate log-only for 30 days to collect uncensored data** —
  anthropic listed it so the owner could reject it: it permits unbounded growth
  for the whole window, which is the owner constraint read backwards.
