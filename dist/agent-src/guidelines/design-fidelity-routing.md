# Design-fidelity routing mechanics — how the trigger set is authored

Split out of [`design-fidelity-mechanics`](design-fidelity-mechanics.md) on
2026-09-09 under `check_depth_budget`'s 16,000-character per-file ceiling. It is
also a genuinely different subject: that guideline is read while PORTING an
artifact, and this one is read while EDITING the rule's own trigger set — which
happens rarely, by a maintainer, and never during a port.

## Routing mechanics

Migrated out of `design-fidelity.md` on 2026-09-09 under the council verdict on
`blocker: rule-body-cap` — a semantic migration that frees rule-body lines for
the operative pointers the same verdict requires, not an arbitrary line cut. The
rule keeps the obligations; this holds the reasoning behind them.

### The withdrawn builder-URL trigger

A page built in Lovable / v0 / bolt and handed over as a share link is a
finished spec, and `design-fidelity` does not route it. The obvious trigger was
tried and **withdrawn**: matching is plain lower-cased substring containment, so
`https://v0.dev/` also fires on `https://v0.dev/docs`, on a pricing page, and on
a changelog link — it would treat every mention of the tool's own site as a spec
handover. That is exactly the `claude.ai` failure the capability-URL trigger
exists to avoid, and by the rule's own standard it is worse than the gap it
closes. The alternatives are a bare-host keyword (broader still) or guessing
each vendor's share-path segment, and a trigger built on a guessed path is not
evidence.

**What closes it:** a verified share-path segment per vendor, or a
handover-word co-occurrence the matcher cannot express today. Until then the
class needs one word in the prompt, like any other unlisted filename.
`near-bare-host-mention` in `ROUTING_MATRIX` pins the bare-host direction silent
so a future attempt cannot reintroduce the broad form unnoticed.

### The trigger set, class by class

Phrase-heavy on the German side and on `artifact` deliberately: a bare
`artifact` keyword fires on *"the CI build artifact is 40 MB"*, which is CI
vocabulary and not a handover. `ROUTING_MATRIX` pins both halves — every class
that must route, and every near-miss that must stay silent (fixture
`daf-port-trigger-de`).

Each shipped class carries its own near-miss row, and the pairing is the
contract rather than a courtesy:

| Class | Its near-miss row | The direction that row tests |
|---|---|---|
| `phrase: claude.site/artifacts` | `near-claude-ai-chat-link` | a bare `claude.ai` chat link is a conversation reference, not a spec |
| `path_prefix: .claude/design-system/` | `near-generic-design-system-dir` | a bare `design-system/` is a normal source folder in a large fraction of frontend repos |
| `file_pattern: *.dc.html` | `near-plain-html-open-file`, `near-dc-in-a-filename` | an ordinary `.html` file in the tree; a filename that merely contains the letters |
| the withdrawn builder URL | `near-bare-host-mention` | left behind on purpose, so the broad form stays pinned silent |

### Write the near-miss row first — and test the right direction

Extending the trigger set without adding a near-miss row is how an over-broad
trigger lands. The stronger half of the contract is *which* near-miss:

**The row must test the direction the NEW trigger opens, not a direction that
was already closed.** The withdrawn class is the worked example. Its first
near-miss row tested a protocol-less mention — silent *before* the change, and
therefore incapable of catching the over-broadness the change introduced. The
row that would have caught it is `near-builder-host-non-handover-url`, a
documentation URL on the same host, and it exists only because a review asked
for it after the trigger had already shipped.

Applied on the next trigger to land: `*.dc.html` (the Claude Design canvas
artboard, which `*design.html` cannot match because it compiles to
`^(?:.*design\.html)$`) shipped with `near-plain-html-open-file` and
`near-dc-in-a-filename` written **before** it, both testing the direction it
opens — an ordinary `.html` file in the tree, and a filename that merely
contains the letters. Both were confirmed red-then-green against the real
matcher rather than asserted.

## See also

- [`design-fidelity-mechanics`](design-fidelity-mechanics.md) — the porting half.
- `tests/scripts/design_fidelity_routing.test.ts` — `ROUTING_MATRIX`, which is
  the measurement this file describes rather than a second copy of it.
