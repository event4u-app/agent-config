---
complexity: lightweight
review_by: 2026-12-24
---

# Stub: road to subagent payload capture

> **Stub — not active work.** Drain-run transfer, 2026-08-20, from
> [`road-to-subagent-lifecycle-integrity.md`](../road-to-subagent-lifecycle-integrity.md).
> Council disposition **B**, outcome state **transferred**, per the framework of
> record in [`agents/evidence/council/drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md)
> § `raw-capture-needs-host-env`. The rationale there is two-part and both parts
> are the reason this cannot be automation: *"injecting `AGENT_HOOK_CAPTURE_DIR`
> into host settings is a host-environment modification and the resulting
> verbatim capture is an egress risk."*

## What moved here — and the narrow line it was cut on

**Only the raw-payload halves of Phase 0 Steps 2 and 4.** Not the steps. Both
steps carried two things — an *assertion* about a documented payload field, and
a *method* (capture the verbatim payload and record its field list). The
assertions were answerable from instruments that already exist and were answered
in the parent; the verbatim capture was not, and only it is here.

| Step | Assertion half — stayed, and is answered | Capture half — moved here |
|---|---|---|
| Phase 0 Step 2 | `last_assistant_message` **is** delivered on `SubagentStop` (17 `fail` records are an existence proof — a `fail` requires a decoded JSON object inside the message). `agent_type` is **not** delivered (3,129 of 3,400 stops null, 92.0 %). | The verbatim field list of a real `SubagentStop` payload — and **which of the two accepted key spellings** (`last_assistant_message` / `lastAssistantMessage`) the host actually sends. The ledger reads both and cannot distinguish them. |
| Phase 0 Step 4 | Zero payload-derived parent linkages exist in 632 observations (307 starts `assumed-root`, 325 shadow records `depth_usable_for_derivation: false`), and no code in the tree reads `agent_id`/`agent_type` off a tool event. | Whether `agent_id` / `agent_type` reach a `PreToolUse` / `PostToolUse` payload **inside** a Task-spawned subagent. The negative space above does not sample that population and is **not** an absence proof. |

Evidence for both assertion halves: [`subagent-lifecycle-drain-close.md`](../../evidence/investigations/subagent-lifecycle-drain-close.md)
§ B2, B3, B4.

**One step outside Phase 0 is blocked by this transfer rather than moved into
it.** Phase 4 Step 1 (payload `agent_id` ⇒ role `worker`) is gated on Step 4's
answer by the parent's own falsifier, so it closes in the parent as `[-]` naming
this stub. It is listed here so a reader promoting the stub knows what unblocks;
its text stays in the parent.

## The three-point integrity check

### 1. The original criterion, verbatim

From the parent's `blocker: raw-capture-needs-host-env`, § Resolved when:

```
a raw `SubagentStop` payload and a raw in-subagent `PreToolUse` payload exist
as captured files, and their field lists are recorded in
`agents/evidence/investigations/subagent-lifecycle-phase0-return-channel.md`.
```

### 2. The complete list of dependent steps

- **Phase 0 Step 2** — raw-payload half only (the field list, and the key
  spelling). `[-]` in the parent.
- **Phase 0 Step 4** — raw-payload half only. `[-]` in the parent.
- **Phase 4 Step 1** — blocked by, not moved. `[-]` in the parent.

Nothing else. Phase 0 Steps 1 and 3 are closed and stay closed; Phase 4 Step 2's
manifest comment already records this exact blocker at
`hook_manifest.yaml:863-870` and needs no edit when the capture lands, only an
update.

### Probe — 3. named producer, detection, and the baseline measured at transfer

**Producer:** the **host owner**, performing a fresh-session capture on the
machine whose `~/.claude/settings.json` the host reads. Not a maintainer role and
not a CI job — the act is a user-global tool-configuration change that reaches
every other live session on the machine, which is why
`security-sensitive-stop` § self-modification routes it through the
edit-permission gates rather than letting a session apply it to itself.

| # | Probe (read-only) | Baseline at transfer, 2026-08-20 |
|---|---|---|
| P1 | `ls ~/.agent-hook-capture/claude__SubagentStop__*.json` | directory does not exist (`ls` exit 1) |
| P2 | `ls ~/.agent-hook-capture/claude__PreToolUse__*.json` written from inside a subagent | directory does not exist |
| P3 | a real payload field list recorded in `subagent-lifecycle-phase0-return-channel.md` | absent — the file's only `raw_payload` block is the synthetic 3-key F3 probe, not a host capture |
| P4 | `grep AGENT_HOOK_CAPTURE_DIR ~/.claude/settings.json` | no match (exit 1) — the setting is **not** present today |

The item is discharged only when P1, P2 and P3 are positive **and P4 is
negative again** — the setting present is the standing egress surface, so its
absence afterwards is part of the criterion, not housekeeping.

## Containment — adopted, and stronger than "remove it afterwards"

The dissenting seat's condition for this transfer is adopted for this run: a
telemetry mechanism that writes verbatim payloads has **no named off-switch** if
its only bound is a manual cleanup step. *"Remove the `env` entry afterwards"*
is not a kill switch — it does not survive an interruption, a crashed session,
or a forgotten step, and the capture is fail-silent by design
(`dispatch_hook.ts:575-579`), so nothing will complain while it keeps writing.

Whoever performs this runs it under **all** of the following. They are
requirements, not advice.

1. **A dedicated, empty directory.** Not `/tmp`, not a project path, not a
   directory that already holds anything. Created for this capture and holding
   nothing else, so "what did this write" has an exact answer.
2. **Owner-only permissions** on that directory — `chmod 700` before the setting
   goes in, verified after. The files are verbatim hook payloads.
3. **One allowlisted session, of a declared duration.** A single fresh session,
   time-boxed and stated up front. Not "until I get around to it".
4. **Extract field NAMES only, then delete.** What the criterion needs is the
   key list and the key spelling — never a value. Extract the names, record
   them, delete the captured files in the same sitting.
5. **Remove the `env` entry, then verify it is gone** (probe P4 above). The
   removal is an action; the verification is the evidence.
6. **A fresh-session negative probe proving capture stopped.** Start one more
   session after the removal, dispatch one subagent, and confirm the capture
   directory stays empty. Removal-without-a-probe is a claim, not a fact — and
   this is the step that distinguishes "I edited the file" from "capture is
   off", which is exactly the gap a manual cleanup leaves.
7. **Abort on secrets or an unexpected content class.** If a captured payload
   carries a credential, a token, a customer identifier, or any content class
   the field-list task did not anticipate: stop, delete the directory, remove
   the setting, and record the abort. Do not "just extract the names anyway" —
   the whole point of the bound is that nobody has seen these payloads yet.

**Why the parent could not simply do it.** The capture facility itself is
already shipped and verified against the built bundle
(`_maybe_capture_payload`, `dispatch_hook.ts:486`, called unconditionally at
`:1082`; F3 of the return-channel file). Nothing needs building. The residue is
one environment variable that must be present in the process the *host* spawns
hooks from, which no command issued inside a session can reach.

## What promoting this stub is worth — and what it is not

**Worth:** Phase 4 becomes decidable in either direction. Today it is neither
implemented nor cancelled, because its falsifier ("no `agent_id` on tool
events → cancel the phase") cannot run. It also settles the key spelling the
ledger currently guesses at with a two-name lookup.

**Not worth pretending:** nothing in the parent roadmap is waiting on a *large*
piece of work. This is a one-session errand with a containment protocol
attached, and the protocol is longer than the errand on purpose.

Promote per item. Delete this stub when its last item is gone.
