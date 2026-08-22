<!-- evidence-type: analysis -->
# The three un-bucketed prose corpora — what each one actually costs

**Measured:** 2026-08-22 · **Tree:** `origin/main` at the time of writing
**Basis:** chars/4, the basis `src/config/preamble-payload-budget.json` declares for itself

`preamble-payload-budget.json` gates three buckets. Three larger prose corpora carried
**no** bucket — not gated, not excluded, simply absent from the accounting. A number
with no bucket is not "unbudgeted", it is **unclassified**: nobody had recorded whether
it is standing cost, on-demand cost, or zero. This note records all three, and two of
the three answers are nulls.

| Corpus | Files | ≈ tok (chars/4) | Load semantic | Recorded as |
|---|---|---|---|---|
| Personas (`src/agent-src/personas`) | 36 | ~37,181 | **zero** — nothing reads the projection | `excluded_buckets` |
| Contexts (`src/agent-src/contexts`) | 58 | ~114,042 | **on-demand** — 0 rules declare eager | `excluded_buckets` |
| Skill bodies (`src/skills/*/SKILL.md`) | 290 | ~595,843 | **on-demand** — only the description is standing | `excluded_buckets` |

## 1. Personas — zero, and the reference set is FIVE not four

`.claude/personas/` is written by this repository's generators and read by **no host
contract**. The in-repo references, re-enumerated here because the count was wrong in
the roadmap that commissioned this note:

* `src/scripts/condense.ts`
* `src/scripts/check_generator_output_coverage.ts`
* `src/scripts/check_bridge_derivation.ts`
* `src/scripts/_lib/tool_adapter_registry.ts`
* `src/scripts/inventory_abstraction_budget.ts` ← **the fifth, previously unlisted**

Five, not four. The correction matters less for the count than for what it says about
the method: an enumeration quoted from a previous pass is a claim, and this one had
drifted. Re-run rather than re-quoted:
`grep -rln "\.claude/personas" src/scripts/`.

**The host's actual subagent surface is `.claude/agents/`, and it is NOT empty.** The
roadmap recorded 0 files there. Measured now: **1** — `production-validator.md`, and it
is live, appearing in the host's own available-agent list. So the persona null is not
"the host reads no agent directory"; it is the narrower and more useful statement that
the host reads `.claude/agents/`, which this package writes **one** file into, and does
not read `.claude/personas/`, which this package writes **29** files into (project
scope) plus 32 at user scope.

**Reversal condition.** Either a host publishes a contract that reads a personas
directory, or one of this package's generators starts folding persona prose into an
instruction file that IS read (an `AGENTS.md`, a `CLAUDE.md`, a rule projection). Until
one of those happens, ~37,181 tok of persona prose is worth exactly zero standing
tokens, and proposing it as a token lever is proposing to optimise a file nobody loads.

## 2. Contexts — on-demand, by declaration AND by absence

Two inputs, named separately because they are not the same kind of evidence:

* **Declaration.** `src/scripts/schemas/rule.schema.json:49` documents
  `load_context_eager:` as *"Counts against the per-rule char budget"* — i.e. the schema
  itself says the eager variant is the one that costs standing context.
* **Absence, measured.** `grep -rln "^load_context_eager:" src/rules/ | wc -l` → **0**.
  The lazy `load_context:` → **17**.

The roadmap said 17 was 21. It is 17 here; re-measured, not carried over.

So no rule in the tree asks for a context eagerly, and the ~114,042 tok of context prose
reaches a session only when a rule's body routes to it. **What this does not establish:**
that the host would honour an eager declaration cheaply if one appeared. Nobody has
declared one, so nobody has measured it. The finding is "no eager declaration exists",
not "eager loading is free".

## 3. Skill bodies — on-demand, and the catalog figure proves it arithmetically

The reconciliation the roadmap asked for. `censusSkillsCatalog`
(`src/scripts/preamble_byte_census.ts:216-234`) builds the catalog bucket as
`- ${name}: ${description}\n` per skill — **frontmatter only, no body byte**. That is why
290 skills whose bodies total ~595,843 tok report as **14,408** tok of standing cost: the
bucket is the descriptions and nothing else.

First-hand delivery observation, which is the strongest input available for this
question: the session writing this note received skill **names and descriptions** in its
own available-skills listing, and **no body**. A body arrives when the skill is invoked.

**The corollary is the reason this matters for Phase 2.** If only the description is
standing, then the description cap is not *a fragment of* the skill-side lever — it is
the **whole** of it. There is no larger skill-side saving waiting behind it.

## 4. Why all three are exclusions rather than buckets

A census bucket over a corpus measured at zero is a permanently green gate certifying
nothing — this tree has shipped that before. The three go to `excluded_buckets` with
their measurement attached, the way `user-scope rules` already sits there with its
reason, so that the next pass that proposes one of them as a lever meets the number
instead of the silence.

## Pre-existing red found while measuring, not caused here

`check_augment_description_cap` reports **4 auto-RULE descriptions over its 150-char
cap** — `code-provenance` (187), `brand-source-of-truth` (169), `recurring-criticism`
(166) and `fix-what-you-see` (161). Verified pre-existing by stashing this branch's changes and
re-running: identical output. It is a different surface from the skill descriptions this
roadmap touches (rules, and the Augment workspace-guidelines budget), and it is recorded
here rather than fixed so it is not lost.
