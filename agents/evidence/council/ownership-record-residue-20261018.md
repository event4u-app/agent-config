<!-- evidence-type: analysis -->

# The two open steps of the ownership-record roadmap: one decided, one split

**Date:** 2026-10-18 · **Members:** `anthropic`, `openai`
**Mode:** prompt, 2 rounds, peer review · **Cost:** $0.00 (subscription transport)
**Quorum:** 2/2 concluded · **Question:** `ownership-record-residue-20261018.question.md` (beside this file)

Steps 3.3 and 3.4 of `road-to-an-ownership-record-that-belongs-to-the-user` had
been left open by two drains, each time labelled owner-reserved by the drain
itself. This round put both to the council with the owner-reserved table from
`decision-revisit-gate` pasted verbatim and a `DECIDE` / `ESCALATE` opening
required, so the routing was classified by the seats rather than by the agent.

## Item B — step 3.4, `adopt` / `reset` as flags: DECIDE (b), convergent

| Seat | Opening | Pick | Reason in one line |
|---|---|---|---|
| `anthropic` | DECIDE (b); ESCALATE for (a) | (b) | agent-chosen semantics with no spec cannot be bounded; `adopt`'s likely meaning was already declined by an earlier round |
| `openai` | DECIDE (b) | (b) | only the routing is specified; implementing the behaviour would invent policy |

**Verdict:** close 3.4 as satisfied by its verify line plus the routing
decision (if they ship, they ship as flags), and move the unspecified behaviour
to a separate stub. Option (a) — implementing with agent-chosen semantics — is
owner-reserved under "cannot be bounded from available evidence"; both seats
agree on that row (they differ on whether "governance self-amendment" also
applies, which does not change the routing).

**revisit-if:** approved semantics and acceptance tests make either flag
bounded and implementation-ready.

## Item A — step 3.3, the `$HOME`-leak gap: SPLIT, escalates to the owner

| Seat | Opening | Pick |
|---|---|---|
| `anthropic` | DECIDE (b) | stop writing global-scope entries into a consumer's project lock |
| `openai` | ESCALATE — public / compatibility commitment | (b), with owner approval |

Both seats recommend **(b)**; they split on the venue. A split is an escalation
condition under `decision-revisit-gate`, so the transition goes to the owner
with (b) as the joint recommendation. Neither seat picked (a) — adding the lock
to the consumer gitignore block — because it contradicts the tracked-durable
contract outright.

**The reader audit both seats asked for, done after the round (evidence, not a
withdrawal of the escalation):**

- `src/scripts/_cli/cmd_sync.ts:166-182, :343-355` — `sync` reads **global**
  entries from the project lock and replays a `--scope=global` install for any
  whose `bridge_marker` (with `~` expanded) is missing. This is the
  "new team member runs `sync` after cloning" workflow `README.md:357` promises.
  The user-scoped ledger cannot serve it: a new team member has no ledger yet.
  That meets `anthropic`'s own `revisit-if` ("a reader cannot maintain required
  functionality from the ledger alone") and supports `openai`'s escalation.
- `src/scripts/_cli/cmd_prune.ts:240, :311` and `cmd_doctor.ts` read
  project-scope entries only; dropping global entries does not affect them.
- What `sync` needs from a global entry is `name`, `scope` and `bridge_marker`.
  It does not read the per-entry `files[]`, which is where the absolute
  `$HOME`-rooted paths live.

So the owner's question is sharper than either seat could see: **(b) as stated
removes a `sync` capability; a narrower (b′) — keep global entries but stop
recording their absolute `files[]` in the project lock, since the ledger now
holds global ownership — closes the `$HOME` leak and keeps `sync` working.**
Both change what consumers commit, which is why it stays the owner's.

**revisit-if:** the owner picks a variant, or `sync` stops replaying global
entries for another reason.
