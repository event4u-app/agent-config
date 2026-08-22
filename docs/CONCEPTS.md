# Concepts — terms whose meaning here is not the obvious one

> **An index, never a definition.** Every entry points at the artefact that
> owns the term and says only how the local meaning **diverges** from the
> general technical sense. If you find yourself explaining the concept here
> rather than pointing at it, the entry is wrong: a second copy of a definition
> drifts from the first, and the reader who lands on the copy is confidently
> wrong with no way to notice.

**The inclusion rule, and it is the whole control.** A term earns an entry only
when a competent reader arriving with the general technical meaning would be
**wrong here**. A glossary of everything is a glossary nobody reads, and its
review cost grows without bound. Terms that mean what you expect are absent on
purpose.

## tier

`docs/contracts/rule-router.md:67`

Elsewhere a tier is a **severity or quality band**. Here it is an **activation
class** and says nothing about how important a rule is: `kernel` means
always-loaded, `tier-1` and `tier-2` mean trigger-routed on demand. A tier-2
rule is not a lesser rule — it is one that loads when its triggers fire.

The reading to avoid: "tier-2 rules matter less, so a tier-2 violation is
minor." Several tier-2 rules carry Iron Laws.

## projection

`src/rules/source-of-truth.md:46`

Elsewhere a projection is one **view among several**, each legitimate. Here
`src/` is the source and **every** other tree — `dist/agent-src/`, `.augment/`,
`.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`, `GEMINI.md` — is
derived output. "The rule in `.claude/`" is not a variant of the rule; it is a
build artefact, and editing it is editing build output.

The reading to avoid: treating a per-tool tree as a place where a tool-specific
difference legitimately lives. Differences live in the generator.

## delivery — and the reason this entry exists

`docs/contracts/hook-architecture-v1.md:380-386`

**"Delivered" names two different facts and the tree needs both.** A concern can
be *bound* — the manifest carries the key — and still not reach anything: on
`augment` and `cowork` a `pre_tool_use` concern **runs and is then ignored**,
because both trampolines discard dispatcher output and `exit 0` unconditionally.
So "bound on three hosts" and "enforced on three hosts" are different claims, and
the second is false where the first is true.

The reading to avoid: reading a `platforms:` row as a guarantee that the payload
reaches the model or that a denial is honoured. Run `agent-config hooks:status`
for the host you are actually on.

## coverage

`src/scripts/check_gate_coverage.ts:26-29`

Elsewhere coverage measures **how much of a thing was checked**. Here it
measures only that a gate **read something** — its `scanned:` count against a
floor. It is silent on whether the gate can still **fail**, and the file says so
in its own words: *"a gate that stays green over a real planted defect is dead by
definition."*

The reading to avoid: a green coverage report as evidence the gates work. It is
evidence they are not scanning an empty tree, which is a different and much
weaker claim.

## evidence

Two unrelated things share the word, and neither is wrong.

1. **The ADR frontmatter axis** — `docs/contracts/adr-layout.md:164`. A grade
   `E0`–`E4` describing how well-sourced a decision is. `E0` is *opinion*,
   including unanimous council convergence: agreement is not evidence.
2. **The directory** — `agents/evidence/`. Records produced by investigations,
   councils, reviews and measurements. A file living there carries no grade and
   asserts nothing about the ADR axis.

The reading to avoid: "it is in `agents/evidence/`, so it is evidence" in the
graded sense. The two never meet.

## baseline

`src/scripts/_lib/gate_baseline.ts:169`

Elsewhere a baseline is a **starting measurement** you compare against, and it
may move in either direction. Here it is a **shrink-only ceiling**: the number
may walk down and never up, and a value *above* the live measurement is a defect
rather than headroom, because it silently grants the next change a free
regression.

The reading to avoid: raising a baseline to make a gate green. The gate's own
message says it — *"A ratchet only turns one way."*

## Flagged ambiguities

Terms read two ways in this repository's own history. A settled definition can
live at its owning artefact; an **ambiguity has no owner**, which is why it is
recorded here and nowhere else.

### "enforced"

**Reading A** — a mechanism exists that can refuse the action.
**Reading B** — an obligation is written down and a rule states it.

**This repository means A**, and the gap is large enough that several rules
carry an explicit `enforced_by: none` and a paragraph saying which half they
have. A rule that says "never do X" is not enforcement; a guard that returns a
deny code on the one host that honours it is. When a rule claims enforcement,
check whether the claim is about the manifest, the binding, or the deny — see
**delivery** above, which is the same distinction one layer down.

### "the gate passed"

**Reading A** — the gate ran and found no violation.
**Reading B** — the gate ran, could have failed, and found no violation.

**Only B is worth anything**, and coverage alone does not establish it. A gate
whose detection silently stopped matching reports A forever. This is the
distinction the `--canary` / negative-control work exists to close, and until a
gate carries a negative control its greens are Reading A.

### "delivered" (the model-facing half)

**Reading A** — the host was sent the payload.
**Reading B** — the payload reached the model's context.

Measured and not equal: one host published its own budget event stating it had
stripped every description and dropped hundreds of catalogue entries from the
model-visible list. A rule, skill or context that exists in a projection has not
thereby been delivered in sense B, and "I do not see a skill for this" is
evidence about the delivery, never about the tree.

### "later" versus "deferred"

**Reading A** — `agents/roadmaps/later/`, a parked roadmap with a resume
condition, outside the active tree and outside the dashboard.
**Reading B** — a `[~]` checkbox, an item deferred *within* an otherwise active
roadmap, which blocks that roadmap from archiving until it is resolved.

They are different dispositions with different gates. A roadmap can be neither,
either, or both.
