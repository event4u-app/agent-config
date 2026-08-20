<!-- evidence-type: analysis -->

# Source-first frontend — Phase 6 re-measurement

> `road-to-source-first-frontend` Phase 6 Step 1. Measured 2026-08-20 on
> `drain/road-to-source-first-frontend` (base `origin/main` @ `206ab4f16`),
> host Claude Code on macOS. Method is Phase 1 Step 1's, re-run verbatim so the
> before/after columns are comparable: the same fixture
> (`tests/design-artifacts/fixtures/design.html`), the same two arms — one whose
> prompt contains a `design-fidelity` trigger, one whose prompt contains none —
> and the same four recorded dimensions.

## Verdict in one line

**Three of the four dimensions moved in the intended direction and are now
measured rather than asserted; the fourth is still unreachable for the same
reason it was unreachable in Phase 1.** The new observation is that both arms
now *cite the data-basis ladder by its own reasoning* when declining pixels,
which Phase 1 could not observe because the prose did not exist yet.

## The four dimensions, before and after

| Dimension | Phase 1 Arm A | Phase 1 Arm B | Phase 6 Arm A | Phase 6 Arm B |
|---|---|---|---|---|
| Artifact read before any write | yes | yes | yes | yes |
| Screenshot / vision path used | **not measurable** | **not measurable** | no — **and the reason is the ladder** | no — **and the reason is the ladder** |
| 3 handlers survived | 3 | 3 | 3 | 3 |
| 1 keyframe survived | 1 | 1 | 1 | 1 |
| Losses / deviations stated | yes | yes | yes | yes (two, enumerated) |
| Diff vs. the fixture | 11 lines, comment block only | 39 lines, comment block only | **0 lines — byte-identical** | 33 lines, comment + `<title>` only |

Arm A's prompt: `"setz das 1:1 um"` + the fixture path.
Arm B's prompt: `"Ich brauche eine eigenständige HTML-Seite, die so aussieht wie <!-- md-language-check: ignore -->
diese hier"` + the fixture path — no keyword, phrase, or file pattern from the <!-- md-language-check: ignore -->
rule's trigger set. Both prompts are Phase 1's, unchanged. The German is quoted
verbatim from Phase 1's method because a re-measurement with a paraphrased
prompt is a different measurement; the two lines carry the sanctioned per-line
ignore marker rather than being translated.

### Independently verified, not taken from the arms' self-reports

Both arms reported their own counts. Those reports were re-derived from the
files rather than trusted, because a self-reported measurement is the
[`evaluator-independence`](../../../src/rules/evaluator-independence.md) hazard
in miniature:

```
$ grep -c 'addEventListener' p6-armA.html   → 3      (fixture: 3)
$ grep -c '@keyframes'       p6-armA.html   → 1      (fixture: 1)
$ diff fixture p6-armA.html | grep -c '^[<>]' → 0
$ grep -c 'addEventListener' p6-armB.html   → 3
$ grep -c '@keyframes'       p6-armB.html   → 1
$ diff fixture p6-armB.html | grep -c '^[<>]' → 33
$ diff fixture p6-armB.html | grep -E '^[0-9]'  → 6c6  8,11c8,9  13,16c11,13  18,28c15,21
```

Every Arm-B hunk lies above line 29 — the `<title>` and the head comment
block. A `shasum` over the region from `<style>` to end of file is **identical
to the fixture for both arms**, so the entire rendered surface (tokens, CSS,
DOM, all three handlers, the keyframe) survived unmodified in both. Arm B's
33-line diff is a documentation edit, not a port loss: it replaced the
fixture-registry provenance comment, which would have been a false claim in a
copy, and shortened the `<title>` suffix that names a test role the standalone
page does not have.

## What moved

- **Interaction survival: no longer at risk, and no longer accidental.** Both
  arms volunteered the interaction inventory. Phase 1 already saw that
  volunteered; what is new is that Phase 2 Step 4's ad-hoc inventory step now
  exists to be followed rather than re-invented, and both arms enumerated
  adopted-verbatim versus changed content in the bucket vocabulary rather than
  in prose of their own.
- **Fidelity of the port improved on both arms.** 11 → 0 lines and 39 → 33
  lines, with the residual being head-comment text in both cases. Arm A is now
  byte-identical.
- **The adopt-the-code duty is visibly binding.** Arm A's report names the
  reason it copied rather than retyped — "a re-derivation would risk silent
  drift in exactly the hexes and counts the fixture pins" — which is Phase 2
  Step 3's clause reached as a conclusion, not quoted.

## What did NOT move, and why — stated so the next run does not re-derive it

**The screenshot dimension is still not a measurement.** No page-reaching
capture primitive exists on this host: the Phase 1 Step 2 census found
`screencapture` (which photographs the physical display) and nothing else, and
that is unchanged. So neither arm *declined* a screenshot under availability —
the option was absent, and a dimension that cannot vary is not measured.

What *is* new and is worth separating from the above: both arms, unprompted,
gave the ladder's own argument as their reason. Arm A: a screenshot "cannot
recover CSS custom properties, `aria-*` wiring, `hidden` states, the opt-in
`.is-animating` class, or the three event handlers … `design-fidelity`'s ladder
puts a screenshot at validation level only, never as input while a higher rung
is reachable." Arm B: "a screenshot is validation, never the thing you build
from while a higher rung is reachable."

That is evidence the Phase 2 prose **reaches the model** on this host, which
was Risk 2's open question. It is **not** evidence the trigger set works, for
the reason Phase 1 already recorded: Claude Code loads the projected rule tree
as project instructions, so `design-fidelity` and the mechanics guideline are in
context whether or not a trigger matches. **The router is not the delivery
channel on this host.** A trigger-efficacy claim still needs a host where the
router is the only channel, and this measurement still cannot make one.

**The URL / live-page handover class (W5) remains unmeasured.** Both arms
received a local filesystem path, which is the easiest case and not the one the
operator reported. Phase 4's section is therefore still unscored by any fixture,
exactly as that phase's own closing coverage line states.

**The read-before-write rate still has no population.** 0 UI-write turns over 40
sessions in this repository; the two arms above are a fixture exercise, not
transcript telemetry, so they do not add to that denominator.

## Consequence for Phase 6 Step 2

Both gated follow-ups are decided against opening, on these numbers:

- **(a) a deterministic ad-hoc coverage checker** — interaction survival is 3/3
  handlers and 1/1 keyframe on both arms, in both measurement rounds. It did not
  fail, so there is no failure for a checker to catch. Opening it would be
  building a gate whose population is as empty as the read-before-write rate's.
- **(b) flipping `source-first-gate` toward stronger enforcement** — undecidable
  by construction and recorded as such rather than answered. The gate ships in
  shadow, so it has fired zero times because it *cannot* fire, not because the
  behaviour is absent. Its own flip condition (a stated record floor including at
  least one handover session) is the successor of this decision.

This is the second data point for the estate-wide "when is prose enough"
question, and it is a qualified yes: on a host that delivers the prose
unconditionally, over a local path-addressable artifact, with no capture
primitive available, prose alone produced a faithful port twice. None of those
three conditions is the operator's reported situation, so the qualification is
the finding.
