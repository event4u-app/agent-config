---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-worker-generation-recycling
    relation: disjoint
    note: >
      That roadmap is parked and is about a WORKER at its budget handing off
      instead of dying — subagent lifecycle. This one is about the MAIN
      session's continuity across a compaction, a stop, or a fresh start. They
      share the word handoff and no artifact.
estate_growth_exempt: "Seven runtime continuity artifacts, four hook concerns, three slash commands and four CLI verbs answer one question — what must the next session know — and no active, later or stub roadmap owns any of it; the twelve roadmaps that built the layers are all archived, and not one retired its predecessor. The roadmap is SUBTRACTIVE: its success measure is a lower surface count, not a new mechanism. Six defects are reproduced and unowned, listed in full in the goal: one path per workspace with no session key while the session register models concurrent sessions in one checkout; a schema that records what failed with no field for what worked; no predecessor edge; no open-questions field on the session variant; three different things called envelope; and an orphan artifact plus a verb with no subcommand."
estate_offset_exempt: "Cannot be offset. The only adjacent entry is the parked worker-recycling roadmap, whose subject is the subagent lifecycle; archiving it to pay for this would retire an unrelated plan and leave the main-session surface unowned exactly as it is today."
---
# Road to one continuity record

> **Source:** `agents/tmp.old/inbox-2026-09-t/` — two parallel external sessions,
> three deepening loops each, on the owner's own question: this package carries
> three continuity mechanisms, should all three exist, can they be unified, and
> can it work without a command. Both converged on subtraction. Every figure
> below was re-derived at `d949ef374`; the proposals were pinned one merge
> earlier at `10c24a4`.

> **Arrivals:** the continuity subject appears in **28** consumed inbox rounds
> under `agents/tmp.old/` (measured 2026-09-06, `grep -rli continuity`, distinct
> round directories); `recycle` in 20, `chat-history` in 35. The broader
> `handoff` and `envelope` greps return 99 and 103 and are **not** quoted as
> arrival counts — both words carry unrelated senses in this tree, which is
> itself the vocabulary defect below. **The 28 is the same kind of measurement
> and is stated as such:** it counts rounds whose text contains the word, not
> rounds that asked for this change. It is a floor on how often the subject is
> in the room, and nothing finer.

## Goal

**After Phase 4 exactly one continuity concept is visible to a normal user or
agent, and no continuity-specific command is required.** One record is not
enough on its own: a tree can carry a single record and still leave `handoff`,
`recycle`, `chat-history import` and a hot-context cache standing as competing
mental models. The end state is therefore stated as numbers, and Phase 4.2
ratchets them:

```text
public continuity commands:       0
session resume pickers:           0
persistent continuity artefacts:  1
continuity schemas:               1
normal-path manual actions:       0
```

Hook concerns are deliberately absent from that list. Multi-host adapters may
make one physical concern impractical; what must be singular is the **semantic
writer/reader contract**, not the file count.

Counted at `d949ef374`:

- **Seven runtime artifacts** — `recycle-envelope.json` and its `.consumed`
  sibling, `handoff-context.md`, `HANDOFF.md`, `hot-context.md`, `checkpoints/`,
  `context-fill.json`, `session-eol/`.
- **Four hook concerns** — `chat-history`, `hot-context`, `handoff-context`,
  `session-eol`.
- **Three slash commands** and **four CLI verbs** — `handoff`,
  `session:recycle`, `chat-history:hook`, `chat-history:checkpoint`
  (`src/cli/registry.ts:62,73,112-113`).
- **Twelve archived roadmaps** on this subject and **zero** active, later or stub
  owners. Each layer had its epoch; none retired the one before it.

Four reproduced defects anchor the work:

1. **One path, no session key.** `RECYCLE_ENVELOPE_REL`
   (`src/scripts/_lib/recycle_envelope_paths.ts:11`) is exactly
   `agents/runtime/state/recycle-envelope.json`, and `HOT_CONTEXT_REL`
   (`src/scripts/hot_context_hook.ts:59`) is one file "OVERWRITTEN on every
   `stop`" with `loss_class: ephemeral-lossy`. Meanwhile
   `src/scripts/session_register_hook.ts:5` writes "this session into a register
   shared by every worktree of the repo" — the register models concurrent
   sessions and the two continuity artifacts model exactly one.
2. **The schema records failure and not success.** `RECYCLE_ENVELOPE_KEYS`
   (`src/scripts/_lib/subagent_capsule.ts:599-624`) holds 24 keys including
   `failed_approaches`, and a grep for `successful_approaches` over that file
   returns **0**. Of the owner's four questions, *what it was about* maps to
   `task`/`summary`, *the goal* is proxied by `acceptance_criteria`, *what did
   not work* is `failed_approaches`, and **what worked has no field at all**.
3. **Vocabulary collision — three things called envelope, not two.**
   `OutcomeEnvelope` (`src/scripts/_lib/outcome_envelope.ts:88-121`) is a run
   terminal outcome with seven fields and no session, repo or task field;
   `MainSessionRecycleEnvelope` (`subagent_capsule.ts:283-350`) is the session
   one; `WorkerCapsule` (`:69-92`) is the subagent generation handover. And
   `HANDOFF.md` is pointed at `lint_handoffs.ts`, which lints "cross-wing
   handoffs declared in senior-tier skills' `## Related Skills`"
   (`src/scripts/lint_handoffs.ts:3`) and has nothing to do with it; the stale
   attribution sits at `src/domains/meta/agent-handoff/command.md:181`.
   *`corrected-from-reproduction`* — one proposal names `capsule` as a new word
   to avoid; it is the shipped discriminator (`CAPSULE_SCHEMA_VERSION = 3`,
   `CAPSULE_VARIANTS = ['worker','main_session']`), so 1.1 picks the surviving
   word from what ships rather than from what reads best.
4. **An orphan artifact.** `HANDOFF.md` appears in exactly three files — one
   command document, that unrelated linter, and one skill — with no producer and
   no consumer in code.

**A recorded lock governs the schema, and this roadmap stays inside it.**
`agents/settings/contexts/continuation-protocol-and-runtime-graph.md:9-31`
already answered a near-identical earlier proposal: **one schema, variant-
discriminated, no new format**, with the rule that a version "may add fields or
variants, never repurpose or remove one". Its reopen condition is a consumer
whose required fields *contradict* an existing variant. Nothing below does —
Phase 2 adds fields under that rule and bumps the version, and a second schema
is out of scope by that lock rather than by preference.

Out of scope by decision: **journal-as-authority.** Both proposals' larger
parent builds a Journal → Capsule → Projection architecture on the runtime
journal, and `hooks.runtime_journal` ships **default-OFF**
(`src/config/agent-settings.template.yml:1289`), with the hook's own docstring
stating the honest consequence. On a default install that architecture is null
by construction, and the reach runs the wrong way besides: `journal-record` and
`session-eol` bind on **claude alone**, while `hot-context` and
`handoff-context` bind across seven platforms — moving continuity into the
journal would switch it off on six hosts. Also out of scope: registering any new
host slot before the host-capability surface is refreshed, and retiring
`chat-history` **capture** — it is the only cross-host transcript source.

**Its role narrows even so: chat history is input and evidence, never
continuity.** The record may read from it; a developer must not have to hold it
as a second recovery path. `/chat-history import` therefore goes as a *resume
mechanism* in Phase 4 while the capture substrate stays.

## Phase 1 — One word per concept, before any mechanism moves

- [x] **1.1 Name the collision and pick the surviving word.** `envelope` means
      the subagent outcome envelope and the session record; `handoff` means the
      skill-link lint, the CLI verb and the session artifact. Add both to the
      avoid-list in `docs/guidelines/redundancy-taxonomy.md` with the one term that
      survives, and fix the reference that points `HANDOFF.md` at the skill-link
      linter.
      verify: `grep -rn "HANDOFF.md" src/` returns no line attributing it to
      `lint_handoffs.ts`, and each of the two words resolves to one concept in the
      taxonomy.
- [x] **1.2 Refresh the host-capability surface before binding anything.** The
      proposals assume slots at compaction and session end; what this tree binds
      there today is `hot-context`, `journal-record` (default-off), `chat-history`,
      `session-register` and others — `hot_context_hook.ts:472` writes on `stop`,
      `session_end` **and** `pre_compact` in one branch. Bring
      `docs/enforcement-by-host.md` and the
      manifest's `native_event_aliases` into agreement with what each host actually
      offers. *`corrected-from-reproduction`* — one proposal states no producer runs
      at those slots; the slots ARE bound, and the accurate claim is that none of
      the bound concerns writes a continuity record.
      verify: no document names a slot the host does not have, and for each of the
      two slots the record says which concern writes what.

## Phase 2 — The record carries a session key

- [x] **2.1 Key the continuity artifact by session, not by workspace.** Two
      sessions in one checkout overwrite each other today, and the session register
      already holds the identity to key on.
      **No shared `latest` index is introduced.** A per-session key removes the
      shared file; a pointer naming the newest record would put it straight back and
      reintroduce the same write race one layer up. Resolution is by register
      identity, workspace and branch — never by an index.
      verify: two concurrent sessions in one checkout each produce their own record
      and neither observes the other's; no file names "the latest" record; on
      ambiguity the reader starts clean and says so in one line.
- [x] **2.2 Give the schema a field for what worked, as an extension.**
      `failed_approaches` has no counterpart, which makes the record structurally
      pessimistic — it can say what to avoid and not what to repeat. Add it and
      `open_questions` (which exists as `open_risks` on the worker variant at
      `subagent_capsule.ts:81` and as prose in the handoff template, but has no
      field on the session variant) to `RECYCLE_ENVELOPE_KEYS` and the validator,
      under the lock's own rule: add fields, bump `CAPSULE_SCHEMA_VERSION` from **3**
      (`subagent_capsule.ts:112`) to **4**, never a second schema.
      verify: a record carrying both new fields validates at the bumped version, an
      older record still validates, and the four owner questions each map to a
      named field or a stated proxy with the mapping written down.
- [x] **2.3 Record which session preceded this one.** `grep -rn
      "predecessor_session\|lineage_id" src/` returns **0**: the reader injects what
      is lying there, not what the right predecessor would be, so 2.1's key alone
      does not settle resolution.
      The first session in a workspace has no predecessor and writes
      `predecessor: none` — a stated absence, never an empty field, so the reader
      never waits on something that will not arrive.
      verify: a record names its predecessor or states it has none, a first session
      writes the explicit `none`, and the reader refuses rather than guesses when a
      named predecessor is absent.

## Phase 3 — Written where context dies, read once at the start

- [ ] **3.1 One concern writes the record at the moments context ends.** Today the
      only automatic producer is threshold-gated and its output is not read at the
      next start. The writer runs without model spend and writes only what it can
      derive. **The barrier is in the code and is not skipped here:**
      `src/scripts/hooks/session_eol_hook.ts:16-18` records that "hooks cannot
      inject `/clear`, so the recycle action itself stays advisory-carried by
      design". Writing the record is automatable; clearing the session is not, and
      this step covers only the first.
      verify: a session ending at a bound slot leaves a record without model spend; a
      session that did nothing substantive leaves none; and
      `continuity_written_per_substantive_session` is a counter in the concern's own
      state, never a file-presence check — the council of 2026-08-22 struck
      presence-counting for exactly this metric family.
      verify: a session that ends at any of the bound slots leaves a record, a
      session that did nothing substantive leaves none, and the count comes from the
      concern's own state rather than from file presence.
- [ ] **3.2 The reader consumes once, under the guards that already exist.** The
      consume-once, age-bound, workspace-identity, drift-line and
      data-never-instruction guards are shipped and are **reused by name, not
      reimplemented**: `wrapAsPriorSessionData` and `hasBoundaryMarker`
      (`handoff_context_hook.ts:70-84`, boundary constants at
      `subagent_capsule.ts:482-486`), `scanEnvelopeDirectives` for the directive
      scan, `MAX_AGE_HOURS = 48` (`handoff_context_hook.ts:52`) and the
      consume-once move at `:8-15`. Injection that does not pass through the
      wrapper is a defect, not a shortcut.
      verify: the reader calls `wrapAsPriorSessionData` and refuses an unwrapped
      record via `hasBoundaryMarker`; the existing refusal fixture that pins that
      branch still passes and is extended to the new record shape; a record is
      consumed at most once; a stale or foreign one is refused with its reason; and
      the injected text is data with a drift line leading.

- [ ] **3.3 Behave by how the session started.** `session_start` carries a `source`.
      On `compact` the session is the same one continuing, so its **own** record is
      re-injected rather than a predecessor's; on `resume` and `fork` the host has
      already restored context and nothing is injected. Reading the wrong one is how
      a continuation acquires a stranger's state.
      verify: each of `compact`, `resume` and `fork` produces the stated behaviour,
      and an unrecognised `source` injects nothing rather than guessing.

## Phase 4 — Retire, and prove the surface shrank

- [ ] **4.1 Retire the authorised set, one artifact at a time.** The owner
      authorised the full set on 2026-09-06 (blocker below, option 1):
      `HANDOFF.md`, `hot-context.md`, the `hot-context` and `session-eol` concerns,
      `session:recycle`, `/chat-history` and `/chat-history import`. `handoff` and
      `/agent-handoff` survive as the one verb and the one command; `chat-history`
      **capture** survives as input substrate. Each retirement names its
      replacement and lands with its reference removals in the same change.
      **`run_checkpoint` is not on the list and is not retired blind:** it is kept
      only if it carries semantics the record does not, and that question is
      answered in writing before it is touched either way.
      verify: after each retirement the tree contains no reader of the retired
      artifact, the five end-state numbers are re-derived and lower, and the
      `run_checkpoint` question carries a written answer.
- [ ] **4.1b Start with the two that cost nothing.** `HANDOFF.md` has no producer
      and no consumer — **retired 2026-09-07**, together with the artifact-mode
      validator inside `lint_handoffs.ts` and its test; `grep -rn "HANDOFF.md"
      src/` now returns nothing, which also discharges 1.1's attribution clause.
      *`corrected-from-reproduction`* — **the second half of this step is
      refuted and must not be executed as written.** The step says
      `chat-history:checkpoint` "is not a subcommand of `chat_history.ts` at
      all". The literal name is indeed absent from `SUBCMDS`
      (`src/scripts/chat_history.ts:1825-1838`) and the inference drawn from it
      is wrong: `src/scripts/_dispatch.bash:1010` runs `chat_history.ts
      hook-append --event phase`, `hook-append` **is** in `SUBCMDS` (`:1836`)
      with a handler at `:1883`, and the verb has a real producer —
      `src/scripts/install-hooks.sh:408-424` writes four git hooks
      (`post-commit`, `post-merge`, `post-checkout`, `post-rewrite`) that call
      it to append a phase boundary to `agents/runtime/.agent-chat-history`.
      That append is chat-history **capture**, which the goal above places out
      of scope by decision. What is left is a NAME collision, not an orphan, and
      retiring the name is a protocol migration across already-installed
      downstream git hooks — see the council disposition below.
      verify (`HANDOFF.md` half, met): gone; `grep -rn "HANDOFF.md" src/`
      returns nothing; no test or command references it; `lint_handoffs` green
      at its unchanged 18-violation baseline and its 13 tests pass.
- [ ] **4.2 Ratchet the surface count so it cannot grow back.** Twelve archived
      roadmaps built these layers and none retired its predecessor; a count that is
      not gated returns.
      The rule the ratchet encodes: **a new continuity mechanism may be introduced
      only if it replaces an existing one, or demonstrably covers a capability the
      one record cannot.** Without it the tree grows `continuity-v2`, `resume-state`,
      `smart-handoff` and `session-memory-cache` side by side within six months,
      which is what the twelve archived roadmaps already did once.
      verify: a change adding a continuity artifact, command, verb or schema without
      retiring one reddens a check; the check reports the five end-state numbers from
      this roadmap's goal; and the rule is stated where the check fails, not only
      here.

## Blockers

### blocker: continuity-record-retirement-scope

- **Status:** resolved
- **Owner:** maintainer
- **Asked:** 2026-09-06, in the round `inbox-2026-09-t` disposition and in the reply that carried it.
- **Blocks:** nothing further — Phase 4 is unblocked.
- **Recommendation:** none was given; the owner chose without one.
- **If you do nothing:** no longer applicable. Recorded for the audit trail: the cost of the non-decision was that the record would be added and nothing removed, making this the thirteenth layer that did not retire its predecessor.
- **What to do:** nothing — the decision is taken. Phase 4.1 carries the authorised set and `src/cli/registry.ts` plus `src/domains/meta/` are the surfaces it edits.
- **Resolved when:** — resolved 2026-09-06. The owner authorised **option 1, the full retirement set**, on the stated ground that option 2 halves the effect and leaves standing exactly the commands named as bloat, and option 3 makes this roadmap the thirteenth layer that removes nothing. The consumer path survives intact because `handoff` and `/agent-handoff` remain the single verb and command, and `chat-history` capture is out of scope.

## Council disposition — Phases 3 and 4 are sequenced behind this change

AI council, 2026-09-07, 2 seats of 2 present (anthropic, openai), design mode,
deep depth, subscription transport, nothing billed. Asked because executing the
authorised retirement set literally removes capabilities the 2026-09-06
authorisation did not name. Five decisions were put with explicit option sets.

**Verdict: option 1 directionally on all five, implementation greenlight
DENIED.** Both seats. The direction was never the disputed part; the coupling
and the sequencing were.

| # | Decision | Ruling |
|---|---|---|
| D1 | `chat-history:checkpoint` | Removing the verb is inside the authorisation and preserving capture is required by scope, but the migration is a protocol change across git hooks already installed in downstream repositories. Rewriting a locally modified hook crosses an ownership boundary and needs design authority this council does not hold. |
| D2 | `run_checkpoint` after `session-eol` retires | Keep `run_checkpoint` — it is preservation of the status quo. **Do NOT move its production "onto the new continuity concern".** Both seats named that the sharpest blocker: run-integrity evidence and conversational-state restoration have different lifecycles, consumers, keys and failure semantics, and one concern owning both is a lifecycle subsystem wearing a continuity name. Independent handlers behind the lifecycle dispatcher, with independent kill switches. |
| D3 | `hot-context` and `memory.session_index` | Retiring the concern is authorised; preserving the setting is status quo; **changing where its restore is activated is new architecture and needs evidence of equivalence**, plus an explicit trust contract (repository/worktree identity, freshness, ordering, duplicate invocation, size limits) since restored memory is untrusted context. |
| D4 | the deterministic writer's schema | Add a variant rather than stuffing absence markers into `main_session` — explicit absence markers "misrepresent unavailable model judgments as values". Tolerant readers must exist before any writer emits the new variant, and the compatibility contract must be stated, not inferred. |
| D5 | the unreachable-host half of 1.2 | Fix the falsifiable contradiction; record the unverifiable one as unverified with a resolve-by condition. Documentation must separate what the manifest declares, what lowering can generate, and what the host actually invokes — a declaration is never evidence of runtime behaviour. |

**The sequencing both seats required**, and the reason Phases 3 and 4 are not in
this change:

1. define the artifact inventory, ownership, provenance and failure policies;
2. specify the new variant and make every reader backward- and forward-tolerant;
3. introduce independent lifecycle handlers with independent kill switches;
4. verify failure isolation and idempotent retries by fault injection;
5. add the surviving capture endpoint and a safe installed-hook migration;
6. run a non-authoritative comparison with outputs physically separated;
7. switch producers only after parity and stale-hook gates pass;
8. remove the retired commands and concerns;
9. validate the end-state counts against source, package and an upgraded install.

Steps 5 to 9 are not reachable from a session that cannot observe downstream
installations or run an observation window. Step 2 is discharged by this change
(the v4 contract on `ACCEPTED_CAPSULE_VERSIONS`).

**Why Phase 3 is not landed alone, which is the non-obvious half.** Phase 3
introduces a writer; Phase 4 removes the six surfaces it replaces. The council's
own ordering puts a parity window between them, so they cannot be one change —
and Phase 3 landing without Phase 4 is precisely **Risk 1 of this roadmap's own
register**: the record is added and nothing is retired, the thirteenth layer
that removes nothing. A shadow writer that nothing reads would add a concern to
a ratcheted estate to buy a future parity run. The council did not ask for that
and the risk register argues against it.

**One further refinement neither the roadmap nor the question anticipated:** the
`0 / 0 / 1 / 1 / 0` measure is gameable by naming unless the inventory rule is
behavioural. Both seats: *any persisted state written for later session or run
recovery, verification, or context restoration must be listed, whether or not it
is labelled continuity.* Exclusions stay legitimate and must stay visible in the
inventory. Step 4.2's check must publish that inventory, not only the five
numbers — `run_checkpoint` is the worked example, since classifying it outside
"continuity" is exactly how position 3 could be made to read 1 without anything
being retired.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The record is added and nothing is retired | product | Every one of the twelve archived roadmaps on this subject added a layer, and not one removed the layer before it; the same outcome here is the single most likely failure and it looks like progress the whole way. | The estate claim states subtraction as the success measure, 4.1 requires each retirement to name its replacement and land with its reference removals, and 4.2 ratchets the four counts so a later addition without a retirement reddens. | Phase 4 — Retire, and prove the surface shrank |
| 2 | Journal-as-authority returns through the back door | implementation | The larger parent's architecture is elegant and the runtime journal is already built, so a phase that needs durable history will reach for it — and on a default install it records nothing, making the record empty exactly where it matters. | The goal names it out of scope by decision with the setting and the docstring that establish it; 3.1 requires the writer to write only what it can derive, which excludes a source that is off. | Phase 3 — Written where context dies |
| 3 | The session key is added and the reader still resolves by recency | implementation | Keying the write is the easy half; a reader that then picks the newest record reintroduces the same collision one layer up, and it would pass a single-session test. | 2.1's verify requires two concurrent sessions in one checkout to each see their own and neither the other's, and requires ambiguity to end in a clean start rather than a guess. | Phase 2 — The record carries a session key |
| 4 | A new host slot is bound against a capability nobody checked | implementation | Both proposals assume compaction and session-end behaviour that differs per host, and binding first is cheaper than refreshing the capability surface first. | 1.2 is ordered before any binding and its verify requires every document to name only slots the host has; the correction it carries is that the slots are bound already and by whom. | Phase 1 — One word per concept |
| 5 | Retiring chat-history capture breaks the only cross-host transcript | product | It is the largest file in the set and an obvious retirement candidate, and it is the one thing here that has no substitute on hosts with no native transcript. | The goal names it out of scope by decision; the blocker's three options never include it, and 4.1 requires a named replacement before any retirement. | Phase 4 — Retire, and prove the surface shrank |

## Acceptance Criteria

- [x] AC-1 — Each of `envelope` and `handoff` resolves to one concept in the taxonomy, and no line attributes `HANDOFF.md` to the skill-link linter.
- [x] AC-2 — No document names a host slot the host does not have, and both context-ending slots say which concern writes what.
- [x] AC-3 — Two concurrent sessions in one checkout each leave their own record and neither observes the other's; ambiguity ends in a clean start with a stated reason.
- [x] AC-4 — Each of the owner's four questions maps to a named schema field or a stated proxy, the mapping is written down, and the schema gained fields at a bumped version rather than a second schema file.
- [x] AC-4b — A record names its predecessor or states it has none, and an absent named predecessor is refused rather than guessed past.
- [ ] AC-5 — A session ending at a bound slot leaves a record without model spend; a session that did nothing substantive leaves none.
- [ ] AC-6 — A record is consumed at most once, and a stale or foreign one is refused with its reason.
- [ ] AC-7 — After Phase 4 the five end-state numbers in the goal read exactly `0 / 0 / 1 / 1 / 0`, re-derived by command rather than asserted.
- [ ] AC-8 — A change adding a continuity artifact, concern, command or verb without retiring one reddens a check.
