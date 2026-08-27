---
complexity: bounded
review_by: 2026-12-27
---

# Stub: road to an executable specification adapter (and the mutation half)

> **Stub — not active work.** Descoped out of
> `road-to-executable-specification-layer` on 2026-08-27 by a two-round AI
> council (anthropic + openai, 2/2 convergent in both rounds). The parent
> roadmap shipped its stack-neutral half — the observable-behavior test, the
> anti-script rule and the rubric rewire — and closed. What is held here is
> everything that needed a stack or a rig, plus the reason each is held rather
> than built.

## 1. What is held here

| Held | Parent step | Why it is not active |
|---|---|---|
| BDD-runner detection in the stack-detection skill | 2.1 | Its only named consumer was the adapter below. Council: shipping a detector with no consumer is speculative reuse that still costs fixtures, false-positive surface and documentation. |
| One end-to-end adapter (one stack, one runnable specification, red-then-green in CI) | 2.2 | No consumer has asked for one, and choosing a stack before anyone has asked is how the source set reached 21 phases. |
| The uncovered-stack list | 2.3 | Nothing to be uncovered relative to, until 2.2 exists. |
| Changed-surface mutation adapter reporting survivors and timeouts separately | 3.1 | Blocked by a **measured refusal** — see § 3. |
| Mutating the specification's own example values | 3.2 | Needs the specification 2.2 would have produced. |
| Flipping `mutation-sensitivity` off `degraded` | 3.3 | Needs 3.1 and 3.2. `e2e-test` stays `unknown` regardless; the registry says so. |

## 2. The adapter — decided (c), deliberately

Council round 1 asked which stack gets the first adapter: (a) TypeScript via
`playwright-bdd`, (b) Laravel via Behat, (c) neither first. Both seats chose
**(c)**, and both named (b) as the better guess *when a request arrives* — the
suite's PHP depth is greatest there and a business-language contract has the
clearest audience, at the cost of a runner beside Pest and one sentence stating
the unit/acceptance boundary.

**Promotion condition:** a real consumer names a stack and a concrete
executable-specification workflow, or recurring production-validation findings
show a stack-specific gap that stack-neutral prose cannot close. Request count
alone is not the trigger — demand intensity, maintenance cost and fit are.

## 3. The mutation half — a lock, not a backlog item

`agents/roadmaps/archive/road-to-test-independence-and-mutation-evidence.md`
refused a tool-assisted mutation rig for this tree on a **measurement**, with the
criterion set in advance: *"a rig is only worth its maintenance if 0.3 shows a
survivor count that hand-probing cannot keep up with."* The measurement ran — 10
probes in minutes, 3 survivors, every mutation restored, tree clean. Hand-probing
kept up. Its own reopen condition is *"a survivor population too large to
hand-probe — a checkable condition, not a matter of taste."*

`src/config/assurance-capability-registry.json` →
`mutation-sensitivity.revisit_if` names a changed-surface adapter. Council round
2 applied the mechanism-match test and found it is the **same mechanism**:
changed-surface is a selection scope, not a different rig — both generate mutants
and classify survivors and timeouts. A `revisit_if` describes what would lift a
`degraded` state; it is not independent authorization to build past a later,
evidence-backed refusal.

One seat's inference — that a narrower surface must yield fewer survivors and so
strengthens the refusal — was explicitly rejected by the other as not generally
reliable: a large changed surface in another repository could still overwhelm
manual probing. The verdict is unaffected; the reasoning is recorded with the
correction so a later reader does not inherit the weaker argument.

**Promotion condition (remeasure first, never assume):** a representative
changed surface produces more survivors than can be hand-probed inside a
deliberately agreed time budget — a budget this project has not set and which is
**not** inherited from any number proposed in the council round, both seats
having flagged invented cutoffs as unsupported. Or: a consumer requests
cross-repository mutation evidence and repeatability at scale is argued to
supersede the survivor-count criterion.

**If promoted, it still owes:** survivors and timeouts as separate counts, the
archived refusal cited in the adapter's own header rather than contradicted, and
a fresh measurement in the same change as the build.

## 4. Acceptance criteria this stub carries forward

Descoped from the parent, unchanged in substance:

- For one stack, an executable specification runs on the project's own runner and
  its recorded CI run shows **red before** the implementation and green after —
  the green alone does not satisfy it.
- Every stack the detection step recognises is either covered or named as
  uncovered; the uncovered list is non-empty and its count matches the detection
  surface's own list.
- Altering one example value in that specification turns the run red, asserted by
  a test rather than claimed.
- A changed-surface mutation pass reports survivors and timeouts separately, and
  every assurance-registry state it changes carries an `evidence` field naming a
  runnable command — with `e2e-test` unchanged.

## 5. What this stub does NOT hold

The parent's kill register still binds and is not reopened by promotion: no
canonical Acceptance IR, no restricted parser, no generic adapter API, no
external toolchain whose pins resolve to latest-upstream, no Gherkin-for-every-
change, no acceptance-green as a trust signal, and no universal minimum mutation
score.
