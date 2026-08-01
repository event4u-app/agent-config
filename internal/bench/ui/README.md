# Bench: ui

Pre-registration for the **port-fidelity** question: given a finished design
artifact as ground truth, how much of it does a produced UI actually carry?
Everything in this file was committed **before** the first scored run and is
not adjusted afterwards.

Run it:

```bash
task bench:ui              # score every configured candidate
task bench:ui -- --json    # machine-readable, same numbers
```

## Why this bench exists at all

Two questions were parked on a harness nobody had built. `road-to-ui-track-integrity-followup`
needs to measure whether the UI **builders** should run on the stronger model
tier while the **reviewers** run on the weaker one — today it is the other way
round. `road-to-provided-artifact-honesty` needs its own port fixtures scored.
Both need the same thing: a way to say *how far* a produced UI is from a
target, as a number, repeatably.

The predecessor's non-goal — *"do not build a UI-quality harness to answer one
frontmatter question"* — still holds against a single-purpose benchmark. This
is not one: it has three customers (this roadmap's acceptance criteria, the two
parked measurements, and a standing regression watch on every future change to
the UI skills), which is the verify stage of a shipped feature reused as a
bench.

## No model in the scoring path — and why that is the point

An LLM judge for *"is this frontend better"* imports judge variance and, worse,
**circularity**: Opus grading Opus, in the one measurement that has to decide
Opus vs Sonnet for the UI builders. A judge cannot answer the question the
bench was built for.

The port case is the single place where a **ground truth already exists** — the
user handed one over — so the question can be measured instead of adjudicated.
Every component below is deterministic; none calls a model.

## The four components (weights frozen)

| # | Component | Weight | What it measures | Threshold |
|---|---|---:|---|---:|
| 1 | `pixel` | 0.40 | 8×8 windowed **SSIM** on the luma channel, at 375 / 768 / 1280, scaled by page-height coverage | 0.90 |
| 2 | `dom` | 0.20 | Sørensen–Dice over the component inventory (tag + ARIA semantics; **class names excluded**) | 0.80 |
| 3 | `tokens` | 0.20 | Recall of the truth's colour / spacing / radius values in the candidate's CSS | 0.80 |
| 4 | `interactions` | 0.20 | Declarative checklist driven through the real browser | 1.00 |

Thresholds are **reporting bands, not gates.** The bench measures a distance;
it does not adjudicate. Nothing in CI fails on a score.

Three choices worth naming, because each is a place a lazier harness goes wrong:

- **SSIM with a window, never raw pixel equality.** Equality would measure font
  antialiasing rather than fidelity, and would report a faithful port as a
  failure on any machine but the one that produced the truth.
- **Class names are excluded from the DOM signature.** A real port renames
  everything into the target project's idiom. Scoring class names would reward
  copying over porting — precisely the wrong incentive. `port-faithful.html`
  exists as the control for this: it is deliberately *not* a byte-copy.
- **Tokens are scored as recall, not F1.** The question is what the port
  *kept* from the source. A candidate that adds tokens of its own (it needs
  states the source never showed) is not thereby less faithful.

### Separation — the bench asserts its own discriminating power

A faithful port must out-score a regenerated one on the weighted total by at
least **0.25**. A scorer that ranks the two the same is broken, and this is the
check that catches it rather than assuming it away.

## Fixtures — frozen before the first scored run

The scored set is `tests/design-artifacts/fixtures/`, the same set the Phase-0
eval fixtures use. There is no second fixture set on purpose.

| File | Role |
|---|---|
| `design.html` | ground truth — the handed-over artifact |
| `port-faithful.html` | candidate A — restructured markup, every design decision carried |
| `port-regenerated.html` | candidate B — the pre-fix rebuild, reconstructed from the Phase-0 measurement |

`fixtures.lock.json` pins the SHA-256 of all three. **A mismatch refuses the
run**; it does not warn. A fixture nudged after a first bad run contaminates
the measurement exactly the way a threshold chosen after seeing the
distribution does — the pre-registration is worthless if the inputs stay
editable while the outputs are watched. Extensions are allowed and are a **new
set, scored separately**, never a revision of the pinned one
(`--update-lock` starts a new epoch, deliberately and visibly).

## Determinism

A score is only reproducible if the render is.

**Enforced by the harness:** pinned browser recorded with every run · injected
stylesheet zeroing animation, transition, and caret · `reducedMotion: reduce` ·
`animations: disabled` at capture · `deviceScaleFactor: 1` · fixed viewport per
breakpoint · sRGB forced, font hinting and LCD subpixel text off · scrollbars
hidden.

**Enforced by the fixtures:** no network reference of any kind — no `@import`,
no `<link>`, no remote font, no remote image. A `fonts.googleapis.com` import
inside a fixture would make the SSIM score a function of the CI runner's
network and font fallback, i.e. the harness would be measuring the runner. No
`Date`, no `Math.random`, no animation still running at capture (the one
keyframe is opt-in via a class the harness never sets).

**Known limit, stated rather than hidden.** The fixtures use *generic* font
families (`serif` / `sans-serif`) rather than embedded faces. That removes the
network entirely, which is the larger determinism risk, but leaves glyph
rendering dependent on the host's default font mapping. Absolute SSIM is
therefore comparable **within a platform + browser epoch**, which is why every
run records `browser`, `platform`, and `node` in its report. A browser bump is
a new scoring epoch, not a free upgrade. Cross-platform comparison of absolute
pixel scores is not supported; the `dom`, `tokens`, and `interactions`
components are platform-independent, as is the **separation** between two
candidates scored in the same run.

## Why it lives in `internal/`, not `src/scripts/`

`package.json` `files[]` ships `src/scripts/` to consumers and ships neither
`internal/` nor `tests/`. This runner imports `@playwright/test`, a
devDependency: shipping it would put a broken import in a consumer install and
would be the browser runtime the 2026-06-28 lock excludes. Under `internal/` it
distributes nothing.

**The lock is not engaged here, and that is a finding rather than a
permission.** The lock forbids the package *shipping* a crawler, a Playwright
runtime, or a font-bundler. `@playwright/test` is already a devDependency and
the bench ships nowhere, so no reopening was required. The consumer-side verify
stage — an agent rendering and diffing a port inside the *consumer's* project —
stays gated, unchanged.

## First scored run

`internal/bench/reports/ui/latest.json`, epoch recorded inside. The numbers on
the first run (chromium 148, darwin-arm64):

| candidate | weighted | pixel | dom | tokens | interactions |
|---|---:|---:|---:|---:|---:|
| `port-faithful.html` | **0.9877** | 1.0000 | 0.9383 | 1.0000 | 1.0000 |
| `port-regenerated.html` | **0.5243** | 0.7100 | 0.6333 | 0.3182 | 0.2500 |

Separation **0.4634** against a pre-registered floor of 0.25.

Reading it: the faithful port scores 1.0000 on pixel because it *is* visually
identical — restructured markup, identical render, which is exactly what the
control is for. It does **not** score 1.0000 on `dom`, and should not. 41
elements in the truth against 40 in the port: the port renders the two screens
as `<section>` where the source used `<main>`, and replaces a visually-hidden
`<label>` with `aria-label`. Three unmatched signatures on the truth side, two
on the candidate side — small, real, and correctly visible. That is the bench
declining to round a near-match up to a match.

The regenerated build fails three of the four interactions (only the submit
survives, because the brief locks microcopy and states but nothing else) and
carries 7 of 22 of the source's token values — every cream, ink, and terracotta
hex is gone, along with the whole type scale. That is the measured shape of
"rebuilt from a five-key brief", not an argument about it.

## See also

- `tests/design-artifacts/eval-fixtures.md` § Provided-artifact port fixtures — the rubric siblings and their measured baselines.
- `docs/contracts/design-artifact-lifecycle.md` § Branch rules — the **Port a provided artifact** branch this bench scores.
- `internal/bench/ab/README.md`, `internal/bench/gated-reach/README.md` — the sibling benches whose pre-registration shape this follows.
