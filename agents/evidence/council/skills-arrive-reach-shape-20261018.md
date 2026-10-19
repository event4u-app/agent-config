<!-- evidence-type: analysis -->

# Three questions on skills that arrive when called: one escalation, two decisions

**Date:** 2026-10-18 · **Members:** `anthropic`, `openai`
**Mode:** prompt, two rounds, peer review · **Cost:** $0.00 (subscription transport)
**Quorum:** 2/2 · **Prompt:** `skills-arrive-reach-shape-20261018.question.md`, beside this file

The lane draining `road-to-skills-that-arrive-when-called` put three questions to
the council with the owner-reserved routing test attached, and asked for DECIDE
or ESCALATE on each.

## Question 1 — step 6.3, the declared-dependency hole: ESCALATE (2/2)

Both seats escalated. Every remedy changes what a consumer is promised: keeping
the 13 declared skills widens "writes the active pack only" (`README.md:59`),
pruning the 28 declaring commands removes behaviour a default install delivers
today, and treating `skills:` and `requires_skills:` differently invents a new
dependency contract. `openai` named the strongest counter-argument and still
escalated: a surviving command whose declared skill is absent is already a broken
internal contract, and restoring it is additive and reversible — but the
evidence cannot say whether "active pack" includes declared dependencies.

The owner question both seats converged on: **may the default projection include
the skills that surviving artefacts declare?** `openai`: if yes, keep both
`skills:` and `requires_skills:` targets, add the zero-hole test and regenerate
the claims; do not prune commands only to hold the count. `anthropic` added a
third option, to wait for the `which-completeness-skills-owe` blocker.

## Question 2 — the reach buckets for steps 2.2 and 2.3: DECIDE (2/2)

The lane proposed five buckets. Both seats rejected it for one reason: it assumed
every uninstalled skill is reachable, so "sums to the authored count" rested on an
environmental invariant instead of reporting its failure. Shipped instead, six
leaves: `described`, `name-only`, `unlisted` (installed), and
`reachable-not-installed`, `degraded`, `unreachable` (not installed, classified by
the best available path), with `installed` printed as a subtotal. Both seats put
it in `doctor` rather than a new subcommand: the source-size ratchet constrains
where the code lives, not where the answer is shown.

## Question 3 — the output-shape criterion for step 3.1: DECIDE, split on detail

Both seats chose a committed data file over a frontmatter key (301 byte budgets)
and over a prose heuristic (not deterministic), with `standing` as the safe
default. They split on whether unclassified skills may carry the default:
`anthropic` accepted a default-standing entry with a provenance label; `openai`
held that step 3.1 asks for every skill to be classified, so every entry must be a
judgement and the runtime default exists only for a name missing from the file.
The lane shipped `openai`'s reading — the stricter one — with conservative
`standing` wherever a skill was not clearly a report.
