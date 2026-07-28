# S4.1 self-audit exhibit — the full pipeline run on `agent-config` itself

> Published regardless of outcome, per S4.1's honest-null clause: a clean run
> is evidence, a dirty run fixed in public is better evidence. Run 2026-07-28
> on branch `feat/road-to-provenance-and-license-governance`.

## What was run

| layer | scope | result |
|---|---|---|
| L-1 jscpd @min-tokens 25 | `src/scripts` + `src/skills` (1,757 files) | 4,529 clone pairs, 56,585 duplicated lines, **14.87%** |
| L0 scanoss-py 1.54.2 (real KB) | `src/scripts` (746 files), 21 s | **552 files** returned a snippet/file match |
| `lint_provenance` (own records) | `provenance/borrows.jsonl` | exit 0 — 0 records, NOTICES in sync |
| `detect_target_license` | repo root | `MIT` → `target_class: permissive`, `workspace_scope: single` |

## The finding that matters: 551 of 552 L0 hits are SELF-MATCHES

Breaking the L0 hits down by match origin:

| origin | count |
|---:|---|
| our own published package (`npmjs.com/@event4u/agent-config`, `proxy.golang.org/github.com/event4u-app/agent-config`) | **551** |
| genuine third-party (`@the-forge-flow/tff-cc`, MIT, one test file) | **1** |

SCANOSS's knowledge base has indexed our own published releases, so scanning
our own source matches our own code. A naive L0 gate would have flagged
**~74% of `src/scripts` on day one** — every hit a self-match, every one a
false alarm requiring dismissal.

**Operational consequence:** any future L0 use MUST filter self-matches
(by purl/URL origin) before reporting anything. The on-demand `license-audit`
skill carries that filter; it is not optional hygiene, it is the difference
between a usable audit and 551 lines of noise.

**Evidentiary consequence:** this is a THIRD independent argument for the
Gate-G0 verdict, discovered after the fact and pointing the same way as the
two pre-registered criteria that failed. The FP measurement on the synthetic
corpus (2/12) understated the real-world problem — on a real repo the
unfiltered FP surface is ~74%.

## The one genuine third-party hit

`tests/scripts/check_secret_leak.test.ts` matched a snippet in the MIT-licensed
`@the-forge-flow/tff-cc` npm package. Assessment: the file is a test whose
content is secret-detection *fixtures* (regex-shaped credential patterns).
Canonical detection patterns converge across every tool that detects the same
credential formats — this is the same canonical-convergence mechanism that
produced the corpus's 2/12 false positives, not evidence of a borrow. **No
ledger entry is warranted**, and per the refuted principle 6 no tool result
could establish one either way; the judgement is recorded here instead of
being laundered into a machine "clearance".

## L-1's 14.87% duplication on our own tree

Expected and not actionable as a provenance signal: it is intra-repo
structural repetition (CLI command scaffolds sharing argv-parse and
output shapes — `cmd_*.ts` pairs dominate the top hits). L-1 exists to catch
*within-project* laundering, and on a repo with a deliberate command-per-file
convention its baseline duplication is high. Interpreting it as a borrow
signal would be a category error.

## Sibling-repo state (S4.3 input, verified live)

| repo | LICENSE | declared license | NOTICES |
|---|---|---|---|
| `agent-ide-plugin` | present (MIT, 2026 event4u) | `package.json`: MIT | none |
| `data-helpers` | present (MIT, 2025-2026) | `composer.json`: MIT | none |

The roadmap's premise ("the agent-ide-plugin repo ships without a LICENSE")
is **stale** — both siblings carry a LICENSE and both declare MIT
consistently, so the recorded `data-helpers` license contradiction is also
resolved. Neither carries a NOTICES file, which is correct under this
package's own discipline: NOTICES is generated from a borrow ledger, and
neither repo has recorded borrows.
