---
adr: 250
status: accepted
date: 2026-08-29
decision: confidentiality-redaction-is-not-an-archive-content-change
supersedes: —
superseded_by: —
phase: road-to-source-silence · Phase 2.4
type: structural
reopen_policy: directional
provenance:
  kind: agentic
  decision_makers: [anthropic/claude-sonnet-4-5, openai/codex-default]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E2
  basis:
    - agents/evidence/reports/source-skip-paths-ledger.md
    - src/scripts/external_sources_denylist.json
    - src/rules/source-confidentiality.md
    - agents/roadmaps/road-to-source-silence.md
review_trigger: >-
  Reopen on either of two observations, each of which falsifies a premise this
  record rests on rather than merely arguing against it. First — a redaction
  performed under this record is found to have altered a decision, a
  measurement, a count or a conclusion, since "only the identifier changes" is
  the entire basis for calling it not-a-content-change and a single
  counter-example refutes it. Second — a reader is observed unable to re-verify
  an archived measurement BECAUSE of a redaction marker rather than in spite of
  it, since the falsifiability of the archived record is the value this record
  claims to preserve. Explicitly NOT a reopen trigger: a maintainer without the
  census key being unable to recover which external source a codename stands
  for. That is the intended effect, not a regression.
---

# ADR-250 — a confidentiality redaction is not a content change to the archive

## Status

**Accepted.** Decided by AI council, 2026-08-29, 2/2 convergent and unqualified
(anthropic + openai, 1 round, $0.00, both seats subscription-authed). The
council's verdict is recorded verbatim in `road-to-source-silence` § Phase 2.4.

## Context

`agents/roadmaps/archive/` is this suite's institutional memory. It records what
was decided and what was measured, and the evidence discipline of the whole
repository rests on those records staying re-verifiable: every `reproduced at
<sha>` is falsifiable only because the record and the sha are both stable. The
tree treats the archive as effectively immutable for that reason, and no
mechanism distinguishes "someone edited a conclusion" from "someone edited a
name".

That undifferentiated immutability had a measured cost. Five entries in
`src/scripts/external_sources_denylist.json` `skip_paths` except archived
roadmaps **by name** from the source-confidentiality gate, because those files
contain readable harvest-source attributions:

| Excepted file | Deny hits suppressed |
|---|---|
| `agents/roadmaps/archive/road-to-final-state-and-market-readiness.md` | 10 |
| `agents/roadmaps/archive/road-to-ecosystem-harvest-index.md` | 4 |
| `agents/roadmaps/archive/road-to-image-brand-typography.md` | 3 |
| `agents/roadmap-assets/road-to-image-brand-typography.assets.md` | 4 |
| `agents/roadmaps/archive/road-to-subagent-value-realization.md` | 1 |

Measured 2026-08-29 by removing each entry and re-scanning; the full 32-entry
ledger is `agents/evidence/reports/source-skip-paths-ledger.md`. Those 22 hits
are the reason the gate is permanently blind to five named files, and the
blindness is not bounded to the names already there — an exception by path
exempts the file's *future* content too.

So the archive's immutability and the gate's coverage were in direct conflict,
and the conflict had no recorded resolution. `road-to-source-silence` Phase 2.3
cannot shrink the exception estate without editing those files, and Phase 2.4
exists to decide whether editing them is legitimate at all.

## Decision

**A confidentiality redaction is not a content change to the archive.**

An edit to an archived roadmap qualifies as a confidentiality redaction when
**all four** hold:

1. It replaces an external source identifier with an opaque codename, an `ENC1:`
   token, or a neutral descriptor — and changes nothing else on the line.
2. It changes **no** decision, measurement, count, date, verdict, conclusion, or
   file/line anchor.
3. It carries a dated redaction marker in the file, of the form
   `<!-- redacted <YYYY-MM-DD>: source identifiers replaced by codenames per
   ADR-250. No decision, measurement or count altered. -->`, so the edit is
   visibly a redaction rather than a silent rewrite.
4. The codename→source mapping exists exactly once, encrypted, in the Phase 0
   census (`agents/evidence/reports/source-attribution-census.md`).

A redaction meeting all four may be performed in place, and the file's by-name
`skip_paths` exception is removed in the same change. An edit failing any of the
four is an ordinary archive edit and this record does not authorise it.

**Verification is mechanical, not asserted.** A redaction lands with a
before/after audit demonstrating that only identifiers and markers changed — the
council required this on both seats. The reproducible form is a word-diff over
the redacted files, published with the change:

```bash
git diff --word-diff=porcelain -- <redacted files>
```

Every changed token is either a removed source identifier, an added codename, or
a line of the marker in item 3. Any other changed token falsifies the claim and
the redaction is not one.

## Consequences

**What this buys.** Five files leave the exception estate and rejoin the gated
surface, so their future content is checked like every other tracked file. The
archived decisions, measurements and counts stay readable and re-verifiable to
any reader, with or without the census key.

**What it costs, stated rather than implied.** A maintainer reading a redacted
archive can no longer tell *which* external source a codename stands for without
the census key. That is the intended effect. It is a real loss of
source-specific investigative ability, and it is why the mapping is retained —
encrypted — instead of destroyed. The alternative the council rejected destroys
substantially more.

**What it does not touch.** Git history. The pre-redaction text of every one of
these files remains recoverable by anyone with repository access, by the
recorded decision of the `whether-history-gets-rewritten` blocker (no rewrite).
This record makes the *current* archive quiet; it makes no historical claim, and
any description of the outcome inherits that limit.

## Alternatives

**(b) Encrypted wrappers instead of in-place redaction.** The affected archive
files become `ENC1:` blobs; nothing readable remains. Rejected 2/2. One seat:
"encrypting entire records destroys substantially more institutional value" than
codenaming. The failure is the same one that defeated the history-rewrite option
in this roadmap's own `whether-history-gets-rewritten` blocker — it solves a
bounded disclosure problem by destroying the primary verification mechanism, and
for this package that mechanism is the differentiator. A maintainer without the
key would lose the decision, not merely the source name.

**(c) Keep the five exceptions permanently.** Record that the archive is out of
scope for source confidentiality. Rejected 2/2: it "permanently exempts known
blind spots", and an exception by path exempts future content too, so the estate
can only grow. This is also the status quo, and the status quo is the defect.

## References

- `agents/roadmaps/road-to-source-silence.md` § Phase 2.3, 2.4 — the steps this
  record unblocks, and the verbatim council verdict.
- `agents/evidence/reports/source-skip-paths-ledger.md` — the per-entry
  measurement this record's Context table is drawn from.
- `src/rules/source-confidentiality.md` — the policy; § "The two classes are
  opposites" is the harvest-vs-license distinction that makes the license
  surfaces principled exceptions and the archives not.
- ADR-201 — the byte-exact projection invariant, cited by the ledger for why the
  `dist/agent-src/**` entries are derived rather than independent.

## Evidence

**The exception estate, measured per entry.** The five archive rows in the
Context table above are not an estimate. Each `skip_paths` entry was removed in
isolation and the gate's scan re-run over the tracked tree; the number is the
count of deny-pattern matches that entry was suppressing. Reproducible from the
ledger artefact, which publishes all 32 entries with the same measurement,
their classification, and their disposition.

**The conflict was live, not hypothetical.** `road-to-source-silence` Phase 2.1
and 2.3 both carry inline `NOT ATTEMPTED` / `PARTIAL` notes naming this
governance gap as the reason they did not execute — written by an earlier
execution pass that stopped at it rather than deciding it. The gap blocked real
work and the record of it blocking work is in the roadmap.

**The council round.** Question, option set and full responses were put to two
independently-configured seats on 2026-08-29. Both selected (a). Both
independently required the mechanical before/after audit now in § Decision, and
one added the specific requirement that the redaction convention document the
marker format, the mapping's storage and its key access — items 3 and 4 of the
qualifying test exist because of that. The convergence summary is inlined in the
roadmap rather than linked: `agents/runtime/council/` is gitignored and pruned,
so a durable artefact may not cite it.

**Strength: E2.** The measurement is reproducible and the decision is agentic
with human direction. It is not E3+: no consumer has exercised a redaction under
this record yet, so the claim that item 2 ("changes no measurement") is
*checkable in practice* rests on the word-diff procedure rather than on
observed use.
