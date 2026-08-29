# Source confidentiality — mechanics

Migrated out of [`source-confidentiality`](../../../src/rules/source-confidentiality.md)
on 2026-08-29. The rule is delivered on **every subagent spawn**, so its body is
paid per spawn; this material is reference read on demand. Nothing was dropped —
the three sections below are the rule's own text, verbatim, and the rule keeps
its Iron Laws and points here.

### What "source-anonymous" claims, and what it explicitly does not

```
THE CLAIM IS ABOUT WHAT IS WRITTEN NEXT, NEVER ABOUT WHAT IS ALREADY RECORDED.
NEVER DESCRIBE THIS AS ERADICATION, REMOVAL FROM HISTORY, OR A CLEAN REPOSITORY.
COMMIT MESSAGES, MERGED PR BODIES AND OLD DIFFS REMAIN RECOVERABLE BY ANYONE
WITH REPOSITORY ACCESS, AND NO PHASE OF THIS PROGRAMME CHANGES THAT.
```

The `whether-history-gets-rewritten` decision resolved **no rewrite** (AI
council 2026-08-28, 2/2): the evidence estate rests on stable commit pins, and a
`git filter-repo` would convert every past `reproduced at <sha>` into an
unverifiable claim — a larger loss than the residual it removes, and one that
would still not reach a pre-rewrite clone, a fork or a PR mirror. So the
residual is **counted, not hidden**: the census artefact
(`agents/evidence/reports/source-attribution-census.md`) carries a `residual:`
field for the immutable surfaces, and "clean" always means "clean minus the
recorded residual".

### The two classes are opposites, and only one of them is a leak

```
HARVEST ATTRIBUTION IS PROHIBITED EVERYWHERE.
LICENSE-REQUIRED ATTRIBUTION IS MANDATORY, AND LIVES ONLY IN THE LICENSE SURFACES.
CONFLATING THEM IN EITHER DIRECTION IS A DEFECT: SCRUBBING A LICENSE NOTICE
BREAKS A LEGAL OBLIGATION, AND HIDING A HARVEST BEHIND ONE IS THE LEAK.
```

The three license surfaces, by path — no others:

- `CREDITS.md`
- `docs/THIRD-PARTY-NOTICES.md`
- `provenance/borrows.jsonl`

An upstream name there is required by the license or by
[`code-provenance`](code-provenance.md) and is never scrubbed. The same name in
a roadmap, skill, rule, ADR or commit message is harvest attribution and is a
defect. Every other `skip_paths` entry is a gate-own file or a vendored-cluster
member carrying its own notice.

## The gate also checks SHAPE, not only names

A deny list can only catch a name somebody already wrote down; the next unknown
source walks straight through it. `check_no_external_sources` therefore also
flags attribution by **form** — a `> **Source:**` header whose value is neither
an opaque round identifier nor an `ENC1:` token, a quoted
`agents/tmp(.old)/<name>/` directory whose name is not opaque, and an
un-allowlisted `github.com/<owner>/<repo>` URL — and it matches tracked **paths**
against the deny set, not only file contents.

Tiering, per the resolved `how-loud-the-slug-heuristic-is` decision (AI council
2026-08-28, 2/2): **block inside `agents/**`, warn elsewhere** — slugs are
ordinary content in integration code and docs, where blocking globally would
drive the broad allowlisting that is worse than the gap it closes. The warn tier
is written to a retained CI report (`--report <path>`), not merely printed, so
it stays auditable. Pre-existing occurrences are a **shrink-only count** in
`src/config/gate-violation-baselines.json`, never an allowlist: nothing is
excused and a new occurrence fails immediately.

## Why these four rules are unconditional

Under ADR-236 (`docs/decisions/ADR-236-one-artefact-one-layer.md`) this rule is
delivered by the PROJECT layer only — it exists to maintain this package, so the
global layer no longer carries an unscoped twin of it. A `paths:`-scoped rule is
**not re-injected after `/compact`** (ADR-227:79-80), so scoping it would mean the
obligation silently disappears mid-session with nothing left to reload it.

It is therefore delivered unconditionally, and the path triggers were removed
rather than worked around. **This section is the shared record for all four such
rules** — `no-roadmap-references`, `rule-type-governance` and `skill-quality` carry
the same change and no note of their own. Two reasons: four copies of the rationale
cost more standing context than the decision they explain, and the other three are
migrated POINTER stubs held at their pointer's size by
`check_rule_stub_ceiling` — prose added there is prose in the wrong place by that
gate's own contract, which is what caught the first attempt to duplicate it.

AI council 2026-08-20, 2/2 convergent on this option over three alternatives, with
two independent decisive arguments. First: the obligation governs an **authoring
decision**, which happens before any file exists for a path trigger to match — so
path-scoping fails at greenfield creation whether or not a compaction ever occurs.
Second: the measured cost is small against what the partition returns. Keeping an
unscoped global copy was rejected because it re-creates the duplication the
partition exists to remove; splitting the four by "has a CI gate" was rejected by
both seats as the wrong axis — a validator observes an outcome, it does not hold an
obligation during the session, and `rule-type-governance` has no gate at all.

**Cost, measured and corrected.** An earlier revision of this note claimed 1,754
tokens (1.8 % of the partition's 96,584-token saving). That figure was a
`chars / 4` proxy over the projected files and **understated the real cost by about
half**: `check_rule_activation_census`, which counts with the exact BPE tokenizer,
measures the unconditional corpus growing **108,130 → 111,642, i.e. +3,512 tokens
(3.6 %)** — and that number includes this rationale, which is why it lives in one
place instead of four. The verdict does not depend on the figure: one seat argued
the token axis was the wrong one entirely, the other that cost is a legitimate axis
which simply loses this particular comparison. Both readings survive 3.6 %.

## See also

- [`source-confidentiality`](../../../src/rules/source-confidentiality.md) — the rule these mechanics belong to.
- [`code-provenance`](../../../src/rules/code-provenance.md) — the license-required-attribution obligation the two-class split defers to.
- `src/scripts/check_no_external_sources.ts` — the gate that implements the shape checks.
