# `task-completeness` — the measurement, and the null it produced

**Measured:** 2026-08-12 · **Steps:** completion-loop 1.3 and 2.2 ·
**Bar:** `task-completeness-preregistered-bar.md`, committed before this file.

## Verdict

**NULL — detector D is NOT built.** Precision is **0 of 3**. Every hit is a false
positive, all three from one named instrument defect, so the bar is missed on its
binding dimension rather than merely on corpus size.

| Bar | Threshold | Measured | Result |
|---|---|---|---|
| B1 precision | ≥ 0.80 | **0.00** (0/3) | **FAIL** |
| B2 95 % lower bound ≥ 0.80 | needs ≥ 14 all-true | 3 hits, 0 true | **FAIL** |
| B3 rate ≥ 2.0 % | ≥ 2.0 % | 75.0 % (3/4) | pass, and meaningless |

B3 passing is the reason the bar required all three: a 75 % rate over **four**
eligible windows reads alarming and says nothing. Had the bar been the rate
alone — the dimension whose numerator was already seen when the bar was written —
this roadmap would have shipped a refusal on 0-precision evidence.

## The corpus, and the number nobody expected

- **Store:** this package's own transcript store · **28 sessions**
- **Eligible reply windows: 4** — windows whose prompt named ≥ 3 distinct file
  tokens and which contained real assistant work
- **Hits: 3** · **hand-validated true positives: 0**

Four eligible windows across 28 sessions is the finding under the finding. The
enumerated-files shape was chosen because it is the only deliverable set whose
**identities** are mechanically recoverable — and in this corpus it is almost
absent, because the user speaks in intents ("fixe die ci", "mach weiter") while
the *agent* is what names files. An instrument whose eligible population is 4 of
28 sessions cannot reach the ≥ 14 hits B2 requires within any realistic window.

## Hand-validation, per hit

All three verified by opening the window in the store and re-running the
extractor over the prompt. The decisive column is the last one.

| Session | Prompt chars | `classify` | `isInjectedBody` | Tokens in the user's ACTUAL ask |
|---|---:|---|---|---|
| `d6154522` | 12 295 | de | false | **none** |
| `1930f062` | 7 656 | de | false | **none** |
| `1bf7f60a` | 2 488 | en | false | **none** |

- **`d6154522`** — the ask is *"versuche das mit den dokumenten in
  agents/tmp/… abzugleichen … fehlt noch etwas in dem pr?"*. It names no file. All
  12 tokens come from a **pasted agent review** the user quoted underneath
  ("Das sagen meine agents"), which cites `cmd_uninstall.ts` line counts and
  `hook-latency.json` as *evidence for its own claims*. The window did what was
  asked. **False positive.**
- **`1930f062`** — the ask is a **pasted PR review** whose body cites
  `dispatch_hook.ts`, `routing_doctor.ts` and `orchestration_backfill.ts` as
  evidence. Two further tokens, `a.ts` and `b.ts`, are from an illustrative
  sentence about renaming — they never existed. **False positive.**
- **`1bf7f60a`** — the ask is one sentence: *"Fixe den scheiß release command, so
  dass sie wieder funktionieren."* All nine tokens come from **pasted terminal
  output** (a preflight failure log) appended below it. **False positive.**

A fourth reading was pre-registered as belonging in neither bucket — a token
touched under a name the matcher cannot see. It did not occur. What did occur is
its mirror, and it is worth naming as its own class: **a token that was never a
deliverable at all.**

## The defect, precisely

`enumeratedFileTokens` runs over the **whole prompt**. It cannot distinguish
*files the user is asking for* from *files quoted inside material the user
pasted* — a review, a log, an example. Since a prompt in this repo routinely
carries pasted evidence, the extraction is dominated by it: in all three hits the
user's own ask contributed **zero** tokens.

Two sub-mechanisms let the pasted material through, both verified:

1. **`isInjectedBody` only filters long ENGLISH text** (`length > 2500 &&
   classify(text).language === "en"`). A 12 295-character pasted German review
   classifies `de` and passes untouched. The filter that exists to keep non-chat
   content out of the measurement is blind to the majority language of this
   corpus.
2. **The one English case missed the threshold by 12 characters** — 2 488 against
   a 2 500 cut. Not a false premise, just a reminder that a length cut is a
   proxy, not a boundary.

## What this does and does not close

**Closed:** detector D is not built, on measured evidence rather than on caution.
The measurement-before-detector ordering is what produced that — a rate-only bar
would have read 75 % and shipped a refusal with no kill-switch.

**Not closed, and stated as the re-ask condition rather than an open end:** the
*question* — does silent incompleteness happen? — remains unanswered. This
instrument did not answer it; it answered a different question (do prompts
enumerate files the reply skips) and found the proxy invalid. A future round
would need, in this order:

1. **Separate the ask from the pasted material** before extraction. Until that
   exists there is no honest completeness measurement over this corpus shape.
2. Only then re-derive the eligible population. If it is still ~4 in 28, the
   file-enumeration shape is the wrong proxy entirely and the answer is a
   different signal, not a bigger corpus.

## The check stays, with its precision in its own definition

The pre-registration said the check stays either way, on the grounds that a
measured zero is worth keeping. That reasoning does not survive this result: this
is not a measured zero, it is a measured **0-precision**, and a report printing
`⚠️ task-completeness 3` without it invites exactly the misreading the whole
roadmap exists to prevent.

So the check stays — a report is still the right shape — but the measured
precision is written **into `CHECK_MEANINGS` itself**, where `--why` cannot print
the count without it. Removing the check instead would delete the only record
that the proxy was tried and failed, which is the more expensive loss.
