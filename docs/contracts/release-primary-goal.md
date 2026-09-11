---
stability: beta
keep-beta-until: 2026-11-11
---

# Release Primary Goal

> **Status:** beta · split out of [`release-sizing.md`](release-sizing.md)
> on 2026-09-11 because that contract's beta window lapsed carrying two
> obligations with opposite records. The rollback half was enforced and
> compliant and is now stable there; this half is the one that was never
> once honoured, and it keeps a window for exactly one more cycle — this
> time with a falsifier and a required mechanism instead of hope.
>
> **Authority.** The four legal actions on a beta marker are public
> statements about what consumers may rely on, which `decision-revisit-gate`
> reserves to the owner. An AI council converged on this split on 2026-09-11
> (2/2, blind peer review, subscription transport, $0.0000 billed) and its
> verdict was **recorded as advice and not executed**; the owner instructed
> execution in the same session. Council agreement did not convert the
> reserved transition — the owner's instruction did.

## The measurement that split the contract

The `Primary-Goal:` declaration below was live for the whole
2026-07-10 → 2026-09-10 beta window. Compliance over that window, read from
the release PR bodies on 2026-09-11:

| PR | Release | `Primary-Goal:` line |
|---|---|---|
| 2002 | 15.0.0 | none |
| 1967 | 14.23.0 | none |
| 1943 | 14.22.0 | none |
| 1913 | 14.21.0 | none |
| 1900 | 14.20.0 | none |
| 1886 | 14.19.0 | none |

**Zero of six.** Five are minor releases and squarely in scope; 15.0.0 is a
major and is listed for completeness rather than counted against the literal
wording. Not partial, not in spirit — the line appears in none of them.

Reproduce it:

```bash
gh pr list --state merged --limit 6 --search 'release' --json number,title,body \
  | python3 -c "import json,sys,re; [print(p['number'], p['title'][:40], '->', (re.search(r'^Primary-Goal:.*$', p.get('body') or '', re.M) or ['NO LINE'])[0]) for p in json.load(sys.stdin)]"
```

Two readings fit that number and this split does not pretend to settle which:
the obligation is **not worth following** (a value problem), or it was
**never surfaced anywhere a maintainer would see it at release time** (a
mechanism problem). The original window could not distinguish them, because
nothing in the repository asked for the line, checked for it, or templated it.
An extension on the same terms would produce the same uninformative zero, which
is why the falsifier below is a precondition rather than a hope.

## One primary product goal per minor release

Every minor release names **exactly one primary product goal** — the
one-sentence answer to "why does this release exist?". Secondary
changes may ride along, but the release notes lead with the primary
goal, and a release that cannot name one is not ready to cut.
Scope discipline, not a ratio: what qualifies is a judgment call the
maintainer makes when labeling the release PR
([`release-pr-gating.md`](release-pr-gating.md)).

### Primary goal declaration

Every release PR body carries one literal line:

```
Primary-Goal: <one sentence>
```

A release bundling multiple major themes anyway annotates the
**exception + reason** in the release notes ("this release bundles N
themes because <reason>; future releases return to one primary goal").
The declaration keeps the norm visible and the exception deliberate.

Explicitly REJECTED (council, anthropic/claude-sonnet-4-5 +
openai/gpt-4o, 2026-07-10): a mechanical subsystem-count lint on the
release PR. A file→subsystem map is its own maintenance burden, and
changed-file counts are a bad proxy for scope (a one-line kernel change
has a larger blast radius than 50 lines in a niche skill). Sizing stays
a norm enforced by declaration + human judgment; if the maintainer
wrote a nine-theme release, the maintainer already judged it — the
header makes that judgment explicit, not automatic.

**That rejection is about counting subsystems, and it does not reach the
declaration itself.** Checking that one literal line is present is not a scope
proxy and carries no file→subsystem map; it asserts only that the judgment the
contract already asks for was written down.

## The falsifier — what the next window must produce

```
AN EXTENSION WITHOUT A MECHANISM REPEATS THE WINDOW THAT JUST FAILED.
THE NEXT DISPOSITION IS DECIDED BY OBSERVED COMPLIANCE, NEVER BY ELAPSED TIME.
```

By **2026-11-11** this contract is promoted, superseded, or split again — and
which one is read off the following rather than argued:

- **Promote** when every eligible minor release cut after the mechanism lands
  carries a `Primary-Goal:` line, and at least two such releases exist. Fewer
  than two is not evidence, and the date does not substitute for it.
- **Supersede** when the mechanism is live and eligible releases still ship
  without the line, or the lines that do appear are contentless. That is the
  value answer, and it is a real result — it retires the obligation on evidence
  rather than on neglect.
- **Split again** only if the two readings separate along some axis this window
  surfaces and neither disposition fits.

**Precondition, and it is the whole point of the window:** the mechanism has to
exist before the window can measure anything. It is two pieces — a release PR
template carrying the line, and a check that reads it on a release-shaped PR —
tracked at
[`agents/roadmaps/stubs/road-to-a-primary-goal-that-is-asked-for.md`](../../agents/roadmaps/stubs/road-to-a-primary-goal-that-is-asked-for.md).
**If the mechanism has not landed by 2026-11-11, the disposition is
`supersede`, not another extension.** A second uninstrumented window is the
failure this split exists to prevent, and naming its consequence in advance is
what stops it being taken by default.

## Cross-references

- [`release-sizing.md`](release-sizing.md) — the stable half this was split
  from: disable paths, the enforced `Rollback:` line, the consumer-matrix
  floor. Release scope and release safety stay one subject read across two
  documents.
- [`release-pr-gating.md`](release-pr-gating.md) — release-PR shape detection;
  the sizing judgment happens at labeling time, and it is where a declaration
  check would bind.
- [`../release-runbook.md`](../release-runbook.md) — the cut procedure.
