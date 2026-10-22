# Roadmap-Process Loop — Branches (close)

Branch-only body of [`roadmap-process-loop`](roadmap-process-loop.md), moved
out verbatim so the core stays a single read. Each section below is loaded
from the pointer line the core carries at the moved section's place, and only
when a run reaches that branch; the Iron-Law fences stay in the core.

### Terminal outcomes — `complete`, or a genuine external impossibility

The halt list above answers *"what interrupts runnable work"*. This answers
*"what does the run report when the roadmap is not finished and the remaining
work is not the agent's to do"* — and under
ADR-237 (agent-config repository: `docs/decisions/ADR-237-end-to-end-execution-authority.md`) that
second set is much smaller than it looks.

**The measurement that motivated the old answer, and the reading that replaced
it.** Measured 2026-08-19 across the twelve most nearly complete roadmaps:
**zero** could reach `count_open == 0` in one PR, because every remaining step
needed "a human action" — flip branch protection, authorise paid spend, install a
binary, wait out a soak window, edit a file a hook denies. The census was sound.
The reading was not: it counted actions a human *conventionally* performs,
without asking per action whether a human was **necessary**. Flipping a branch
setting, pushing, opening a PR, re-running CI, updating a merge base, fixing a
test, spending inside a budget — the agent can do all of it. That is remediation
work, and a `process-full` invocation grants it.

Four outcomes, and only one of them is success:

| Outcome | When | What it reports |
|---|---|---|
| `complete` | `count_open == 0` and the PR is open | the roadmap is finished; archival check runs (§ 6) |
| `blocked` | every remaining open step is **externally impossible** for the agent | the work that DID close, plus the specific impossibility |
| `superseded` | the remaining work **already landed** on `origin/main`, in a merged PR | which steps the tree already satisfies, with the PR number and the evidence per step |
| a halt | one of the five conditions above fired | the halt, its evidence, and what remains |

**Why `superseded` is here and not on the halt list.** A run that meets a merged
PR which already closed its remaining steps had, until this row existed, no legal
move: *"let the open PRs merge first"* is a forbidden non-halt reason below, the
halt list calls itself exhaustive, and neither `complete` nor `blocked` is true —
the work is done and it was not externally impossible. The only two available
actions were a rule violation or duplicate work. This row is the third.

It is a **report**, not a licence to flip anything. Marking a step the tree
already closed is a separate, deliberately unbuilt mechanism: it needs the step's
own `verify:` green against `origin/main`, a decision memo, and a one-strike kill
criterion, and an autonomous run writing a completion marker into the source of
truth is not switched on unasked. Until it is, `superseded` reports and the boxes
stay open — the same discipline the `[~]` prohibition below enforces for
`blocked`.

`blocked-preflight` **no longer exists** (ADR-237 § 4). A run always starts.

**Externally impossible — the whole list**, aligned with ADR-268 § 7. A missing
**owner-owned** decision — `product-owned`, `business-owned` or
`destructive-owned`, and nothing else · a missing permission, secret or access ·
a required credential that does not exist and the agent cannot create · a
purchase beyond the delegated budget · physical hardware access · another person
or organisation must act · a wait that is factually mandatory and cannot be
simulated or verified · contradictory requirements · technical impossibility
under the stated constraints · a needed crossing of a real authority boundary.

**Not externally impossible — every one of these is work.** An unprotected
branch · a branch to create · a push · a PR to open · a repository or branch
setting the agent can change · a workflow to start · CI to re-run · a merge base
to update · conflicts · failing tests · local configuration · a paid call under
the ceiling · a failed first approach · dependency trouble · "this could be
risky" · "a maintainer should do this".

`blocked-by:` stays — it is how the withdrawn `run-continuation` read
blockedness, and what `lint_roadmap_blockers` still validates — but a
blocker entry is the record of a decision the agent **correctly did not own**;
what it may point at narrows accordingly
([`decision-closure-execution`](decision-closure-execution.md)).

The `[~]` prohibition is load-bearing and was the one point the council split on.
Deferring a blocked step to `[~]` would let the run reach `count_open == 0` and
report completion — laundering unfinished work through a glyph, which is exactly
what Iron Law 3 of [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md)
exists to catch on the archival side. So the boxes stay open and the outcome
carries the truth instead. **ADR-237 keeps this clause verbatim** — narrowing
`blocked` makes it more important, not less, because a run with more authority
has more ways to reach a clean-looking count.

Revalidation is the second half of the same discipline: the set is recomputed at
the moment of reporting, because steps unblock during a run (a prerequisite
closes, a `Run:` succeeds, a peer merges, a setting the run itself changed). If
any remaining step is one the agent could execute, `blocked` is refused and the
loop continues.

### Non-halt — gating notes, "optional" tags

The following are **authoring annotations**, never halt conditions. Do
**not** stop execution when the roadmap text contains them:

- `(deferred)` / `(later)` / `(optional)` tags on a step
- "Gate: Phase 1 ships and …" prose inside a later phase

`process-step` and `process-phase` honor scope by stopping at their
configured boundary anyway. `process-full` processes every open step
regardless of these annotations — see
[`/roadmap:process-full § Iron Law`](../../commands/roadmap/process-full.md#iron-law--full-is-full).
Time-boxed plate / horizon framing is opt-in via
`roadmap.horizon_weeks` in `.agent-settings.yml` (default `0` =
forbidden, per template rule 16). When `0` and encountered in legacy
text, treat as ordinary prose; never use it to gate execution. When
`> 0`, plate framing is allowed in authoring but is still **not** a
halt condition — phase ordering and explicit dependency gates govern
execution either way.

## 6. Final report and archival

- **End state under an accepted execution contract** (per-mode table:
  [`roadmap-execution-contract § 4`](roadmap-execution-contract.md)):
  all steps `[x]` · quality green per cadence · work committed in
  chunks on the run's feature branch · pushed to that branch · ONE PR
  open (description-only flow) · archival sweep run. **No mode merges by
  itself:** a merge needs the owner's explicit auto-merge instruction and
  runs through `/pr:merge` § 9a's danger gate (ADR-282). Without a contract
  (interactive mode), the run ends after the archival check with no
  git delivery beyond explicitly authorized commit steps.
- **Sampled depth audit.** For every step whose receipt reads `active` (a
  lowered depth), `probe_depth_shadow.ts --audit-sample
  <roadmap.md#step> --class R0|R1` decides whether it gets a full round-1
  completion review after merge. If sampled, run that review and append one row to
  `src/config/depth-audit-samples.json`: `escaped` when it found a high or
  critical row the lowered depth skipped. `step_receipt` reads that file and
  returns a class past the threshold to full depth; `probe_depth_shadow
  --flip-readiness` names it for the owner report.

### 6-refusals. Host-classifier refusals — hand off, never route around

When the host's own classifier refuses a step of an owner-directed task, the
run never reaches the same outcome by another tool, in smaller pieces or in
another encoding, and never records a way around it. It finishes what does not
depend on the refused step, then — owner present — asks once in-session for an
explicit authorization of that exact step and, on a yes, re-runs the SAME step
ONCE so the classifier decides again with the owner's word in front of it
(ADR-282 § Part B). Refused again, or no owner present, it writes ONE
continuation prompt for the owner and names its path in one line:

```bash
refusal_envelope.ts --input <envelope.json>
```

The input is task · done · refusals · remaining · the owner-directive record
when there is one; the envelope lands at `agents/tmp/round-<hex>/prompt.md`.
Lane refusals arrive in each lane's `classifier_refusals` field and go into the
same single envelope (ADR-282 § Part B).

### 6a. Deferred-resolution gate — Iron Law 3

**Default: the sweep resolves it.** `archive_completed_roadmaps --all` carries
every bare `[~]` step, plus every open blocker such a step names, into a
`<slug>-carried` follow-up created in the same change (`deferral_carry.ts`),
annotates the parent `carried-to=<slug>`, and archives — the "carry item +
blocker" council row below, executed deterministically, so a finished
`/roadmap:process-full` run ends archived instead of parked at 100 %. The
manual flow below applies only to what the sweep refuses: an open blocker no
deferred step names, a hand-written annotation that fails validation, or a run
with `--no-carry`.

**Owner-dependent blockers stop the carry.** When a carried step names a blocker
whose `Owner:` is the human (`maintainer` / `user` / `owner`, or any value that is
not `implementer` / `council` / `agent` / `ai`), the sweep writes nothing and
prints a `❓` block plus one `OWNER-DECISION {json}` line. Put that decision to
the owner as ONE numbered-options question, never resolve it yourself:

1. **Archive it** — run the printed `archive_command` (`… --owner-decision later --only <roadmap>`):
   the parent archives, the steps and their blockers park in
   `later/<slug>-carried.md`.
2. **Step by step** — show the FIRST step (`first_step`, verbatim) with its
   blocker's question, in the same message, so the owner can answer it or push
   it to later in one reply. An answer → do the step, flip it, show the next
   one. "Later" → leave that step `[~]` and show the next one. When no step is
   left to show, run that `archive_command`: what is still
   deferred parks, the parent archives.

A **subagent** never answers this and never passes `--owner-decision` itself: it
stops and returns the `OWNER-DECISION` line verbatim, and the orchestrator puts
it to the owner. A non-interactive run ends on the question, not on a report.

Before any `git mv` to `archive/` the sweep refused, count `[~]` items in the
closing roadmap. If `count_deferred > 0`, archival is **blocked** per
[`roadmap-progress-sync § Iron Law 3`](../../rules/roadmap-progress-sync.md).
The loop MUST:

1. Enumerate every `[~]` step (phase + text + optional
   `<!-- deferred: ... -->` annotation).
2. Surface the numbered-options block from
   [`roadmap-management § 4b`](../../skills/roadmap-management/SKILL.md) —
   five choices: follow-up (draft), follow-up (ready + blocked),
   keep-in-archive (intentional drop), restore to `[ ]`, convert
   to `[-]` cancelled.
3. **Route by the preservation test**, per
   [`roadmap-progress-sync § Who resolves it`](../../rules/roadmap-progress-sync.md):
   a disposition that keeps the criterion ALIVE in the active estate
   (fix now · carry item + blocker into a follow-up created in the SAME
   change · merge into existing active work · restore to `[ ]`) may be
   resolved by the council, recorded at the item. A disposition that
   drops, weakens or permanently accepts the loss of it — cancel to
   `[-]`, keep-in-archive, scope cut — reaches the **user**, and the
   autonomous mandate (`/work`, `/roadmap:process-full`, "decide for
   me") does **not** lift that half. In doubt: user. A council verdict
   naming a follow-up that does not exist yet fails closed to the user.
4. On picks 1 / 2 → run the "Spawn follow-up from deferred items"
   procedure in [`roadmap-management`](../../skills/roadmap-management/SKILL.md).
   On picks 3 / 4 / 5 → apply the change, re-evaluate the decision
   table, archive when the gate clears.

`count_deferred == 0` → archive. **Primary path:** run the
`archive_completed_roadmaps --all` sweep — it is untracked-safe (`git mv`,
or a plain `mv` in a pre-first-commit / untracked consumer), rewrites inbound
refs (on the index when tracked, on the filesystem when not), and regenerates
the dashboard. This entry point is **PR-independent** (gap B): it does not need
`/create-pr` to have run. **Fallback only when that script is not vendored** in
the consumer: emit a one-line instruction to vendor it (run `agents:init`),
then apply the manual procedure in
[`roadmap-management`](../../skills/roadmap-management/SKILL.md) (mkdir
`archive/`, `mv`, inbound-ref rewrite, dashboard regen). NEVER silently
delegate to a bare `git mv` that fails on untracked files and leaves a
completed roadmap rotting in the active tree.

## Scope deltas — what each wrapper binds

| Wrapper | Working set | Stop after | Execution contract (§ 3) |
|---|---|---|---|
| `process-step` | Single first open step | One iteration of § 5 | Never — mode ignored |
| `process-phase` | All open steps in first phase with `count_open > 0` | Phase boundary; per-phase quality if cadence ≠ `end_of_roadmap` | When `execution.mode: autonomous \| phase-checkpoints` |
| `process-full` | Every open step across every phase, in order | Roadmap fully closed (or halt) | When `execution.mode: autonomous \| phase-checkpoints` |

`process-full` runs the per-phase quality pipeline at every phase
boundary when cadence is `per_phase` or `per_step`; on red it halts
before the next phase. Phase-internal `(deferred)` / `(optional)` /
"gated on Phase N" annotations do not stop the run — those are
authoring notes, not halt conditions.
