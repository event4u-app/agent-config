# Design-slop near-miss corpus — pre-registration

Registered 2026-10-26 by `road-to-tells-a-near-miss-can-refute` step 1.1,
BEFORE the corpus exists. The commit that adds this file precedes the commit
that adds any corpus file; `git log --format=%H -- <this file> <corpus dir>`
is the proof.

## Why a second corpus

`design-slop-fp-PREREG.md` names its own honest-null branch: 26 rules × 32
clean files at M1 = 0 shows the clean corpus does not discriminate. A clean file
that never resembles a tell cannot refute a detector. This corpus holds
**near-misses** — legitimate, intended uses that a naive detector of a tell
would flag — so a rule can fail here, and a zero here means something.

## Population

`internal/bench/corpora/design-slop-nearmiss/`, three named splits:

| Split | What | Authored by |
|---|---|---|
| `tune/` and `holdout/` | One near-miss per registry rule (26), plus one per interaction signal M6, M7, M8, V9 (step 1.3); split alternately by catalog id into tune and holdout | an agent instance that saw the catalog's prose and NOT the detector source |
| `dogfood/` | The real findings of this repository's own `src/ui/` and `site/`, each labelled TP or near-miss by hand with a one-line basis (step 1.4) | this run, labels in `LABELS.json` |

`LABELS.json` carries, per file: the catalog id it targets, its split, the
basis for calling it legitimate, and the author.

## Metrics

- **M1 per rule per split** — distinct near-miss files on which the rule fires.
  Every file is legitimate by construction, so a hit is a false positive. Per
  file, not per hit, as in the clean bench.
- **Dogfood precision** — on `dogfood/`, TP ÷ (TP + near-miss) over the files a
  rule fires on, reported separately and never folded into a headline.

## The bar, declared before the run

A rule stays `backed` only at **M1 = 0 on every split**. A rule with M1 > 0 is
tuned **once**; if it still fires, it is demoted to `judgment-only` (the C6
precedent in `docs/CLAIMS.md`). No rule is tuned twice against this corpus.

## Predicted non-zero rules

Written down so the run can be wrong about them:

- **V1** (side stripe) — on a neutral 3 px border-left citation rule and on a
  danger-state stripe.
- **CP1** (dash density) — on prose that uses dashes as list punctuation.
- **M1** (overshoot easing) — on a momentum-carried sheet release.
- **C3** (dark glow) — on a focus ring drawn as a zero-offset shadow.
- **T7** (default fonts) — on a system-font stack chosen for an admin tool.

Every other rule is predicted at zero.

## Honest-null reading

All rules at M1 = 0 here would mean either that the detectors are precise
against legitimate look-alikes or that the near-misses were not near enough. The
second branch is checked, not assumed: every file states in `LABELS.json` which
detector signal it carries (the class, value or structure a naive matcher keys
on), so a file that carries none is visible as a weak near-miss.
