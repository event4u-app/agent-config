---
complexity: lightweight
review_by: 2026-10-07
---

# Stub: the continuity retirements, sequenced behind a parity window

> **Stub — not active work.** A drain-run transfer (capability-gated), created
> 2026-09-07 by the autonomous drain of `road-to-one-continuity-record`. The
> scope decision is already made and the work is wanted; what is missing is an
> environment this run did not have — a downstream installation to observe, and
> an observation window to run a parity comparison in.
>
> The **steps** lived in the receiver
> `agents/roadmaps/archive/road-to-continuity-retirement-sequencing.md`, which is what
> the parent's `carried-to=` annotations point at, because the archival sweep
> resolves a carry destination only under `agents/roadmaps/` or
> `agents/roadmaps/later/`. This file carries the **ruling, the refuted premise
> and the promoting probe** — the things that would otherwise die with the
> parent.
>
> **Updated 2026-09-08.** That receiver ran and archived at 100%, closing five
> of its nine items. The remaining four moved on again, to
> `agents/roadmaps/archive/road-to-continuity-writer-activation.md` — that is where the
> live work is now, and this file's rulings still govern it. The probe readings
> below are re-measured in a section of their own at the end rather than edited
> in place, so the 2026-09-07 baseline stays readable next to what changed.

## Ownership

**Owner: the agent-config maintainer** (`matze4u`), unchanged from the parent
roadmap's blocker. No part of this transfer is delegated to a future drain run
by default: a run may execute it once the probe below reads true, and may not
decide the reserved half of D1 (see § What a future run may NOT decide).

## What moved here, and from where

Six items, all from `agents/roadmaps/archive/road-to-one-continuity-record.md`
(archived by the same change that created this stub):

| Parent step | Subject |
|---|---|
| 3.1 | One concern writes the record at the moments context ends |
| 3.2 | The reader consumes once, under the guards that already exist |
| 3.3 | Behave by how the session started (`compact` / `resume` / `fork`) |
| 4.1 | Retire the authorised set, one artifact at a time |
| 4.1b (second half) | `chat-history:checkpoint` — **refuted, see below** |
| 4.2 | Ratchet the surface count so it cannot grow back |

Parent acceptance criteria still open and carried with them: **AC-5**, **AC-7**,
**AC-8**. AC-6 was **ticked in the parent against shipped evidence** rather than
carried — the reader satisfies it today and `recycle_envelope_consumer.test.ts`
pins consume-once, stale refusal and foreign-workspace refusal each with their
stated reason.

## The council ruling that moved them — verbatim positions

AI council **2026-09-07**, 2 seats of 2 present (anthropic, openai), design
mode, deep depth, subscription transport, `$0.0000` billed. Recorded inline
rather than by path: council artefacts are gitignored and auto-pruned, so a path
here would rot.

**Question:** executing the owner's 2026-09-06 authorised retirement set
literally removes capabilities the authorisation did not name. Five decisions,
each with an explicit option set and a stated `Resolved when:`.

**Verdict: option 1 directionally on all five, implementation greenlight
DENIED.** Both seats. Seat 1: *"DENY pending architectural revision and
completion of unresolved decisions."* Seat 2: *"Select option 1 directionally
for D1-D5, but deny the implementation greenlight until handler isolation,
installed-hook migration, schema compatibility, restoration trust controls,
transactional failure behavior, and measurable rollout/rollback gates are
explicit."*

### D1 — `chat-history:checkpoint`

Removing the verb is **inside the 2026-09-06 authorisation**; preserving capture
is **required by scope**. But the migration is a protocol change across git
hooks already installed in downstream repositories. Seat 2 named the reserved
part: *"Introducing a new public command or rewriting user-modified hooks:
potentially an extension requiring explicit design authority."* Seat 1 named the
flag-day break: removing the verb before the installed hooks are migrated stops
capture in every existing installation, silently.

Seat 2 also qualified seat 1's proposed multi-month deprecation: *"First
determine whether existing hooks can be recognized and atomically rewritten
during normal upgrade. A deprecated alias is the fallback, not an assumed
requirement."*

### D2 — `run_checkpoint` after `session-eol` retires

Keep `run_checkpoint` — **preservation of the status quo**. Retiring
`session-eol` is inside the authorisation. **Making the continuity concern own
`run_checkpoint`'s production is neither authorized nor necessary.** This was
both seats' sharpest objection, and it is a category argument rather than a
style preference: run-integrity evidence is keyed by run id, consumed by
`run:supervise`, and a disagreement there is an integrity alarm; a continuity
record is keyed by session, consumed by resume, and a gap there is a degraded
resume. Seat 1: *"This is a lifecycle orchestrator disguised as a continuity
concern."* Seat 2: *"Until then, one concern is a multi-purpose lifecycle
subsystem disguised by naming."*

Required shape instead: a lifecycle dispatcher invoking **independently owned
handlers** — continuity-record writer, run-checkpoint writer, session-index
restorer — with separate inputs, validation, storage, flags, error policies,
observability and tests, and **no handler failure preventing another from
running**.

`context-fill.json` may be retired with the concern (producer, no consumer), with
seat 2's qualification recorded: *"no consumer in the tree"* proves no
in-repository consumer, not that no packaged or external consumer exists.

### D3 — `hot-context`, `session_memory_index`, `memory.session_index`

Retiring the concern is authorised. Preserving the setting is status quo.
**Relocating where its restore activates is new architecture and needs evidence
of equivalence**, plus an explicit trust contract: repository and worktree
identity, path canonicalization, freshness, ordering, duplicate invocation and
size limits — *"restored memory is untrusted context"*. A global kill switch is
inadequate: operators must be able to disable restoration independently while
continuity writing and run verification stay active.

### D4 — the deterministic writer's schema

Add a variant. **Explicit absence markers under `main_session` remain invalid
because they misrepresent unavailable model judgments as values.** Tolerant
readers must exist **before** any writer emits the new variant. The compatibility
contract must state: whether the version is envelope-wide or variant-specific;
unknown-variant behaviour; old-reader/new-writer; new-reader/old-record; whether
`/agent-handoff` can still emit the existing variant under the new version; and
rollback after new-version records already exist.

*Discharged in the parent* for the envelope-wide half: `ACCEPTED_CAPSULE_VERSIONS`
in `src/scripts/_lib/subagent_capsule.ts` states all six, and v4 is accepted
alongside v3.

### D5 — the unreachable-host half of parent step 1.2

Fix the falsifiable contradiction; record the unverifiable one as unverified with
a resolve-by condition. Documentation must separate **what the manifest
declares**, **what lowering can generate**, and **what the host actually
invokes** — *"The manifest is a declaration, not proof of runtime behavior."*

*Discharged in the parent.* The `pre_compact` alias disagreement for `cursor` and
`cline` is recorded as unverified in `docs/enforcement-by-host.md` with its own
resolve-by condition, and is not part of this transfer.

### The refinement neither the roadmap nor the question anticipated

Both seats: the parent's `0 / 0 / 1 / 1 / 0` success measure is **gameable by
naming** unless the inventory rule is behavioural —

> Any persisted state written for later session/run recovery, verification, or
> context restoration must be listed, whether or not it is labeled "continuity."

Exclusions stay legitimate and must stay **visible in the inventory**. Parent
step 4.2 therefore has to publish the inventory with its exclusions and their
reasons, not only the five numbers. `run_checkpoint` is the worked example:
classifying it outside "continuity" is exactly how position 3 could be made to
read `1` without anything being retired.

## The nine-step sequence the seats named

1. Define the artifact inventory, ownership, provenance and failure policies.
2. Specify the new schema variant and make every reader backward- and
   forward-tolerant.
3. Introduce independent lifecycle handlers with independent kill switches.
4. Verify failure isolation and idempotent retries through fault injection.
5. Add the surviving capture endpoint and a safe installed-hook migration.
6. Run a non-authoritative comparison with outputs physically separated.
7. Switch producers only after parity and stale-hook gates pass.
8. Remove the retired commands and concerns.
9. Validate the end-state counts against source, published package contents, and
   an upgraded existing installation.

Seat 2: *"Steps 2-5 genuinely block removal. In particular, old readers block D4
emission, and installed hooks block D1 command removal."* Step 2 is discharged;
steps 1, 3 and 4 are buildable now; steps 5 to 9 are what this stub waits on.

Seat 2 on the shadow writer step 6 requires, and it is a constraint on the
implementation rather than advice: it *"must not write into the authoritative
directory or use the authoritative filename, and cleanup must be
deterministic."*

## The refuted premise — do NOT execute parent step 4.1b as written

```
`chat-history:checkpoint` IS NOT AN ORPHAN. THE PARENT'S REPRODUCTION OF IT IS
WRONG, AND EXECUTING THE STEP AS WRITTEN REMOVES A CHAT-HISTORY CAPTURE PATH
THAT THE PARENT'S OWN GOAL PLACES OUT OF SCOPE BY DECISION.
```

Parent step 4.1b states the verb *"is not a subcommand of `chat_history.ts` at
all — its `SUBCMDS` list does not contain it"*. The literal name is indeed absent
from `SUBCMDS` (`src/scripts/chat_history.ts:1825-1838`) and the inference drawn
from it is false. Reproduced at `60e84da85`:

- `src/scripts/_dispatch.bash:1010` runs `chat_history.ts hook-append --event phase "$@"`.
- `hook-append` **is** in `SUBCMDS` (`src/scripts/chat_history.ts:1836`), with a
  handler at `:1883`.
- It has a real **producer**: `src/scripts/install-hooks.sh:408-424` writes four
  git hooks — `post-commit`, `post-merge`, `post-checkout`, `post-rewrite` — each
  of which calls `./agent-config chat-history:checkpoint --payload …` to append a
  phase boundary to `agents/runtime/.agent-chat-history`.

That append **is chat-history capture**. The parent's goal says capture survives:
*"Also out of scope: … retiring `chat-history` **capture** — it is the only
cross-host transcript source."*

What is left is a **name** collision, not an orphan. Retiring the name is a
protocol migration across already-installed downstream hooks, which is D1.

## What a future run may NOT decide

Two things are reserved and a probe reading true does not unlock them:

1. **Rewriting a locally modified installed git hook.** Seat 2 classified this as
   *"potentially an extension requiring explicit design authority"*. Detect
   ownership by exact generated content; leave a modified hook untouched and
   report it.
2. **Introducing a new public command** as the surviving capture endpoint. The
   parent's authorisation names what is retired, not what is added.

Either needs the owner, not this stub.

## Promoting probe — four readings, no calendar date

```
REOPEN WHEN P1 THROUGH P4 ALL READ TRUE. NEVER ON A DATE.
A DATE HERE WOULD BE A GUESS ABOUT WHEN SOMEONE ELSE SHIPS SOMETHING.
`review_by:` ABOVE IS A RE-READ CADENCE, NOT A PROMOTION CONDITION.
```

Each is a reading someone can take, and each has its **measured baseline on the
transfer date (2026-09-07)** so a later reader can tell movement from noise.

**P1 — independent handlers exist, and one failing does not suppress another.**
`hook_manifest.yaml` declares the continuity-record writer, the run-checkpoint
writer and the session-index restorer as **separate** concern ids, each with its
own kill switch, and a fault-injection test exercises every handler combination.
*Baseline 2026-09-07: FALSE — none of the three exists as a concern;
`session_eol_hook.ts:58` is still the sole caller of `buildCheckpoint`, and
`hot_context_hook.ts:409` the sole caller of `session_memory_index.ts`.*

**P2 — every capsule reader dispatches on `variant` before rejecting on
version**, and a test pins an unknown variant being refused without corrupting a
known one. *Baseline 2026-09-07: PARTIAL — `ACCEPTED_CAPSULE_VERSIONS` accepts
v3 and v4 and the contract is written, but no third variant exists yet, so the
unknown-variant branch is untested by construction.*

**P3 — a parity comparison has run with outputs physically separated.** The
shadow writer wrote to neither the authoritative filename nor the authoritative
directory, its cleanup is deterministic, and the comparison is recorded.
*Baseline 2026-09-07: FALSE — no shadow writer exists.*

**P4 — an UPGRADED downstream installation shows the migration landed.** In a
checkout that was upgraded rather than freshly installed, the four generated git
hooks call the surviving capture verb, no unmodified hook still calls the retired
name, and any locally modified hook was reported rather than rewritten.
*Baseline 2026-09-07: FALSE — `install-hooks.sh:408-424` still emits
`chat-history:checkpoint`, and no migration path exists.*

**Closing in the other direction also counts.** If P1-P4 cannot be made true —
for instance if the owner decides the retirement set is not worth the migration
— that is a legitimate close, recorded as such, and the parent's Risk 1 stands
as the recorded consequence. A measured null closes a transfer as legitimately
as shipped work does.

## Why the parent closed around this rather than staying open

The parent is archived at 20/20 with six steps carrying the deferral glyph. That
closure is **bookkeeping, not substantive resolution**: the surface count is
unchanged except for `HANDOFF.md`, and the parent's own Risk 1 — *the record is
added and nothing is retired* — is still live for the transferred half. The
parent says so in its own body; this paragraph is the same statement from the
receiving end, so neither file can be read alone and give the wrong impression.

## Probe re-reading, 2026-09-08

The baselines above are the transfer-date readings and are left untouched. This
is the same four probes measured again after
`road-to-continuity-retirement-sequencing` closed.

**P1 — independent handlers exist, and one failing does not suppress another.**
**Still FALSE, and now with a named reason rather than an absence.** No concern
was split, because `check_estate_count` ratchets `concern_count` off
`src/scripts/hook_manifest.yaml` with allowance 0, a three-way split is +2, and
no concern retirement was inside the authorised scope. Both seats of the
2026-09-08 council raised this unprompted and refused a temporary allowance.
Tracked as `three-concern-split-is-unpaid-under-the-concern-ratchet`.

**P2 — every capsule reader dispatches on `variant` before rejecting on
version, and a test pins an unknown variant being refused without corrupting a
known one. → TRUE.** The baseline recorded this as PARTIAL and untestable "by
construction" because no third variant existed. `continuity_record` exists now
(`src/scripts/_lib/subagent_capsule.ts`), the validator resolves `variant`
first and short-circuits on one it does not know, and both halves are pinned:
an unknown variant is refused by name with no field checks run, and the next
known record still validates. Three cases at the validator, one more at the
consumer.

**P3 — a parity comparison has run with outputs physically separated.** Still
FALSE, and the requirement changed shape. The 2026-09-08 council split it:
fixture equivalence discharges *transformation* parity only, while activation,
consumption, publication and failure isolation need integration evidence
against the real dispatcher and storage adapter with controlled failures — but
a wall-clock soak is explicitly NOT required, which removes the part of this
probe no in-session run could ever have satisfied. Carried as step 1.3 of the
new receiver.

**P4 — an UPGRADED downstream installation shows the migration landed.** Still
FALSE, and now known to be gated on an owner decision rather than on
environment: the surviving capture endpoint's NAME is owner-reserved
(2026-09-08 D2, tracked as `capture-endpoint-rename-is-owner-reserved`), so
there is no migration to observe until that is chosen. `install-hooks.sh:459-484`
still emits the old name.

**What the re-reading changes about promotion.** One probe flipped, and the
other three now each name the specific thing they wait on — a paid-for concern
retirement, an integration test suite, and one owner decision — rather than
waiting on an unspecified future environment.
