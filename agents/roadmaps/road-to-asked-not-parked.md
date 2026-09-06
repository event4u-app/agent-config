---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Charges +1 active roadmap against a top-level estate of one. Warranted because the four non-kernel surfaces it repairs (blocked-step parking, HANDOFF resume, feature-plan question packs, host ask capability) are each verified-open at 93d63073e, are held by no existing roadmap, and are the exact surfaces the owner named as a hurdle; the kernel half is deliberately excluded and parked as a blocker rather than smuggled in as a step."
estate_offset_exempt: "Offsets nothing. It arrives from an inbox round and retires no roadmap: the two adjacent artefacts it touches are a stub and a later/ file, both of which stay parked on their own owner-gated resume conditions and neither of which this roadmap closes."
---
# Road to asked, not parked

> **Source:** `agents/tmp.old/inbox-2026-09-j/` — verified against the tree at `93d63073e` on 2026-09-05.

## Goal

Today a decision this package needs from its user can end up in three places that are not the user: an inline `blocked-by:` marker in a roadmap file, an `## Open questions` section in a handoff file that no rule obliges the next session to read aloud, and a `{count}` printed instead of a question. This roadmap moves every one of those onto the channel the user is actually watching, one question at a time, and makes the host's own question capability a recorded fact rather than an assumption — so that a later change can route to a native picker without guessing what the host supports. It changes the *channel and the order* of asks; it never changes *whether* an ask happens, and it adds no ask that `no-cheap-questions` would not already permit. Two pieces of work are prevented rather than done: the `pre_tool_use` hook slot the source draft believed unbound is in fact bound on `claude` with fifteen concerns and a per-concern tool filter (`src/scripts/hook_manifest.yaml:1187`), so the guard in Phase 5 is one entry and one script rather than new plumbing; and the source draft's `structured_ask` object cannot be added as written, because every field of `HostCapabilityManifest` is a strict boolean that `asBool` coerces (`src/scripts/_lib/host_capability.ts:83-85`) — Phase 2 carries the corrected shape. The whole kernel half — rewriting `user-interaction.md` or `ask-when-uncertain.md`, and changing the decision sheet's `A/B/C` answer shape — is excluded by construction and parked as blockers, because a locked kernel rule is owner-reserved and a sixteen-day-old stub already holds that exact delta. Someone else can tell whether this happened by running the Phase 1 census twice: once now, once after Phase 4, and finding the `file-parked` and `count-only` classes at zero with the `blocked-by:` markers that remain each carrying a recorded reason for not asking.

## Phase 1 — Measure the ask surface before changing it

- [ ] **1.1 Extend `src/scripts/probe_unblocked_ask.ts` with a `form` dimension** that partitions hand-back ask turns into `text` and `native`, where `native` means the turn carries a tool call whose name matches the host's structured-ask tool. The probe already partitions ask turns and already excludes numbered-block turns (`:20-45`); this adds one axis to an existing instrument rather than a second instrument, which is the constraint its own header sets.
      verify: `./scripts-run src/scripts/probe_unblocked_ask --help` names the new dimension, and a run over the existing transcript corpus prints a `form:` breakdown whose `text + native` sum equals the pre-change ask-turn total.
- [ ] **1.2 Add one census script beside the four existing `*_census.ts`** that classifies every ask block in `src/domains/**/command.md`, `src/skills/**`, and `src/agent-src/contexts/**` into `single`, `batch`, `count-only`, `file-parked`. The script publishes its own classification definition in its module header before it publishes any number, and it writes a frozen baseline artefact under `agents/evidence/analysis/` pinned to the commit it ran at. `corrected-from-reproduction`: the source draft's figure of 157 batch-shaped commands does not reproduce — the natural grep returns 129 — so no count is carried forward from the draft and the census defines its own unit.
      verify: the script runs to exit 0, its output artefact exists with a commit pin, and re-running it at the same commit produces a byte-identical artefact.
- [ ] **1.3 Record the four baseline numbers and the native-ask rate in the census artefact** as the only figures any later phase may cite.
      verify: `grep -c 'single\|batch\|count-only\|file-parked' <artefact>` returns all four classes present, and no phase below cites a number absent from that file.

## Phase 2 — Make the host's ask capability a recorded fact

- [ ] **2.1 Add a structured-ask capability to `src/scripts/_lib/host_capability.ts` in a shape the normalizer can actually carry.** `corrected-from-reproduction`: the source draft proposed a nested object; the interface at `:43-71` is `schema_version` plus six strict booleans and `asBool` at `:83-85` coerces every non-`true` value to `false`, so a nested object would normalize silently to nothing. Add `structured_ask: boolean` to the interface and `SAFE_DEFAULT` (false, so an unknown host degrades to text and never fires a call into a host that has no such tool), and put the per-host shape — tool name, question and option ceilings, free-text availability — in a separate typed record that `normalizeHostManifest` reads explicitly.
      verify: `task typecheck` passes; a unit test asserts `resolveHostCapabilities('<unknown-host>').structured_ask === false`; a second asserts that passing a non-boolean for the field yields `false` rather than a truthy object.
- [ ] **2.2 Do not write any registry row from documentation.** The manifest's observation protocol requires a real session with a transcript. Ship Phase 2 with zero `structured_ask: true` rows and a header comment naming the protocol as the only path to the first row.
      verify: `grep -c 'structured_ask: true' src/scripts/_lib/host_capability.ts` returns 0 at merge, and the header comment names the observation protocol.
- [ ] **2.3 Print the field with its provenance in `routing:doctor`,** so a session can tell a `false` that means "observed absent" from a `false` that means "nobody answered".
      verify: `agent-config routing:doctor` output contains the field with one of `registry` / `live-probe` / `default` beside it.
- [ ] **2.4 Add a Codex row to `docs/enforcement-by-host.md`.** The installer detects Codex (`src/install/toolDetection.ts:46`) and the host matrix at `:18-26` lists seven hosts, none of them Codex — so a reader concludes Codex is unsupported when it is merely unlisted.
      verify: `grep -c -i codex docs/enforcement-by-host.md` is greater than 0, and the new row states runtime hook enforcement honestly rather than by analogy to Claude.

## Phase 3 — Ask before park

- [ ] **3.1 Put an ask step in front of the `blocked-by:` marker for the user-decision class.** `src/agent-src/contexts/execution/terminal-states.md:19` defines `blocked` to include "a decision only the user can make", and `src/agent-src/contexts/execution/roadmap-process-loop.md:323,327` writes and reads the inline marker with no ask in between. Change the loop so a step blocked on a user decision is put to the user first on an interactive host; only a decline, a timeout, or a non-interactive context writes the marker.
      verify: the marker grammar accepts an `asked:` field; a fixture run in a non-interactive context writes `asked: no` with a reason, and a fixture run on an interactive host records the question having been put before any marker is written.
- [ ] **3.2 A timeout or a non-interactive context is never consent.** Where the ask cannot be completed, the run ends in `approval-required` — a state `terminal-states.md` already defines — with the question and its conservative default in plain text. Never adopt the default silently.
      verify: a fixture with a simulated timeout ends in `approval-required` and its output contains the unanswered question verbatim; no fixture path adopts a default without an answer.
- [ ] **3.3 Oblige a resuming session to put `HANDOFF.md` `## Open questions` to the user, one at a time, before it works.** The section at `src/domains/meta/agent-handoff/command.md:171-173` carries a must-not-drop obligation, and the linter at `:181-185` only checks the section is non-blank — so a `?`-terminated question satisfies every gate while never reaching the user. Answers move into `## Decisions`.
      verify: the resume path in the command file states the obligation; a fixture handoff carrying two questions produces two separate asks before the first work step, and both answers appear under `## Decisions`.
- [ ] **3.4 Stop `## Open Questions` in `src/agent-src/templates/features.md:91` from reading as a parking lot** by stating in the template that entries there are questions still owed to the user, not a permanent section.
      verify: the template line states the obligation, and the sentence names the ask channel rather than the file.

## Phase 4 — Stop asking in packs

- [ ] **4.1 Split `/feature:plan` Rounds 1, 2 and 4 into one decision per ask.** `src/domains/engineering-base/feature/plan/command.md:195` instructs "Ask 1–2 questions at a time" and Round 1 at `:197-203` then asks three; Round 4 at `:225-232` lists N open questions and closes with one collective question, which is the shape the owner named as the hurdle.
      verify: the census from 1.2 re-run over `feature/plan/command.md` reports `batch: 0` for that file.
- [ ] **4.2 Turn `OPEN QUESTIONS: {count}` into a summary that follows the asking, never a substitute for it** — `src/domains/engineering-base/feature/refactor/command.md:78` and `src/domains/engineering-base/feature/plan/command.md:311`.
      verify: the census reports `count-only: 0` across `src/domains`, and each surviving count line is preceded in its own command file by the instruction to ask first.
- [ ] **4.3 Re-run the Phase 1 census and record the delta against the frozen baseline.**
      verify: the second census artefact shows `count-only` and `file-parked` at 0 and `batch` strictly below the baseline; the two artefacts are diffable and both carry commit pins.

## Phase 5 — One question per call, where the host honours a deny

- [ ] **5.1 Add a `pre_tool_use` concern that denies a structured-ask tool call carrying more than one question.** `corrected-from-reproduction`: this is one entry in `src/scripts/hook_manifest.yaml` under the `claude` platform's existing `pre_tool_use` list (`:1187`, fifteen concerns) plus one script under `src/scripts/hooks/`, using the per-concern `tools:` filter that seven concerns already use (`block-no-verify` at `:167-172` is the shape). The source draft believed the slot unbound and scoped this as new plumbing; it is not. Deny with a stated reason rather than silently truncating to the first question — a truncation hides the questions that were dropped.
      verify: a hook fixture with a two-question payload returns the block exit code with a reason string; a one-question payload passes; `./scripts-run src/scripts/lint_hook_manifest` stays green.
- [ ] **5.2 State the enforcement reach honestly in the concern's own header and in `docs/enforcement-by-host.md`:** bound on the platforms the manifest lists, honoured as a deny only where the host honours one. Do not claim a guard on a host that ignores the dispatcher's verdict.
      verify: `agent-config hooks:status` output and the concern header agree on which platforms bind the slot, and neither claims a deny on a platform that discards dispatcher output.

## Blockers

### blocker: kernel-ask-form-authority

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — it names kernel-rule work excluded by construction and already parked as `agents/roadmaps/stubs/road-to-batch-elicitation-kernel-delta.md`.
- **Recommendation:** none; this is the owner's call — moving ask-form authority out of `user-interaction.md` / `ask-when-uncertain.md` is a kernel edit, and the parked stub already names this exact authority question.
- **If you do nothing:** the kernel rules keep prescribing a text numbered-options block as the only ask form; the contract decision sheet's option `B` answer shape (`"1=x, 2=y"`) stays in tension with `user-interaction.md:53`; and the stub, open since 2026-08-20, stays open.
- **What to do:**
  1. Read `agents/roadmaps/stubs/road-to-batch-elicitation-kernel-delta.md` and rule on the ask-form-authority delta it names — authorize, decline, or defer with a reason.
  2. If authorized, route the edit through the kernel-edit path (`src/agent-src/contexts/authority/kernel-rule-edits.md`: own PR, soak window); if declined, record the refusal in the stub and here, and resolve the contract-decision-sheet option-`B` contradiction by editing the sheet's shape instead of the kernel rule.
- **Resolved when:** a dated ruling (authorization or refusal) is recorded in `agents/roadmaps/stubs/road-to-batch-elicitation-kernel-delta.md`, and this entry's `Status:` is flipped to `resolved` in the same edit.

`src/rules/user-interaction.md` and `src/rules/ask-when-uncertain.md` are two of the nine locked kernel rules. Both prescribe the ask **form** as a text numbered-options block: `user-interaction.md:21,24-31,35-38` builds both Iron Laws around numbered options and a recommended number, and `ask-when-uncertain.md:39` reads "Numbered options (per user-interaction). Short." Moving the form authority out of those rules — into a contract, into a host capability, or anywhere else — is a kernel edit. `block-kernel-rule-writes` denies it at tool-call time, and the kernel-edit guarantee requires its own PR and a soak window that no autonomous run may shorten or self-authorize.

A closely-related delta is already parked on the owner: `agents/roadmaps/stubs/road-to-batch-elicitation-kernel-delta.md`, transferred 2026-08-20, whose criterion is "the user authorizes or declines the `ask-when-uncertain` delta". This blocker is the same authority question one step wider, and it is recorded here rather than acted on so that no phase above quietly re-opens it.

Two further items sit behind this blocker and must not ship without it:

- The contract decision sheet's option `B` (`src/agent-src/contexts/execution/contract-decision-sheet.md:52`) asks for the answer shape `"1=x, 2=y"`, which `src/rules/user-interaction.md:53` names as a self-check violation. The contradiction is real and confined to option `B`; option `A` is defended by the sheet's own one-keystroke argument at `:57-61`. Resolving it means touching either the sheet's shape or the kernel rule's clause.
- The source drafts propose five new Iron Laws. Adding an Iron Law to a kernel rule is the same class of edit, and one of the five duplicates obligations `no-cheap-questions` already carries.

### blocker: first-structured-ask-observation

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — Phase 2 already ships zero `true` rows on purpose (2.2); this names the future per-host ask-rewrite capability that stays unavailable until the observation happens.
- **Recommendation:** none; this is the owner's call — running a live session per host to observe the structured-ask capability is a decision about spending session time, not something derivable from documentation.
- **If you do nothing:** the `structured_ask` field keeps resolving to its safe default (`false`) on every host, the projection stays byte-identical everywhere, and no per-host ask-block rewrite ever becomes possible.
- **What to do:**
  1. Run one real session per target host and observe whether it exposes a structured-ask tool, per the manifest's observation protocol in `src/scripts/_lib/host_capability.ts`.
  2. Record the observed result as the first `structured_ask: true` (or confirmed-`false`) row with its provenance, then flip `Status:` to `resolved`.
- **Resolved when:** at least one host carries an observed (not assumed) `structured_ask` row with provenance recorded, and `Status:` is flipped in the same edit.

Phase 2 ships the capability field with no `true` row, because the host-capability manifest's observation protocol requires a capability to be established in a real session with a transcript rather than copied from documentation. Writing the first row, and therefore enabling any per-host rewrite of an ask block, needs one observed session per host. Until that observation exists, the projection stays byte-identical everywhere and the capability resolves to its safe default.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Asking before parking raises the ask count | product | Phase 3 converts a silently-parked decision into a question the user must answer, which is the opposite of the standing direction to ask less. If it lands as extra interruptions the user experiences a regression, not a fix. | The conversion is channel-only: every question Phase 3 puts to the user is one the tree already decided was owed. The `no-cheap-questions` Pre-Send Self-Check runs first and drops any ask it would have dropped before. Phase 4 removes packs in the same roadmap, so the number of ask *turns* is measured by 1.1 in both directions. | Phase 3 — Ask before park |
| 2 | The census defines its unit badly and the delta means nothing | implementation | A classification that counts `1.`-lines instead of decision blocks produces a number that moves without the surface moving — the exact failure that made the source draft's figure irreproducible. | 1.2 requires the definition to be published in the module header before any count, and 4.3 compares two artefacts produced by the same script at two pins rather than a number quoted in prose. | Phase 1 — Measure the ask surface before changing it |
| 3 | The capability field is added and never observed | implementation | A `structured_ask` field that permanently resolves to its safe default is dead weight that reads like a capability. | 2.2 ships zero true rows deliberately and names the protocol; the `first-structured-ask-observation` blocker records the condition explicitly rather than leaving the field to rot silently. | Phase 2 — Make the host's ask capability a recorded fact |
| 4 | The one-question guard denies a legitimate call and stalls a run | implementation | A deny on a slot that already carries fifteen concerns is on the critical path of every tool call; a false positive blocks work rather than shaping it. | 5.1 requires a passing one-question fixture alongside the failing two-question one, and the concern uses the existing per-concern `tools:` filter so it never sees a call it does not target. | Phase 5 — One question per call, where the host honours a deny |
| 5 | Phase 4 edits drift into the kernel's form prescription | implementation | De-batching a command's rounds is one edit away from restating the ask form, which is kernel-owned and blocked. | Phase 4 changes only how many decisions a block carries, never how a block is rendered; the `kernel-ask-form-authority` blocker names the boundary and the census classes measure count, not form. | Phase 4 — Stop asking in packs |

## Acceptance Criteria

- [ ] AC-1 — The census artefact exists at a named path with a commit pin, its classification definition is stated in the script header, and re-running it at that pin is byte-identical.
- [ ] AC-2 — `probe_unblocked_ask` reports a `form` breakdown whose classes sum to its own ask-turn total.
- [ ] AC-3 — `HostCapabilityManifest` carries a structured-ask field that resolves to its safe default for an unknown host and for a non-boolean input, with zero `true` rows in the registry.
- [ ] AC-4 — `docs/enforcement-by-host.md` contains a Codex row.
- [ ] AC-5 — No `blocked-by:` marker of the user-decision class can be written without an `asked:` field recording whether the question was put and, if not, why.
- [ ] AC-6 — A resume from a handoff carrying open questions puts each one to the user separately before the first work step, and the answers are recorded under `## Decisions`.
- [ ] AC-7 — The post-change census reports `count-only: 0` and `file-parked: 0` across `src/domains` and `src/agent-src/contexts`, with `batch` strictly below the frozen baseline.
- [ ] AC-8 — A two-question structured-ask payload is denied with a stated reason on a platform that honours a deny, and a one-question payload passes; `lint_hook_manifest` is green.
- [ ] AC-9 — No file under `src/rules/` is modified by this roadmap, and both blockers stand open with a named owner.
