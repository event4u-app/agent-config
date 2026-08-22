# Autonomy Mechanics — Settings and Platform Behavior

Loaded by the [`autonomous-execution`](../../rules/autonomous-execution.md)
rule when settings semantics or platform-specific defaults are
relevant. Detection logic lives in [`autonomy-detection.md`](autonomy-detection.md).

## `personal.autonomy` setting

| Value | Behavior |
|---|---|
| `on` | Suppress trivial questions. Act on the obvious next step. **Never ask "weiter? / shall I continue? / soll ich fortfahren?" between clean batches** — a continuation prompt under `on` is a cheap question, forbidden by [`no-cheap-questions` Iron Law 4](../../rules/no-cheap-questions.md); the persistent setting alone arms that law (see [`cheap-question-mechanics § Iron Law 4`](cheap-question-mechanics.md#iron-law-4--halt-conditions-under-autonomous-mandate)). Still ask on blocking / critical decisions, and ALWAYS ask on Hard-Floor triggers. |
| `off` | Ask trivial questions too. Use this if you want the agent to check in on each workflow step. |
| `auto` (default) | Same as `off` by default. Flips to `on` for the rest of the conversation as soon as the user expresses the intent "stop asking, just work". See [detection logic](autonomy-detection.md) — match by **intent**, not exact string. The flip never lifts the Hard Floor. |

The value is read once on the first turn (per
[`layered-settings`](../../../docs/guidelines/agent-infra/layered-settings.md#section-aware-merge-rules))
and cached. Missing key → treat as `auto` (fail-closed — same behavior
as the shipped template default; absence of a key never grants the most
permissive mode). The one exception is the explicit cloud carve-out
below, where the whole settings file is absent by construction.

## Cloud platforms — settings degrade to `on`

Setting reads degrade gracefully on cloud platforms (no
`.agent-settings.yml` available). Treat as `personal.autonomy: on` —
the user had to deliberately ship a custom skill bundle to a cloud
agent and is unlikely to want trivial-question friction.

The Hard Floor still applies on every surface, including cloud. There
is no "cloud override" for production-branch merges, deploys, pushes,
prod data/infra, or whimsical bulk deletions — see
[`non-destructive-by-default`](../../rules/non-destructive-by-default.md#cloud-behavior).

## Blocking — STILL ASK regardless of `personal.autonomy`

Beyond the Hard Floor, the autonomy setting also never overrides:

- **Vague-request triggers** in
  [`ask-when-uncertain`](../../rules/ask-when-uncertain.md) —
  ambiguous requirements stay ambiguous; pick-one-and-pray is wrong.
- **Architectural / structural choices** the codebase doesn't already
  settle (multi-stack picks, library introductions).
- **Security-sensitive paths** — see
  [`security-sensitive-stop`](../../rules/security-sensitive-stop.md).
- **Scope expansion** beyond the stated task — see
  [`scope-control`](../../rules/scope-control.md).
- **Remote-state operations** — push, merge, rebase, force-push,
  branch create/delete/switch, PR create/close/retarget, tag/release.
  Permission-gated by
  [`scope-control`](../../rules/scope-control.md); the prod-trunk
  and deploy-tied subset is governed by
  [`non-destructive-by-default`](../../rules/non-destructive-by-default.md).
- **Destructive ops** — see
  [`non-destructive-by-default`](../../rules/non-destructive-by-default.md)
  for the full taxonomy (whimsical bulk deletions, content
  destruction, commits containing bulk deletions or infra changes).

In doubt whether something is trivial or blocking → it is blocking.
Ask.

## Commit policy summary

Committing is governed by the canonical
[`commit-policy`](../../rules/commit-policy.md) rule, which applies
regardless of `personal.autonomy`:

- NEVER commit unless user said so this turn, a commit command was
  invoked, a standing instruction is active, or the roadmap
  authorizes it.
- NEVER ask about committing. The user invokes a command or says so.
- In autonomous mode, the **only** permitted commit-related question
  is the one-shot pre-scan ask at the start of roadmap execution.

Push, merge, rebase, branch creation, PR operations, and tags
remain permission-gated by
[`scope-control § git-operations`](../../rules/scope-control.md#git-operations--permission-gated).

## Opt-in detection — rule-level summary

(Migrated from the [`autonomous-execution`](../../rules/autonomous-execution.md)
rule per P4 of `road-to-kernel-and-router.md`; the detection algorithm itself
lives in [`autonomy-detection.md`](autonomy-detection.md) — that file is the
stronger, operative source.)

In `auto` mode, flip to `on` for the rest of the conversation when the user expresses **"stop asking on trivial steps, just work"**. Recognize **intent**, not the literal substring. Opt-out (same intent, reversed) flips back to `off`. Both directions are **speech-act-checked**: the phrase must be a meta-instruction to the agent, not content / quote / subject / code / third-party reference / hypothetical. In doubt → keep current mode, no speculative flips.

Algorithm and speech-act heuristic: [`autonomy-detection.md`](autonomy-detection.md). Anchor phrases (DE+EN), no-flip patterns, counter-examples, trivial-vs-blocking taxonomy, commit-policy summary, and named failure modes: this file + [`autonomy-examples.md`](autonomy-examples.md).

## Task-scope — three autonomy shapes

Depth for the rule's task-scope Iron Law (`NEW TASK → FRESH CONFIRMATION`).
Three distinct autonomy shapes — keep them apart:

| Shape | Trigger | Scope |
|---|---|---|
| **Conversation-wide trivial-question suppression** | "stop asking on trivial steps, just work" — no deliverable named. | Sticky for the rest of the conversation. Suppresses trivial workflow questions only; never lifts blocking, Hard Floor, or [`scope-control`](../../rules/scope-control.md) gates. |
| **Task-scoped autonomous execution** | "work autonomously on X", "arbeite die Roadmap Y komplett ab", "do PROJ-123 end-to-end" — a deliverable / artifact / ticket is named. | Bound to **that** task. Ends when the task ends. Does **not** authorize starting a new, distinct task autonomously. |
| **Set-scoped autonomous execution** | An accepted execution contract whose pre-scan **enumerated** a closed, ordered set of deliverables — the set members are named on the contract screen before the single Accept. | Bound to **that enumerated set**. The loop may move from one listed member to the next without a new contact. A member not on the accepted list is a new task and needs fresh confirmation. |

Litmus test: does the directive name (or unambiguously point to) a single concrete deliverable? Yes → task-scoped, scope ends with the deliverable. No → conversation-wide, trivial-question suppression only.

Set-scoped is the same litmus applied to a **list** instead of a single item, and
it is deliberately the narrowest thing that makes a set run possible:

```
SET-SCOPED AUTONOMY IS BOUNDED BY THE ENUMERATION THE USER SAW.
A MEMBER ON THE ACCEPTED LIST IS CONTINUATION. ANYTHING ELSE IS A NEW TASK,
AND `NEW TASK → FRESH CONFIRMATION` APPLIES TO IT VERBATIM.
THE SET IS CLOSED AT ACCEPT TIME AND NEVER GROWS DURING THE RUN.
```

Four conditions, all of which must hold before a run may claim set scope. They
exist because "a set" is exactly the phrasing under which an unbounded backlog
could be smuggled in as one authorization:

1. **Enumerated before Accept.** Every member is printed on the contract screen
   — name, branch, and its own artifact count. A set the user did not read is
   not a set they authorized.
2. **Closed.** The list cannot grow after Accept. A roadmap discovered mid-run
   is a new task, not a late set member; it waits.
3. **Ordered, with independence declared.** The contract states the order and
   which members carry no declared dependency, because that is what decides
   whether the loop may continue past a failure (see
   [`roadmap-process-loop § 3d`](roadmap-process-loop.md)).
4. **One contract, one Accept.** Set scope is granted by the same single Accept
   as any other mode. It is never inferred from the fact that several roadmaps
   happen to be open.

What set scope does **not** touch: the Hard Floor, the locked decision classes,
the kernel-edit soak, and every
[`scope-control`](../../rules/scope-control.md) gate. It removes the *re-ask
between listed members* and nothing else — a set run that reaches a Hard-Floor
action stops there exactly as a single-task run would.


When the user later issues a **new** request — different ticket, different roadmap, different artifact, different feature — treat it as a fresh task. Re-confirm autonomy for the new scope before:

- creating a branch / worktree / PR / tag for the new work,
- implementing a roadmap whose **authoring** was the prior turn's deliverable (per [`scope-control § authoring vs implementation`](../../rules/scope-control.md#authoring-vs-implementation--verb-discipline)),
- expanding scope beyond the new task's literal ask.

In doubt whether the new request inherits or needs fresh confirmation → fresh confirmation. The Hard Floor and [`scope-control`](../../rules/scope-control.md) gates apply to every task regardless.

## Validation-loop budget — mechanics (N=3)

Autonomous flows must not iterate indefinitely on the same validation target. **Validation target** = a single identifiable artefact: a file path, a lint rule ID, a test name, a CI sub-task name. Natural-language clustering ("the linter stuff") does **not** count as a target — agents will rename their way out of the budget.

A "failed attempt" is an iteration that did not move the target from red to green. Tuning the tool around the target (e.g. growing an allowlist, loosening a threshold, suppressing a check) counts as an attempt — and is usually a sign the **tool**, not the content, is wrong.

### Allowlist-growth antipattern — detail

Crossing the 20-entry threshold counts as the 3rd validation-target failure for the linter in question, regardless of prior attempt count. The fix is a tool-shape change (heuristic tightening, scope narrowing, deletion), not more entries. Same logic for: warning-suppression lists growing past ~20, `// noqa` / `# type: ignore` sweeps over many files in one session, test `skip` / `xfail` bulk-adds to chase green.

### Probe efficiency — direct over orchestration

When validating a single target, run the **specific** check, not a meta-task that fans out to dozens of sub-tasks. Use the failing tool's direct entry point (the specific script invocation, the specific runner target, the single-test filter for the project's test runner) rather than the full CI meta-pipeline. Full-pipeline runs are appropriate at phase boundaries, not as a per-iteration probe.

Concrete tool mapping — verify with the narrowest tool that proves the target green: a single `curl` / Playwright spec / browser run for HTTP behavior, the project's test runner with a `--filter` for one test, a debugger / `xdebug` step-through for one frame. Never substitute a meta-pipeline for a tool that pinpoints the failure.

## Adaptive effort & stop (RDP)

Scale effort to task difficulty, and stop when marginal evidence drops — coupled
to the N=3 budget above, never replacing it. On a host with a native effort knob
(e.g. an `effort` parameter), the right move is to **set it high** for hard tasks
rather than scaffold; the scaffold here is for a standard host **without** such a
knob. The per-dimension uncertainty score (see
[`notes-first-reasoning`](../../rules/notes-first-reasoning.md)) feeds this
decision. Engage per [`rdp-gate`](rdp-gate.md).

## Retry-budget escalation ladder — 2, 3, and the fresh session are ONE ladder

The suite states three retry numbers; they are **stages of one escalation
ladder on the same failing target**, not competing budgets:

1. **Attempt 1 fails → up to 2 retries of the same approach**
   ([`think-before-action`](../../rules/think-before-action.md) "MAX 2
   RETRIES PER APPROACH") — the soft, agent-side stage: rethink between
   attempts, switch approach when the same signature repeats
   ([`context-hygiene`](../../rules/context-hygiene.md) "same failure
   signature twice → pivot").
2. **The 3rd consecutive failed attempt on the target trips N=3**
   (this file, above): 2 retries + the initial attempt ARE the three
   attempts N=3 counts. Terminal action: STOP, surface the attempts,
   ask the user.
3. **Repeated N=3 cycles on the same task** escalate to
   [`context-hygiene`](../../rules/context-hygiene.md)'s 3-Failure Rule:
   state dump + recommend a fresh session.

No artifact may mint a fourth budget or a stricter one-strike cap for the
same subject; per-tool loop caps (`token-efficiency` >2 same-tool calls)
are a different subject (tool-call repetition, not fix attempts).

**Concrete diminishing-returns stop-signal.** "Marginal evidence drops" is
otherwise fuzzy; operationalize it so it is checkable, not vibes: when **two
consecutive investigative probes** (a read, a grep, a query) yield **no new
load-bearing information** — nothing that changes the plan or the hypothesis —
stop gathering and act on what you have (or ask). This is the diminishing-returns
twin of the N=3 hard cap: N=3 stops fruitless *fixing*, this stops fruitless
*searching*. It never overrides the read-loop abort in
[`context-hygiene`](../../rules/context-hygiene.md) — that is the hard ceiling;
this is the earlier soft signal.

## End-of-turn checkpoint

Before ending a turn, check the last paragraph of the reply. If it is a
plan, an open question the context already answers, or a promise of
unexecuted work ("I'll…", "next I will…"), do that work now with tool
calls instead of ending the turn — this is what "the turn isn't done
until it's done" means in practice. This checkpoint operates inside the
existing bounds: the N=3 validation-loop budget and the Hard Floor
still apply unchanged; the checkpoint closes out work already in scope,
it never licenses continuing past either limit.
