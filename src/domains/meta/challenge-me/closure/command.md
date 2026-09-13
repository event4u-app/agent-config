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

If anything genuinely owner-owned remains, ask it **now**, one question per
turn, using the host's own ask primitive where one exists (see
`user-interaction`), and write the answer into `## Decisions` before the next
question. Never hand back *"the four open questions are in file X"* — a filed
question is an unclosed one wearing a record's clothes.

## Bypass

An explicit *just write it* / *skip closure* / *einfach machen* drops this pass
entirely. The bypass is **recorded** as a bypass — it is its own axis in the ask
census, not an absent closure — and it is never inferred from a mission grant,
an autonomy setting or momentum. Only the owner's words this turn are a bypass.

## Fixtures

`tests/fixtures/decision-closure/F1-technical-ambiguities.md` seeds twelve
technical ambiguities: a correct pass finds twelve and asks the owner none.
`F0-closed-plan.md` is the other direction — a plan already closed, on which a
detector that fires on ordinary prose would produce findings. Both are
required; neither alone is evidence.

## See also

- [`/challenge-me`](../command.md) — the cluster head.
- [`/challenge-me vision`](../vision/command.md) — the interview loop this reuses.
- `docs/contracts/ai-council-config.md` § Decision resolution by ownership — the eight classes and their Iron Laws.
