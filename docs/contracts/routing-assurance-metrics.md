# Routing-assurance metrics — pre-registration

> `road-to-routing-assurance` Phase 0.1. **Registered before any Phase-1
> implementation exists**, which is what makes the floors below a
> pre-registration rather than a description of what the checker turned out to
> do. Every baseline figure names the command that produced it.

## The unit, and why it is not "a test"

A **routed unit** is one thing the routing layer can select: a skill, or a rule
carrying a router tier. Metrics are per-unit, never per-test-file, because a
corpus can grow files without covering a new unit — and coverage of units is the
property that matters.

## The four metrics

### 1. Per-unit routing recall

**Definition.** Of the corpus prompts registered as *should-select* for unit *U*,
the fraction on which the routing layer selects *U*.
**Unit:** a ratio in `[0,1]`, reported per unit and as a corpus mean.
**Surface:** the surface the mechanism actually decides on — SKILL.md
`description` frontmatter for skills, router triggers for rules. A recall figure
measured on a different artefact than the one production reads does not count as
this metric; that substitution is the defect D1 records.

### 2. Per-unit precision on near-misses

**Definition.** Of the corpus prompts registered as *should-NOT-select* for *U*,
the fraction on which the routing layer correctly does not select *U*.
**Unit:** a ratio in `[0,1]`.
**Why it is separate from recall:** a unit that fires on everything scores
perfect recall. Precision is the only metric that can see it, and a corpus
without near-misses cannot compute it — which is why near-misses are a corpus
requirement rather than a nicety.

### 3. Catalogue-conditioned selection accuracy

**Definition.** Per-unit recall measured with the candidate catalogue restricted
to *N* entries, *N* ∈ {12, 20, 50, full}, distractors sampled deterministically
(FNV-1a order, the discipline `rule_trigger_eval.ts:20-21` already uses).
**Unit:** a ratio in `[0,1]` per *N*.
**Why:** selection is a comparison, so accuracy is a function of what it is
compared against. A figure quoted without its *N* is not this metric.

### 4. Delivery-path parity delta

**Definition.** `native_recall − mcp_recall` on the identical corpus, identical
prompts, identical floors.
**Unit:** a signed ratio; **0 is parity**, negative means the MCP path selects
worse.

## Coverage ratios — the Phase 0.3 ratchet seeds, measured 2026-08-25

```bash
# rules scope
python3 - <<'PY'
import json, glob, os
d = json.load(open('dist/router.json'))
ids = {r['id'] for r in d['tier_1'] + d['tier_2']}
fx  = {os.path.basename(p).rsplit('.',1)[0] for p in glob.glob('tests/eval/routing-matrix/*.yaml')}
print(len(fx & ids), '/', len(ids))
PY

# skills scope
find src/skills -name triggers.json | wc -l   # numerator
find src/skills -name SKILL.md      | wc -l   # denominator
```

| scope | corpus cases | routed units | ratio |
|---|---:|---:|---:|
| **rules** | 94 | 105 (tier-1 24 + tier-2 81) | **0.895** |
| **skills** | 76 | 299 | **0.254** |

Per tier, because the aggregate hides the split: tier-1 **21/24 = 0.875**,
tier-2 **73/81 = 0.901**.

**This table is the roadmap's defect, quantified.** The rules surface is ~90 %
covered by a *deterministic, gating* corpus. The skills surface — the one
production actually routes on — is **25 %** covered, and only by a harness that
is *"advisory only, never gating"* (`rule_trigger_eval.ts:4`). The gap is not
that skills are untested; it is that the tested surface and the deciding surface
are different artefacts.

## Floors

**Not set here, deliberately.** Phase 0.4 says each per-unit floor is its Phase
0.2 baseline value minus a fixed tolerance, and the 0.2 baseline is a live
harness run that has not happened. Writing floors now would be inventing them —
the exact move 0.4 forbids in its own title (*"Derive the floors, never invent
them"*).

What IS registered now is the **rule** for deriving them, so that a later run
cannot choose a tolerance after seeing the numbers:

- tolerance is a single constant applied to every unit, fixed in this file
  before 0.2 runs;
- no floor may be raised in the same PR that changes the thing it measures;
- every floor traces to a named row in the 0.2 baseline artefact.

**Tolerance, fixed now: 0.10 absolute recall.** A unit whose baseline recall is
0.80 gets a floor of 0.70. Chosen before any baseline exists, so it cannot be
tuned to a result.

## The two null hypotheses, quoted verbatim

Quoted rather than paraphrased, per 0.1's own verify line.

**Phase 3 (catalogue pressure):**

> "selection accuracy at full catalogue is not worse than at N=20 by more than
> the floor delta."

With the constraint the roadmap attaches at 3.3, which is part of the
pre-registration and not commentary: this null *"now settles exactly one
question, the confusion measurement, and cancels nothing"*, and its verdict text
**does not claim authority over tiering** — tiering already shipped for a
different reason (the host listing budget, via `compute_skill_tiers.ts`).

**Phase 4 (delivery parity):**

> "MCP-path recall may not undercut native-path recall by more than a
> pre-registered epsilon on the same corpus."

**Epsilon, fixed now: 0.05 absolute recall.** A breach *"blocks any MCP
default-on decision; default-off holds until then"*.

## The proxy gap, stated before it can be discovered

Phase 1's checker is a **proxy**: it asks whether a description is
*distinguishable* from its neighbours, not whether a production model *selects*
it. The two can disagree, and no floor in this file closes that gap — only the
live harness does, and the live harness is not PR-affordable.

Recorded here so a green Phase-1 gate is never read as evidence that production
routing works. It is evidence that a description did not get *less*
distinguishable.
