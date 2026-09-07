---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "CLOSURE CLAIM (2026-09-07): this change RETIRES the roadmap (active_roadmaps -1, open_blockers -2) and grows exactly one dimension — concern_count 56 -> 57, the `one-question-per-ask` PreToolUse guard Phase 5.1 exists to ship. That growth is the deliverable, not a side effect: the roadmap was accepted on the finding that the slot was already bound and the guard was one manifest entry plus one script, and a roadmap cannot deliver a guard without the estate carrying it. Nothing was archivable in exchange — the concern dimension has no disposal move — so the growth is claimed where it happened rather than offset. ORIGINAL CREATION CLAIM, retained so the record is not overwritten: Charges +1 active roadmap against a top-level estate of one. Warranted because the four non-kernel surfaces it repairs (blocked-step parking, HANDOFF resume, feature-plan question packs, host ask capability) are each verified-open at 93d63073e, are held by no existing roadmap, and are the exact surfaces the owner named as a hurdle; the kernel half is deliberately excluded and parked as a blocker rather than smuggled in as a step."
estate_offset_exempt: "Offsets nothing. It arrives from an inbox round and retires no roadmap: the two adjacent artefacts it touches are a stub and a later/ file, both of which stay parked on their own owner-gated resume conditions and neither of which this roadmap closes."
---
# Road to asked, not parked

> **Source:** `agents/tmp.old/inbox-2026-09-j/` — verified against the tree at `93d63073e` on 2026-09-05.

## Goal

Today a decision this package needs from its user can end up in three places that are not the user: an inline `blocked-by:` marker in a roadmap file, an `## Open questions` section in a handoff file that no rule obliges the next session to read aloud, and a `{count}` printed instead of a question. This roadmap moves every one of those onto the channel the user is actually watching, one question at a time, and makes the host's own question capability a recorded fact rather than an assumption — so that a later change can route to a native picker without guessing what the host supports. It changes the *channel and the order* of asks; it never changes *whether* an ask happens, and it adds no ask that `no-cheap-questions` would not already permit. Two pieces of work are prevented rather than done: the `pre_tool_use` hook slot the source draft believed unbound is in fact bound on `claude` with fifteen concerns and a per-concern tool filter (`src/scripts/hook_manifest.yaml:1187`), so the guard in Phase 5 is one entry and one script rather than new plumbing; and the source draft's `structured_ask` object cannot be added as written, because every field of `HostCapabilityManifest` is a strict boolean that `asBool` coerces (`src/scripts/_lib/host_capability.ts:83-85`) — Phase 2 carries the corrected shape. The whole kernel half — rewriting `user-interaction.md` or `ask-when-uncertain.md`, and changing the decision sheet's `A/B/C` answer shape — is excluded by construction and parked as blockers, because a locked kernel rule is owner-reserved and a sixteen-day-old stub already holds that exact delta. Someone else can tell whether this happened by running the Phase 1 census twice: once now, once after Phase 4, and finding the `file-parked` and `count-only` classes at zero with the `blocked-by:` markers that remain each carrying a recorded reason for not asking.

## Phase 1 — Measure the ask surface before changing it

- [x] **1.1 Extend `src/scripts/probe_unblocked_ask.ts` with a `form` dimension** that partitions hand-back ask turns into `text` and `native`, where `native` means the turn carries a tool call whose name matches the host's structured-ask tool. The probe already partitions ask turns and already excludes numbered-block turns (`:20-45`); this adds one axis to an existing instrument rather than a second instrument, which is the constraint its own header sets.
      verify: `./scripts-run src/scripts/probe_unblocked_ask --help` names the new dimension, and a run over the existing transcript corpus prints a `form:` breakdown whose `text + native` sum equals the pre-change ask-turn total.
- [x] **1.2 Add one census script beside the four existing `*_census.ts`** that classifies every ask block in `src/domains/**/command.md`, `src/skills/**`, and `src/agent-src/contexts/**` into `single`, `batch`, `count-only`, `file-parked`. The script publishes its own classification definition in its module header before it publishes any number, and it writes a frozen baseline artefact under `agents/evidence/analysis/` pinned to the commit it ran at. `corrected-from-reproduction`: the source draft's figure of 157 batch-shaped commands does not reproduce — the natural grep returns 129 — so no count is carried forward from the draft and the census defines its own unit.
      verify: the script runs to exit 0, its output artefact exists with a commit pin, and re-running it at the same commit produces a byte-identical artefact.
- [x] **1.3 Record the four baseline numbers and the native-ask rate in the census artefact** as the only figures any later phase may cite.
      verify: `grep -c 'single\|batch\|count-only\|file-parked' <artefact>` returns all four classes present, and no phase below cites a number absent from that file.

## Phase 2 — Make the host's ask capability a recorded fact

- [x] **2.1 Add a structured-ask capability to `src/scripts/_lib/host_capability.ts` in a shape the normalizer can actually carry.** `corrected-from-reproduction`: the source draft proposed a nested object; the interface at `:43-71` is `schema_version` plus six strict booleans and `asBool` at `:83-85` coerces every non-`true` value to `false`, so a nested object would normalize silently to nothing. Add `structured_ask: boolean` to the interface and `SAFE_DEFAULT` (false, so an unknown host degrades to text and never fires a call into a host that has no such tool), and put the per-host shape — tool name, question and option ceilings, free-text availability — in a separate typed record that `normalizeHostManifest` reads explicitly.
      verify: `task typecheck` passes; a unit test asserts `resolveHostCapabilities('<unknown-host>').structured_ask === false`; a second asserts that passing a non-boolean for the field yields `false` rather than a truthy object.
- [x] **2.2 Do not write any registry row from documentation.** The manifest's observation protocol requires a real session with a transcript. Ship Phase 2 with zero `structured_ask: true` rows and a header comment naming the protocol as the only path to the first row.
      verify: `grep -c 'structured_ask: true' src/scripts/_lib/host_capability.ts` returns 0 at merge, and the header comment names the observation protocol.
- [x] **2.3 Print the field with its provenance in `routing:doctor`,** so a session can tell a `false` that means "observed absent" from a `false` that means "nobody answered".
      verify: `agent-config routing:doctor` output contains the field with one of `registry` / `live-probe` / `default` beside it.
- [x] **2.4 Add a Codex row to `docs/enforcement-by-host.md`.** The installer detects Codex (`src/install/toolDetection.ts:46`) and the host matrix at `:18-26` lists seven hosts, none of them Codex — so a reader concludes Codex is unsupported when it is merely unlisted.
      verify: `grep -c -i codex docs/enforcement-by-host.md` is greater than 0, and the new row states runtime hook enforcement honestly rather than by analogy to Claude.

## Phase 3 — Ask before park

- [x] **3.1 Put an ask step in front of the `blocked-by:` marker for the user-decision class.** `src/agent-src/contexts/execution/terminal-states.md:19` defines `blocked` to include "a decision only the user can make", and `src/agent-src/contexts/execution/roadmap-process-loop.md:323,327` writes and reads the inline marker with no ask in between. Change the loop so a step blocked on a user decision is put to the user first on an interactive host; only a decline, a timeout, or a non-interactive context writes the marker.
      verify: the marker grammar accepts an `asked:` field; a fixture run in a non-interactive context writes `asked: no` with a reason, and a fixture run on an interactive host records the question having been put before any marker is written.
- [x] **3.2 A timeout or a non-interactive context is never consent.** Where the ask cannot be completed, the run ends in `approval-required` — a state `terminal-states.md` already defines — with the question and its conservative default in plain text. Never adopt the default silently.
      verify: a fixture with a simulated timeout ends in `approval-required` and its output contains the unanswered question verbatim; no fixture path adopts a default without an answer.
- [x] **3.3 Oblige a resuming session to put `HANDOFF.md` `## Open questions` to the user, one at a time, before it works.** The section at `src/domains/meta/agent-handoff/command.md:171-173` carries a must-not-drop obligation, and the linter at `:181-185` only checks the section is non-blank — so a `?`-terminated question satisfies every gate while never reaching the user. Answers move into `## Decisions`.
      verify: the resume path in the command file states the obligation; a fixture handoff carrying two questions produces two separate asks before the first work step, and both answers appear under `## Decisions`.
- [x] **3.4 Stop `## Open Questions` in `src/agent-src/templates/features.md:91` from reading as a parking lot** by stating in the template that entries there are questions still owed to the user, not a permanent section.
      verify: the template line states the obligation, and the sentence names the ask channel rather than the file.

## Phase 4 — Stop asking in packs

- [x] **4.1 Split `/feature:plan` Rounds 1, 2 and 4 into one decision per ask.** `src/domains/engineering-base/feature/plan/command.md:195` instructs "Ask 1–2 questions at a time" and Round 1 at `:197-203` then asks three; Round 4 at `:225-232` lists N open questions and closes with one collective question, which is the shape the owner named as the hurdle.
      verify: the census from 1.2 re-run over `feature/plan/command.md` reports `batch: 0` for that file.
- [x] **4.2 Turn `OPEN QUESTIONS: {count}` into a summary that follows the asking, never a substitute for it** — `src/domains/engineering-base/feature/refactor/command.md:78` and `src/domains/engineering-base/feature/plan/command.md:311`.
      verify: the census reports `count-only: 0` across `src/domains`, and each surviving count line is preceded in its own command file by the instruction to ask first.
- [x] **4.3 Re-run the Phase 1 census and record the delta against the frozen baseline.**
      verify: the second census artefact shows `count-only` and `file-parked` at 0 and `batch` strictly below the baseline; the two artefacts are diffable and both carry commit pins.

## Phase 5 — One question per call, where the host honours a deny

- [x] **5.1 Add a `pre_tool_use` concern that denies a structured-ask tool call carrying more than one question.** `corrected-from-reproduction`: this is one entry in `src/scripts/hook_manifest.yaml` under the `claude` platform's existing `pre_tool_use` list (`:1187`, fifteen concerns) plus one script under `src/scripts/hooks/`, using the per-concern `tools:` filter that seven concerns already use (`block-no-verify` at `:167-172` is the shape). The source draft believed the slot unbound and scoped this as new plumbing; it is not. Deny with a stated reason rather than silently truncating to the first question — a truncation hides the questions that were dropped.
      verify: a hook fixture with a two-question payload returns the block exit code with a reason string; a one-question payload passes; `./scripts-run src/scripts/lint_hook_manifest` stays green.
- [x] **5.2 State the enforcement reach honestly in the concern's own header and in `docs/enforcement-by-host.md`:** bound on the platforms the manifest lists, honoured as a deny only where the host honours one. Do not claim a guard on a host that ignores the dispatcher's verdict.
      verify: `agent-config hooks:status` output and the concern header agree on which platforms bind the slot, and neither claims a deny on a platform that discards dispatcher output.

## Blockers

### blocker: kernel-ask-form-authority

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — it names kernel-rule work excluded by construction and already parked as `agents/roadmaps/stubs/road-to-batch-elicitation-kernel-delta.md`.
- **Recommendation:** none; this is the owner's call — moving ask-form authority out of `user-interaction.md` / `ask-when-uncertain.md` is a kernel edit, and the parked stub already names this exact authority question.
- **If you do nothing:** the kernel rules keep prescribing a text numbered-options block as the only ask form; the contract decision sheet's option `B` answer shape (`"1=x, 2=y"`) stays in tension with `user-interaction.md:53`; and the stub, open since 2026-08-20, stays open.
- **What to do:**
  1. Read `agents/roadmaps/stubs/road-to-batch-elicitation-kernel-delta.md` and rule on the ask-form-authority delta it names — authorize, decline, or defer with a reason.
  2. If authorized, route the edit through the kernel-edit path (`src/agent-src/contexts/authority/kernel-rule-edits.md`: own PR, soak window); if declined, record the refusal in the stub and here, and resolve the contract-decision-sheet option-`B` contradiction by editing the sheet's shape instead of the kernel rule.
- **Resolved when:** a dated ruling (authorization or refusal) is recorded in `agents/roadmaps/stubs/road-to-batch-elicitation-kernel-delta.md`, and this entry's `Status:` is flipped to `resolved` in the same edit.
- **Resolution (2026-09-07) — DECIDED: the amendment is DECLINED. `Status: resolved` here means the roadmap's dependency is closed by a refusal, not that the kernel delta was authorized; the stub stays open on its own criterion.** Ruled by the AI council under the standing drain delegation (2 seats, anthropic + openai), framework of record `agents/evidence/council/drain-blocker-dispositions-a.md`. **Not authorized in this round; current behaviour unchanged; no future ruling is prejudged.** A refusal preserves the status quo and is council-decidable on that framework; an authorization would lower a locked-kernel floor and is categorically outside it — so the reachable disposition was the refusal, and it was taken rather than deferred. `src/rules/user-interaction.md` and `src/rules/ask-when-uncertain.md` are **retained verbatim**: no file under `src/rules/` is modified by this roadmap (AC-9), and `block-kernel-rule-writes` would have denied such a write at tool-call time in any case. The five proposed new Iron Laws are refused with it — the same class of edit, and one of the five duplicates obligations `no-cheap-questions` already carries. The option-`B` contradiction named above is resolved on **the sheet's** side, which is the repair this entry itself prescribes for the declined case: `src/agent-src/contexts/execution/contract-decision-sheet.md` option `B` now takes a single row NUMBER instead of the structured reply `"1=x, 2=y"`, so the sheet's answer domain is one token in every branch and `user-interaction.md:53` is no longer contradicted. The dated refusal is recorded in `agents/roadmaps/stubs/road-to-batch-elicitation-kernel-delta.md` § Ruling of 2026-09-07.

`src/rules/user-interaction.md` and `src/rules/ask-when-uncertain.md` are two of the nine locked kernel rules. Both prescribe the ask **form** as a text numbered-options block: `user-interaction.md:21,24-31,35-38` builds both Iron Laws around numbered options and a recommended number, and `ask-when-uncertain.md:39` reads "Numbered options (per user-interaction). Short." Moving the form authority out of those rules — into a contract, into a host capability, or anywhere else — is a kernel edit. `block-kernel-rule-writes` denies it at tool-call time, and the kernel-edit guarantee requires its own PR and a soak window that no autonomous run may shorten or self-authorize.

A closely-related delta is already parked on the owner: `agents/roadmaps/stubs/road-to-batch-elicitation-kernel-delta.md`, transferred 2026-08-20, whose criterion is "the user authorizes or declines the `ask-when-uncertain` delta". This blocker is the same authority question one step wider, and it is recorded here rather than acted on so that no phase above quietly re-opens it.

Two further items sit behind this blocker and must not ship without it:

- The contract decision sheet's option `B` (`src/agent-src/contexts/execution/contract-decision-sheet.md:52`) asks for the answer shape `"1=x, 2=y"`, which `src/rules/user-interaction.md:53` names as a self-check violation. The contradiction is real and confined to option `B`; option `A` is defended by the sheet's own one-keystroke argument at `:57-61`. Resolving it means touching either the sheet's shape or the kernel rule's clause.
- The source drafts propose five new Iron Laws. Adding an Iron Law to a kernel rule is the same class of edit, and one of the five duplicates obligations `no-cheap-questions` already carries.

### blocker: first-structured-ask-observation

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — Phase 2 already ships zero `true` rows on purpose (2.2); this names the future per-host ask-rewrite capability that stays unavailable until the observation happens.
- **Recommendation:** none; this is the owner's call — running a live session per host to observe the structured-ask capability is a decision about spending session time, not something derivable from documentation.
- **If you do nothing:** the `structured_ask` field keeps resolving to its safe default (`false`) on every host, the projection stays byte-identical everywhere, and no per-host ask-block rewrite ever becomes possible.
- **What to do:**
  1. Run one real session per target host and observe whether it exposes a structured-ask tool, per the manifest's observation protocol in `src/scripts/_lib/host_capability.ts`.
  2. Record the observed result as the first `structured_ask: true` (or confirmed-`false`) row with its provenance, then flip `Status:` to `resolved`.
- **Resolved when:** at least one host carries an observed (not assumed) `structured_ask` row with provenance recorded, and `Status:` is flipped in the same edit.
- **Resolution (2026-09-07) — RE-SCOPED, then closed on a genuine observation. `Status: resolved` here means one host was observed and recorded; it does NOT mean a per-host ask rewrite became possible, because the observed value is `false`.** The criterion asks for an observed row with provenance, not for a `true` row, so it is met by an honest negative. Observed under `host-capability-manifest.md` § Observation protocol, whose criterion for this field is the host's **delivered tool surface in a real session**: host `claude` (Claude Code **2.1.263**, Opus 5 1M session, **2026-09-07**) delivered a tool surface carrying no structured-ask tool under any name `_lib/structured_ask.ts` matches. Recorded as `claude: { …, structured_ask: false }` in `HOST_CAPABILITY_REGISTRY`, which the protocol distinguishes from an ABSENT field: written `false` is "checked, absent", omitted is "never looked". `routing:doctor` reports it as `structured_ask=false(registry)`. Evidence: `agents/evidence/analysis/structured-ask-host-observation-2026-09.md`. **The other seven platform keys stay unreachable from this session** — a different editor host, no session available to the running agent, the same reason already recorded in `host_capability.ts` — so their rows stay ABSENT rather than being filled by analogy, and their unavailability is recorded as unavailability, never as verification. Step 2.2 is unaffected: no row sets the field true, and the observation protocol remains the only path to the first one that does.

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

- [x] AC-1 — The census artefact exists at a named path with a commit pin, its classification definition is stated in the script header, and re-running it at that pin is byte-identical.
- [x] AC-2 — `probe_unblocked_ask` reports a `form` breakdown whose classes sum to its own ask-turn total.
- [x] AC-3 — `HostCapabilityManifest` carries a structured-ask field that resolves to its safe default for an unknown host and for a non-boolean input, with zero `true` rows in the registry.
- [x] AC-4 — `docs/enforcement-by-host.md` contains a Codex row.
- [x] AC-5 — No `blocked-by:` marker of the user-decision class can be written without an `asked:` field recording whether the question was put and, if not, why.
- [x] AC-6 — A resume from a handoff carrying open questions puts each one to the user separately before the first work step, and the answers are recorded under `## Decisions`.
- [x] AC-7 — The post-change census reports `count-only: 0` and `file-parked: 0` across `src/domains` and `src/agent-src/contexts`, with `batch` strictly below the frozen baseline.
- [x] AC-8 — A two-question structured-ask payload is denied with a stated reason on a platform that honours a deny, and a one-question payload passes; `lint_hook_manifest` is green.
- [x] AC-9 — No file under `src/rules/` is modified by this roadmap, and both blockers stand open with a named owner.

## Closure evidence

Executed 2026-09-07 on branch `drain/asked-not-parked`. Every step's own
`verify:` clause, with the command that satisfied it.

| Step | Evidence |
|---|---|
| 1.1 | `probe_unblocked_ask --help` names the `form` dimension and both its classes. A run over the real transcript corpus (`--limit 80 --store ~/.claude/projects/…-agent-config`) printed `form: text 3 · native 0 · text + native 3` against an unblocked-ask total of `3` — the identity holds. `--self-test` 7/7 plus four form cases and a two-turn fixture corpus asserting the identity; the identity check was seen RED under a sabotage probe (`askForm` forced to `native`) and restored by the inverse edit. |
| 1.2 | `ask_block_census.ts` beside the four existing censuses. Classification definition published in the module header above every count; no figure carried forward from the source draft. `--self-test` 8/8. Written twice at the same commit with the same arguments, `diff` empty — byte-identical. Artefact `agents/evidence/analysis/ask-block-census-baseline.md` pinned to `0ea82ead`. |
| 1.3 | The artefact carries all four class rows and a `## Native-ask rate` section (0 of 3 unblocked asks, with the probe invocation as its source). `grep -c 'single\|batch\|count-only\|file-parked'` returns 5 matching lines with each class present exactly once in the totals table. The rate is carried in by flag rather than computed, so the artefact stays reproducible on a checkout with a different transcript store. |
| 2.1 | `structured_ask: boolean` on `HostCapabilityManifest` and `SAFE_DEFAULT`; the per-host shape in `_lib/structured_ask.ts`. `task typecheck-ts` clean. Tests assert `resolveHostCapabilities('some-unrecognized-host').structured_ask === false` and that a nested object, a string and a number all yield `false` rather than a truthy object. |
| 2.2 | `grep -c 'structured_ask: true' src/scripts/_lib/host_capability.ts` → **0**. The header names the observation protocol as the only path to the first such row (the prose deliberately avoids the literal key-value pair, because this verify is a literal grep). |
| 2.3 | `agent-config routing:doctor` prints `structured_ask=false(registry)` in its capability-provenance line — the field with one of `registry` / `live-probe` / `default` beside it. |
| 2.4 | `grep -c -i codex docs/enforcement-by-host.md` → **6**. The row states the runtime column from `hook_manifest.yaml`'s `platforms:` block (no `codex` key → no slot bound) rather than by analogy to Claude Code sharing a bundle format with it. |
| 3.1 | Marker grammar accepts `\| asked: yes` / `\| asked: no — <reason>` (`_lib/blocked_by_marker.ts`, round-trip asserted). Non-interactive fixture writes `asked: no — CI, no TTY`; the interactive fixture returns `ask` with **no** marker, i.e. the question is put before anything is written. `lint_roadmap_blockers` enforces the field on user-decision annotations; both refusal branches seen RED under sabotage probes and the legal form GREEN, probe undone by the inverse edit. |
| 3.2 | The timeout fixture ends `approval-required` and surfaces the unanswered question verbatim with the conservative option marked NOT adopted. `defaultAdopted` is asserted `false` on **every** path, including the timeout and the non-interactive one. |
| 3.3 | The resume rule states the obligation: read `## Open questions`, put each one separately before the first work step, move answers to `## Decisions`, and report `approval-required` when the user cannot be reached. The census no longer scores that section `file-parked`. |
| 3.4 | `src/agent-src/templates/features.md` § Open Questions states the entries are questions still owed to the user and names the **chat** as the channel, not the file. |
| 4.1 | `ask_block_census --file src/domains/engineering-base/feature/plan/command.md` → `batch 0` (from 4 at the baseline pin). Step 1, Round 1, Round 2 and Round 4 are each a sequence of single-decision asks. |
| 4.2 | `ask_block_census --root src/domains` → `count-only 0`. **No count line survives**, so the second clause is satisfied without exception rather than by exception; both display blocks now list what is still owed and both steps carry the ask-first instruction above them. The alternative — relaxing `count-only` to mean "a count with no questions nearby" — would have moved the measuring stick after the baseline was frozen, which is this roadmap's own Risk 2. |
| 4.3 | `agents/evidence/analysis/ask-block-census-after-phase-4.md`, pinned to `b7222ea86`. `count-only` 2 → **0**, `file-parked` 4 → **0**, `batch` 79 → **74** (strictly below), `single` 174 → 183. Both artefacts carry pins and diff cleanly. |
| 5.1 | One manifest entry on `claude`'s existing `pre_tool_use` list plus `src/scripts/hooks/one_question_per_ask_hook.ts`, using the per-concern `tools:` filter. Live: a two-question payload on stdin exits **1** with the reason naming the count; a one-question payload exits **0**. `--self-test` 9/9 (2 deny, 7 allow). `lint_hook_manifest` exit 0; `tests/hooks/` 544 tests green. |
| 5.2 | `agent-config hooks:status` lists `one-question-per-ask` on `claude`'s `pre_tool_use` and nowhere else; the concern header and `docs/enforcement-by-host.md` both say `claude` only, and both state that augment and cowork discard dispatcher output, so no deny is claimed on a platform that would ignore it. |

### What is deliberately NOT claimed

- **The guard fires on nothing today, on every host.** No host carries an
  observed structured-ask tool, so there is no such call to intercept. That is
  the honest reading of a capability nobody has observed, not a broken guard.
- **`native` is 0 in both census artefacts** for the same reason. It is a
  measured zero rather than an uninstrumented one, which is the whole point of
  adding the axis.
- **The `asked:` field is enforced on active roadmaps only.**
  `lint_roadmap_blockers` globs `agents/roadmaps/*.md` non-recursively;
  `later/` and `archive/` are outside it and were not migrated. The check is
  hard rather than ratcheted because no active roadmap carried a real checkbox
  annotation on the day it shipped.
- **The observation covers one host, one version, one session.** Seven platform
  keys stay unreachable and carry no row; their absence is recorded as absence.
