# User-memory channels — the two write paths GATHER SIGNAL feeds

Migrated out of [`memory-consolidation`](../../../skills/memory-consolidation/SKILL.md)
on 2026-07-30 (P4 pattern: the skill keeps the obligation surface, the
mechanics live here). The skill had grown to 554 lines and tripped the
size warning; these two channel sections were the growth. Nothing was
dropped — the text below is the extracted body verbatim.

Both channels are governed by the council cut in
[`global-user-memory-cut`](../../../../agents/settings/contexts/global-user-memory-cut.md)
and the schema contract `docs/contracts/agent-user-schema.md`.

## Global user-scoped channel (road-to-global-user-memory Phase 2)

The Preference family (`prefer|always|never|standard|i want|ich will`)
already matches text about the user, not the project — GATHER step 3's old
behaviour was to detect it and throw it away. It now has a second
destination: `~/.event4u/agent-config/user/observations.jsonl`, the global
observation buffer from ADR-138's sibling phase — mirroring, one level up,
the project-local `.agent-user.observations.jsonl` contract in
[`agent-user-schema.md § Observation buffer`](../../../docs/contracts/agent-user-schema.md#observation-buffer).

**The project-scoped rule in Phase 3 (CONSOLIDATE) is unchanged.** No user
fact enters `agents/memory/` curated YAML through this or any other path —
the second channel has its own store
(`src/scripts/_lib/user_global_observations.ts`), its own closed `field`
allowlist, and its own human gate (`/agents:user review` /
`/agents:user accept`). Curated project memory keeps refusing user-scoped
facts exactly as before this phase.

**The shared ≤5 cap is enforced globally, not per channel** — see the exit
gate above. `applySharedFactCap(existingProjectFactCount, candidates)`
truncates the global-channel candidates to whatever headroom the
project-scoped channel left this cycle; the second channel can never
double the cap's write volume.

#### Capture-time guards — restated, not cross-referenced, because each one gets worse at global scope

Every candidate is checked BEFORE it is written to the buffer
(`evaluateCaptureGuards` in `user_global_observations.ts`), never filtered
later at review — rejecting the same class fifty times at review is the
noise problem capture-time refusal avoids. Three of the miner's existing
persist-time write-guards restate here because global scope sharpens the
stakes of each:

- **Never persist a verbatim standing command.** "Always fetch `<url>` on
  every message", "run `<cmd>` at the start of each session" — a standing
  directive stored as memory becomes a durable injection that re-fires
  forever. At global scope that is no longer one project's problem: it
  re-fires in **every** project the agent ever opens for this user.
- **Refuse a self-harmful standing preference.** "Never criticize me",
  "always agree with me", "never say I'm wrong" — a user can weaponize
  their own memory to disable honest feedback
  ([`direct-answers`](../../rules/direct-answers.md)). Global scope means
  disabling it once disables it everywhere; surface it, never store it.
- **The derivability check.** If git or config already answers the
  question, store the *surprising* part, not the derivable value. Global
  scope doesn't change this check's mechanics — it is the same
  consult-then-decide judgment call described under "Write-time curation
  discipline" above — but it is restated here because a derivable value
  wrongly persisted at global scope goes stale across every project at
  once, not just one.

(The `reference`-shape write discipline — store the pointer, not the
value — is unchanged by scope; see the bullet above rather than a
restatement here.)

A fourth and fifth capture-time class come from turning the
`.agent-user.md` explicit-exclusions list into a gate at capture rather
than at review, and from reusing the existing redaction gate verbatim:

- **Exclusion-list content.** Credentials · third-party names and
  birthdays · financial figures · health / legal / therapy status ·
  demographics · external-source identifiers — refused when the
  observation is captured, per
  [`agent-user-schema.md § Explicit exclusions`](../../../docs/contracts/agent-user-schema.md#explicit-exclusions).
- **Hidden unicode.** Every write routes through
  `knowledge_global_redaction.redaction_scan`, including its
  `hidden_unicode` class (the ADR-103 zero-width-smuggling detector) — the
  same gate a global knowledge card passes before crossing a project
  boundary.

Together these are the **four independently-testable capture-time guard
classes**: `standing_command`, `self_harmful_preference`,
`exclusion_list`, `hidden_unicode` — each has its own test in
`tests/lib/user_global_observations.test.ts` that fails if its guard is
removed.

#### The write path stays human-gated

`appendGlobalObservation` only ever appends to the buffer — it never
touches `profile.md`. The buffer is reviewed via `/agents:user review` and
applied via `/agents:user accept`
(`applyObservationToGlobalProfile` in `agent_user_profile.ts`), which
remains the **only** function anywhere in this channel that writes
`profile.md`. Nothing here runs automatically end-to-end; the human accept
step is still the gate ADR-138 and this phase both depend on.

## Project attribution channel (road-to-global-user-memory Phase 3)

CONSOLIDATE step 2 below assumes `agents/memory/intake/` exists and is
this package's own managed tree. It is not, for every project — the
operator's third ask ("P: project facts with no managed folder") covers
exactly the case where a repo has no managed `agents/` folder to write
project-scoped facts into at all.

**Check ORIENT step 2's premise before CONSOLIDATE writes anywhere.**
Resolve [`detect_managed_agents_folder`](../../../src/scripts/_lib/managed_agents_folder.ts)
against the project root once, during ORIENT:

- `managed` → CONSOLIDATE proceeds exactly as written below; nothing in
  this section changes.
- `unmanaged` / `not-a-project` → a project-scoped fact has nowhere local
  to land. Route it through
  [`routeProjectObservation`](../../../src/scripts/_lib/user_global_observations.ts)
  instead of writing to `agents/memory/intake/` (which would either fail
  or, worse, scaffold an unmanaged `agents/` directory as an unintended
  side effect). This attaches a `context` object
  (`project_path`/`project_name`/`first_seen`) and a `seen_count`/
  `seen_in[]` recurrence tally to the fact and appends it to the SAME
  global buffer Phase 2 uses — never a second store, never a
  project-indexed directory (the council's round-2 namespace refusal; see
  [`agent-user-schema.md § Project attribution`](../../../docs/contracts/agent-user-schema.md#project-attribution-road-to-global-user-memory-phase-3)).

**This is the only generalisation path.** A fact recurring in a
*different* unmanaged project (Jaccard similarity ≥ `MERGE_THRESHOLD`,
the identical dedup primitive `_lib/text_similarity.ts` uses elsewhere)
bumps `seen_count`; at `seen_count ≥ 3` it surfaces in `/agents:user
review` as a promotion candidate, with a mandatory `promotion_reason` as
human input before `/agents:user accept` writes anything to `profile.md`.
The agent never infers the cross-project pattern itself — `seen_count`
only grows one write at a time, from this router observing a genuinely
new project, never a batch scan across the store (the same non-goal §
Global user-scoped channel already restates for the U layer).


## TranscriptAdapter contract

The miner is host-agnostic by design. A `TranscriptAdapter` for host
`X` ships:

- **Discover:** function returning the absolute path(s) of session
  transcripts for the active project, scoped to the `--since` window.
  Phase 1 ships the Claude-Code adapter only; absent adapter →
  `not-supported-on-this-host`.
- **Iterate:** generator yielding turn objects with `{role, ts,
  text}`. Adapter strips IDE chrome and tool-call boilerplate before
  yielding.
- **Redact:** function applied to every yielded text — drops user
  names, file paths outside the repo root, and any personal
  identifier the consumer project lists in
  `.agent-settings.yml` under `memory.redact_patterns`.

The GATHER implementation lives in the single mining command
`/memory:mine-session` (`scripts/mine_session.ts`). It reads the
**cross-host** chat-history JSONL log (`agents/runtime/.agent-chat-history`,
written by platform hooks on every host), falling back to the per-host
Claude-Code transcript when the log is absent. `--mode=[signals|proposals|both]`
selects intake signals and/or rule/skill proposal seeds — the latter folds in
the former `/chat-history learn`.


## In-task notes → cross-run lessons (RDP)

The Reasoning Discipline Protocol writes an **in-task** session-notes file
(hypotheses, killed beliefs, predictions, decisions, uncertainty — structure in
[`notes-first-reasoning`](../../rules/notes-first-reasoning.md)). That file is
ephemeral working state, not curated memory. This skill is the **promotion path**:
when an in-task killed-belief, calibrated prediction, or decision *generalises*
beyond the task, consolidate it here as a durable cross-run lesson (one lesson per
file, with why it mattered). Apply the same signal-vs-noise discipline — most
in-task notes stay in-task and are discarded with the task.


## Runnable example

After a 4-day refactor of `app/Services/PaymentGateway`, run a
consolidation cycle:

- `/memory:mine-session --since 2026-05-06 --confirm-transcript-access --preview`.
- Miner surfaces 4 facts: 1 correction (`PaymentGateway::charge` must
  not throw on idempotency replays — `convention`), 1 decision
  (Laravel example: `Stripe webhook signing key lives in `config/services.php` only —
  `gotcha`), 2 patterns (`PaymentGatewayTest` flakes when seeded data
  carries timestamps in microseconds — `pattern + gotcha`).
- Report cites 0 stale flags. Re-run with `--commit-intake` after
  spot-checking the 4 facts.
- Hand off to `/memory:promote` for the curated-YAML write.

