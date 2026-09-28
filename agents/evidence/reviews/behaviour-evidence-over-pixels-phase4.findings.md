# Completion review — behaviour-evidence-over-pixels, Phase 4

**Skipped:** no code surface for this completion — the diff is two skill markdown files, one skill reference markdown file, one roadmap markdown file and their three generated `dist/agent-src/` projections; the validator reports 0 code path(s) of 7 changed file(s), scope 6fe92a2569cae42f3990b5799a1116a8f0142ee3cbc3784dcff19fb055074390, declared 2026-09-28

## What this change is, and why R2 has nothing to bind to

Every changed file is prose or a byte-exact projection of prose. No TypeScript,
no script, no config, no schema, no test. The behavioural machinery this phase
demotes the screenshot *in favour of* — `src/scripts/ui_conformance_probe.ts`,
its fixture and its suite — shipped in Phases 0 through 6 and is untouched here;
this phase only changes which artefact the review procedure reads first.

## The independence statement, since the skip must not stand in for one

I authored this change, so nothing here is an independent read and none is
claimed. No reviewer was dispatched and none was sought: a declared skip is the
grammar this validator offers for a zero-code-path diff, and manufacturing a
self-review to fill the slot would be worse than an honest absence — it would
read as independent evidence in the artefact store. The judgement half of the
change is recorded in a place a reviewer can actually check rather than in a
verdict: the three preservation questions are answered in the roadmap under
Phase 4 *and* restated in the skill text itself, so a later reader can hold the
artefact against the claim instead of against my assertion about it.

## What was caught in-flight, recorded rather than hidden

Two gates found real defects in my own work and both are in the history rather
than folded away:

1. `check_no_roadmap_refs` caught a shipped skill citing
   `agents/roadmaps/archive/road-to-visual-review-loop.md` — a stable artifact
   may not name a specific roadmap file, archive included. Fixed in `26a2dbd7b`
   by keeping the quoted floor verbatim and moving the provenance pointer to the
   roadmap, which is transient and may carry it.
2. The lint-regression pass caught `skill_too_large` flipping from a non-finding
   to a warning at 429 lines against a 400-line ceiling. Fixed in `6daa154b5`
   by keeping the binding half in the skill body and moving the lookup half to
   the skill's on-demand reference — 399 lines.

Neither was found by reading my own diff, which is the argument for the gates
and against treating an author's own pass as coverage.

## The one thing a reviewer should look at first

The 4.1 verify line is a grep that must return nothing, and appearance capture
deliberately survives the rewrite under wording that grep does not match. That
is the intended outcome — the check is a shape test on the two demoted steps,
not a ban on appearance evidence — but it is also the exact shape that would let
a future edit quietly delete the floor and still pass. It is stated in the step,
in the roadmap and in the skill so the gap is visible; nothing enforces it.
