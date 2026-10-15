# Egress placeholders — model fidelity per token spelling (PREREG endpoint d)

Pre-registration: `internal/bench/egress-placeholders-PREREG.md`, endpoint (d),
committed before this run. Scorer: `internal/bench/egress-token-fidelity/run.mjs`
(self-test passed before the run: an exact copy passes, an altered token and a
missing tool call fail). Raw per-trial rows: the JSON beside this file.

| Spelling | Form | Trials | Byte-identical | No tool call | Bar (20/20) |
|---|---|---|---|---|---|
| S1 | `⟦IBAN_1.495cff⟧` | 20 | 20 | 0 | pass |
| S2 | `__IBAN_1_495cff__` | 20 | 20 | 0 | pass |
| S3 | `__AC_IBAN_1_495cff__` | 20 | 20 | 0 | pass |

**Seat.** Claude Code host model through `claude -p --model sonnet`, run from a
temporary directory outside any repository with only the named tool offered;
every tool call was captured from the stream and denied, never executed.

**Second provider: not measured.** The PREREG made it conditional on a CLI that
exposes tool-call inputs; no such run was taken here, so nothing is claimed for
any other provider.

**Selection, by the pre-registered rule.** All three pass. ASCII-only beats
non-ASCII, which leaves S2 and S3; the shorter wins: **S2, `__TYPE_n_fp__`**.

**What this does and does not show.** 20/20 bounds the true per-trial failure
rate below roughly 14% at 95% confidence for each spelling; the run separates
"copies reliably" from "visibly corrupts" and nothing finer. It says nothing
about how a model reasons over a value it cannot see — that is endpoint (e).

**Observed property of the winner, recorded rather than weighed** (the rule was
fixed before the run): in Markdown, `__x__` renders as bold, so a rendered view
shows `IBAN_1_495cff` without the underscores. The bytes are unaffected; a
surface that displays tokens through a Markdown renderer must escape them.
