---
model_tier: medium
name: challenge-me-closure
pack: product-reasoning
visibility: internal
cluster: challenge-me
sub: closure
description: "Close every foreseeable decision in a roadmap before execution — detect the open ones, resolve each at the lowest rung that owns it, and write the answers into a `## Decisions` table."
argument-hint: "<roadmap-path>"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - product-reasoning
---

# /challenge-me closure

> Take a roadmap that is about to enter execution and make it an **execution
> contract**: every foreseeable decision closed, the closing done council-first,
> the owner reached only for product, business, taste or destructive residue.

```
A QUESTION PLANNING COULD HAVE CLOSED AND EXECUTION MEETS INSTEAD IS A DEFECT.
RESOLVE AT THE LOWEST RUNG THAT OWNS THE DECISION. THE OWNER IS THE LAST RUNG,
NEVER THE FIRST, AND NEVER REACHED FOR A TECHNICAL DECISION AT ALL.
NEVER ASK ABOUT PR TOPOLOGY. NEVER RAISE MERGE UNLESS THE OWNER RAISED IT.
EVERY ANSWER IS WRITTEN INTO `## Decisions` BEFORE THE RUN STARTS.
```

Input is a roadmap path. Output is the same file with a `## Decisions` table
and, where residue was genuinely owner-owned, at most one host-native ask per
turn whose answer is recorded immediately.

## Step 1 — Detect

Run the deterministic detector. It finds and classifies; it resolves nothing.

```bash
./scripts-run src/scripts/closure_scan <roadmap-path>
```

It reports one row per open decision: an id, a line, a detector kind, and the
**ownership class** that kind maps to. The families are `tbd`,
`unpicked-alternative`, `unchecked-assumption`, `missing-verify`,
`ambiguous-acceptance`, `contradictory`, `product-semantics`, `typed-op` and
`spend`.

Then add what a scanner cannot see, reading the file yourself:

- the prose checks `lint_roadmap_complexity` already runs — vague steps, human
  gates in steps, headings or exit criteria, external-population gates;
- an **unresolved typed-op need**: work that cannot finish without an operation
  from the typed vocabulary for which no grant exists;
- a **product semantics** fork the scanner's phrasing missed — two valid
  user-visible outcomes with no source of truth to pick between them.

`--rows` prints the `## Decisions` skeleton; `--json` is the machine form.

## Step 2 — Resolve, in this order, stopping at the first rung that can

For each detected decision, in order, and never skipping a rung upward:

1. **Evidence** — the tree answers it. Read the file, run the probe, check the
   schema. A decision the code already made is not a decision.
2. **Convention, ADR or contract** — a recorded rule answers it. Cite the ADR
   number or the contract path.
3. **The agent** — reversible and inside the stated convention
   (`deterministic`, `reversible-technical`). Pick, and say why.
4. **An independent session** — a second instance with no stake in the first
   answer. This is the first rung for `contested-technical`.
5. **The council** — `agent-config council:status` decides availability, never
   the project tree. `critical-technical` targets a **provider-diverse**
   council; with one provider configured the class degrades to owner-confirm of
   the agent's proposal rather than one model reviewing itself.
6. **The team** — where a council is unavailable and `ai_team` is configured.
7. **The owner** — **only** for `product-owned`, `business-owned` and
   `destructive-owned`. A technical decision never reaches here, however hard
   it is.

`spend-exhaustion` leaves the ladder entirely: it **pauses and reports** — what
needed the council, why the CLI rung was unavailable, the estimated spend, the
mission state, and what can still proceed.

## Step 3 — What is never asked

- **PR topology.** Stacked, split, one branch or five is the agent's call.
- **Merge intent**, unless the owner already discussed merge for this work. A
  merge grant is a typed op the owner grants; it is not a question closure
  invents.
- **A count.** "Three attempts failed, continue?" is a strategy change, never a
  question.
- **A continuation.** "Shall I go on?" after a clean batch is not a decision.

## Step 4 — Write the answers down

Append or update a `## Decisions` section with one row per decision:

```
| ID | ownership | resolved by | decision | evidence | revisit if |
```

`ownership` is one of the eight ownership classes. `resolved by` is one of
`evidence`, `agent`, `independent:<session or model>`, `council:<record>`,
`team:<record>`, `owner`. `revisit if` names the condition that reopens it — a
closed decision is re-asked only when that condition became true.

`lint_decision_classes` enforces both vocabularies. Run it before handing back:

```bash
./scripts-run src/scripts/lint_decision_classes
```

## Step 5 — Residue is asked now, never filed

```
OWNER-OWNED RESIDUE IS ASKED THIS TURN. ONE QUESTION PER TURN.
THE ANSWER IS WRITTEN INTO `## Decisions` BEFORE THE NEXT QUESTION IS PUT.
NEVER HAND BACK "THE FOUR OPEN QUESTIONS ARE IN FILE X" — A FILED QUESTION IS
AN UNCLOSED ONE WEARING A RECORD'S CLOTHES, AND THE FILE IS WHERE IT DIES.
NEVER HAND BACK A COUNT — "3 QUESTIONS OUTSTANDING" IS A NUMBER RENDERED WHERE
A DECISION BELONGS.
```

Ask using the host's own primitive where one exists — `agent-config
hooks:status` prints the shape, and the numbered text block is the named
fallback (see `user-interaction`). Each option carries what changes by
answering it, and the recommendation has exactly one source.

Two mechanical consequences, both already enforced:

- `ask_block_census` classifies a question written into a section instead of
  asked as `file-parked`, and a count rendered where a question belongs as
  `count-only`. Both are their own axes; neither is an ask.
- `lint_decision_classes` reds a `ready` roadmap carrying an unresolved marker
  outside `## Decisions`. A question that exists only as prose in the plan is
  exactly that marker, so the prose form cannot survive to `ready`.

**Where the residue genuinely cannot be asked** — the run is non-interactive,
or the answer needs something the owner has not got yet — the step is parked
and independent phases continue (§ 4 of the process loop), and the plan records
a structured `## Blockers` entry naming one of the three owner-owned classes.
That is the one legal file-shaped home, and it is legal because a five-field
blocker is decidable: recommendation, cost of the non-decision, what to do, and
what resolves it. A bare sentence in `## Notes` is none of those.

## Bypass

An explicit *just write it* / *skip closure* / *einfach machen* drops this pass
entirely. The bypass is **recorded** as a bypass — it is its own axis in the ask
census, not an absent closure — and it is never inferred from a mission grant,
an autonomy setting or momentum. Only the owner's words this turn are a bypass.

## Fixtures

Under `tests/fixtures/decision-closure/`:

| Fixture | What it must produce |
|---|---|
| `F1-technical-ambiguities.md` | twelve findings, **zero** owner questions |
| `F2-product-semantics.md` | **exactly one** owner question, `product-owned` |
| `F0-closed-plan.md` | nothing — a plan already closed |
| `R1-ready-unresolved.md` / `R2-ready-resolved.md` | red, then green on the same plan once the marker is recorded |
| `F3a-conclusive-technical.md` / `F3b-non-convergent-product.md` | no options block, then a proposal |

Each pair is required and neither half alone is evidence: a detector weakened
until it finds nothing passes F0 and fails F1, and one that fires on ordinary
prose does the reverse. F1 against F2 is the ownership discrimination — twelve
technical ambiguities cost the owner nothing, one product fork costs exactly
one question.

## See also

- [`/challenge-me`](../command.md) — the cluster head.
- [`/challenge-me vision`](../vision/command.md) — the interview loop this reuses.
- `docs/contracts/ai-council-config.md` § Decision resolution by ownership — the eight classes and their Iron Laws.
