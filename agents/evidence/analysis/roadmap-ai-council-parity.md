<!-- evidence-type: analysis -->
# `/roadmap:ai-council` — the parity table, and what it decided

**Built:** 2026-08-22 · **Source:** `src/domains/product-basic/roadmap/ai-council/command.md` (189 lines), read in full
**Purpose:** Phase 3.1 of `road-to-council-seat-selection` — enumerate every behaviour the wrapper carries and classify each into the closed set `absorbed` / `harvested` / `sunset`, leaving no row unclassified, **before** anything is retired.

## The table

| # | behaviour | source | classification | destination / reason |
|---|---|---|---|---|
| 1 | Resolve a roadmap arg: explicit path, fuzzy match, or list-and-ask | `:34-42` | **harvested** | belongs to a `--rewrite`-style flag's argument handling; it is genuinely just input resolution |
| 2 | Capture the original ask verbatim → `--original-ask` | `:44-47` | **absorbed** | `/council default` already takes `--original-ask` |
| 3 | Pin `--input-mode roadmap` | `:56` | **absorbed** | an existing flag with an existing value |
| 4 | Pin `--depth deep` via `council_depth: deep` frontmatter | `:11`, `:57-59` | **absorbed** | an existing flag; the frontmatter is the host's translation path |
| 5 | Pin the output path to `<roadmap-stem>-roadmap.json` | `:60-62` | **absorbed** | an existing flag with a derived value |
| 6 | Render Convergence/Divergence, and **suppress** `/council default`'s generic numbered-options block | `:71-77` | **harvested** | the suppression is the interesting half — it is a *negative* behaviour, and a flag would have to carry it explicitly |
| 7 | Append a **Council review block** into the roadmap file | `:79-107` | **NOT absorbable** | writes into a roadmap; see below |
| 8 | Apply the **critical-evaluation lens** (5 checks) and attach a verdict to every finding | `:108-122` | **NOT absorbable** | see below |
| 9 | Append a **Host verdict** sub-block into the roadmap | `:123-149` | **NOT absorbable** | writes into a roadmap; see below |
| 10 | Hard floor: may write the response JSON, append to the named roadmap, apply picked patches, regenerate the dashboard; may **not** touch any other file, commit, push, or run git beyond `git diff` | `:150-164` | **NOT absorbable** | a *narrower* permission envelope than the generic command's; see below |
| 11 | One roadmap per invocation | `:167` | **harvested** | a cardinality rule, and cardinality genuinely is a flag |
| 12 | Critical evaluation is mandatory; convergence ≠ correctness | `:168-173` | **NOT absorbable** | the mandatory half; see below |
| 13 | Decline = silence — a skipped patch leaves the review block in place and is not re-asked | `:174-178` | **NOT absorbable** | depends on 7/9 having written something |
| 14 | Cost gate confirmed before every billable run, even under `personal.autonomy: on` | `:179-181` | **absorbed** | the generic council command carries the same floor |
| 15 | No commit; patches land in the working tree only | `:182-184` | **absorbed** | `commit-policy` applies to both |

**Every row classified.** 6 absorbed, 3 harvested, **6 not absorbable**, 0 sunset.

## The finding: this is not a cardinality difference, so 3.2's premise does not reach it

Step 3.2 argues from `ADR-239-drain-command-surface-and-merge-authority.md:66-68` —
*"cardinality is a flag, not a command"*, the ruling that made the estate drain
`/roadmap:process-full --all` rather than a new `process-all` command.

**That ruling is about a command that does the same thing N times.** Rows 7–10,
12 and 13 are not that. They are a **different output contract**: the wrapper
writes *into the roadmap file* and carries a *narrower* permission envelope than
the generic command it wraps.

Two consequences, and they point the same way:

* **Absorbing them makes the generic council command carry roadmap knowledge.**
  `/council default` would need to know what a Council review block is, where a
  Host verdict sub-block goes, and how to append without overwriting — roadmap
  concepts, in a command that is not about roadmaps.
* **Row 10 is the sharper one.** The wrapper's hard floor is *narrower* than the
  generic command's. A flag cannot narrow a permission envelope in a way a
  reviewer can trust: `/council default --rewrite` would read as the generic
  command's permissions **plus** a flag, and the restriction would live in prose
  a caller can pass the flag without reading. That is the opposite direction from
  every safety floor in this tree.

## Decision: 3.2 and 3.3 are NOT taken

**The table is the deliverable, and it argues against the retirement it was
required to precede.** Step 3.3 gates removal on the table leaving no row
unclassified — none is — but a gate passing is not a reason to proceed when the
content of what it gated says otherwise. Six behaviours have no destination that
preserves them.

Recorded as a **decision, not an omission**: the wrapper stays, and 3.2/3.3 close
as `[-]` with this artefact cited at each. What would change the answer is a
mechanism that lets a flag *narrow* a command's permission envelope verifiably —
at which point rows 7–10, 12 and 13 become re-classifiable and the question is
worth reopening.

**Row 6 is worth flagging to whoever reopens it.** The wrapper *suppresses* the
generic command's numbered-options block. A negative behaviour is the easiest
kind to lose in an absorption, because nothing fails when it goes missing — the
generic block simply reappears, and the roadmap refactor flow that replaces it
gets a competing options block beside it.

## What this table is not

It is not a claim that the wrapper is well-factored. Rows 2–5 and 14–15 are pure
duplication of the generic command, and a future consolidation that moved only
those would be a real simplification. It is a claim that **removing the file**
loses six behaviours, which is the specific question 3.1 was required to answer
before 3.3 could run.
