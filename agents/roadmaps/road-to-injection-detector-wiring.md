---
estate_offset_exempt: "Authored by the 2026-08-22 inbox drain, which consumed 25 dropped artefacts carrying 53 pre-written roadmap drafts in one pass. It ships status: draft, so it is not active work and moves none of the three gated metrics; there is nothing yet to offset. The offset alternatives all cost more than this line: no active roadmap sits at zero open steps, so archiving buys nothing; parking these in later/ is what the estate register calls burial and would hide twenty verified defect sets behind a disposition nobody reviews; and terminating another session's roadmap would be a judgement about their work rather than mine. The blockers these drafts carry will charge this ratchet on the day the maintainer flips one to ready, which is the point at which an offset is a real decision. Charged as one reviewable line, per this gate's own instruction."
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
---
# Road to injection detector wiring

> **Source:** agents/tmp.old/promt-injection

## Goal

The PostToolUse prompt-injection scanner detects the encoding channels this
package already measured itself against, reports what it found in a shape a
reader can act on, and the tree stops claiming — in a rule and in
`CAPABILITIES.yaml` — either more or less than the hook actually does. When
this is finished, `src/scripts/injection_scan_hook.ts` imports the shipped
canonicalization layer instead of re-deriving nothing, its warn payload carries
a risk level and the detections behind it, and no prose in the tree says a
content-scanning backstop is still hypothetical. The hook stays warn-only and
default-OFF; nothing here turns it into a gate, and
`untrusted-input-defense`'s `enforced_by: none` stays exactly as it is.

## Context — what the source draft proposed, and what survived

The source draft was 10 phases. Most of what it asked for is already shipped,
already locked by a live decision record, or already refused on measured
grounds. Three slices survived; the cuts are recorded here so the same proposal
does not arrive again unexamined.

**Already shipped, the draft did not know:** a canonicalization and
encoding-detection layer exists and is benchmarked. `src/scripts/_lib/
confusables.ts` (`classifyToken`, `:71`) and `src/scripts/_lib/
retrieval_sanitize.ts` (`sanitize_text`, `:75`; `scan_encoding_findings`,
`:140`) were measured against the frozen corpus at
`internal/bench/corpora/encoding-channels/` — 300 positives, 353 negatives, 15
channels per its `manifest.json` — at recall **99.00 %**
(`agents/evidence/reports/encoding-floor-measurement.md:22`), false-positive
rate **0.00 %** (`:24`) and added p95 **0.018 ms** (`:26`). Eight call sites
already import it (`second_brain_retrieval.ts`, `memory_lookup.ts`,
`lint_hidden_unicode.ts`, `detect_ai_tells.ts`, `ai_team/team_dispatch.ts`,
`_lib/reddit_thread_parse.ts`, `encoding_corpus_report.ts`, and the
`encoding_floor` test). The injection hook imports none of it: it is four
regexes — `_INJECT` (`injection_scan_hook.ts:47`), `_SUPPRESS` (`:54`),
`_EXFIL` (`:59`), `_HIDDEN` (`:75`) — and
`grep -cE "normalize|NFKC|atob|Buffer.from|confusab"` over that file returns
**0**. Phase 1 is one import and a fixture set against a corpus that is already
frozen, which is the highest yield per line in this roadmap by a wide margin.

**Cut — base64 / hex decode inspection.** Already evaluated and refused on
measured grounds during the encoding-hardening work: nested multibase is one of
three channels given **no action** because "base64 is pervasive and legitimate
here" and decoding would create the payload rather than reveal it
(`agents/roadmaps/archive/road-to-runtime-encoding-hardening.md:286`). Adding it
now would re-open a disposition without new evidence.

**Cut — a PreToolUse action firewall and a runtime trifecta guard.** Locked by
`docs/decisions/ADR-123-runtime-security-scope-and-spawn-hardening.md`,
status `accepted`, not superseded. Its §2 (`:61-71`) draws the line: the
inbound scanner is self-defence over data this package *receives*; an outbound
command guard requires interpreting intent from content and is a
runtime-enforcement layer the consumer's tool-execution boundary owns. Its §3
(`:73-79`) defers the outbound guard with three `revisit-if` triggers — a real
outbound-injection incident, a demand signal, or utilization evidence. **None
has fired, and an external draft is not one of them.** This roadmap therefore
does not build it and does not bundle it: the same council that produced ADR-123
named bundling a contested item with an uncontested fix "architectural
sleight-of-hand"
(`agents/roadmaps/archive/road-to-runtime-security-hardening.md:69`). It is
routed to the council as a proposal instead — blocker
`b-adr-123-action-boundary` below.

**Cut — a measured bypass-rate corpus against a named model.**
`src/skills/judge-injection-defense/SKILL.md:116` forbids exactly that: "NEVER
store a measured bypass rate against a named model in a tracked file."

**Never-true, and therefore not a task.** The source asked to "remove claims
that equate a warn-hook with prevention". `CAPABILITIES.yaml` carries **no
prompt-injection claim at all** — its single `injection` match is the skill
name `judge-injection-defense` inside a skills list. There is nothing to
remove. The constructive half survives as Phase 2: the file should carry an
honest per-host vocabulary, because saying nothing is a different defect from
saying too much.

## Phase 1 — Wire the measured layer into the hook, and correct the stale prose

- [ ] **1.1 Import the shipped encoding layer into the scanner.** Add
      `scan_encoding_findings` from `src/scripts/_lib/retrieval_sanitize.ts` to
      `_scan` in `src/scripts/injection_scan_hook.ts`, so the hook detects the
      15 measured channels — confusables, bidi, variation-selector runs,
      fullwidth, math-alphanumeric, punycode — instead of only the codepoint
      set `_HIDDEN_CPS` (`:66`) enumerates. Do NOT reimplement the signature:
      `scan_encoding_findings` is documented (`:134-137`) as sharing
      `classifyToken` precisely so the two surfaces cannot drift.
      verify: `grep -c "retrieval_sanitize" src/scripts/injection_scan_hook.ts`
      returns ≥ 1, and `git show HEAD:src/scripts/injection_scan_hook.ts | grep
      -c "retrieval_sanitize"` returned 0 before the change.
- [ ] **1.2 Do not mutate tool output.** The hook reports; it must not strip.
      Use `scan_encoding_findings` (documented "Never mutates it",
      `retrieval_sanitize.ts:133`), never `sanitize_text`, which removes bytes.
      A PostToolUse hook that silently rewrites what the agent read would break
      the one property the warn-only posture rests on.
      verify: `grep -c "sanitize_text" src/scripts/injection_scan_hook.ts`
      returns 0.
- [ ] **1.3 Fixtures against the frozen corpus, not against the detector.**
      Add a test that drives the hook over entries drawn from
      `internal/bench/corpora/encoding-channels/positives.jsonl` and
      `negatives.jsonl`, asserting a per-channel detection count and a
      false-positive count. The corpus is frozen by sha256 in its
      `manifest.json` and its note forbids tuning detectors against it — the
      test reads it, it never regenerates it.
      verify: `npx vitest run tests/hooks/` passes and the new file appears in
      its output.
- [ ] **1.4 Correct the stale enforcement prose.**
      `src/rules/untrusted-input-defense.md:72-73` still reads "no mechanical
      backstop exists today; a future content-scanning hook would be the first
      candidate to change this". That hook shipped. Replace those two lines
      with what is true: a warn-only, default-OFF PostToolUse scanner exists,
      and it is not a gate. **`enforced_by: none` (`:20`) STAYS** — a hook that
      cannot refuse does not enforce, and changing that field would be the
      coverage inflation the same section (`:74`) refuses.
      verify: `grep -c "no mechanical backstop exists today"
      src/rules/untrusted-input-defense.md` returns 0, and `grep -c
      "enforced_by: none" src/rules/untrusted-input-defense.md` still returns
      its pre-change count.

## Phase 2 — Widen the output on the contract that already exists, and say what the tree does

- [ ] **2.1 Extend the warn payload, keeping the contract's shape.**
      `injection_scan_hook.ts:340` emits `{decision:"warn", reason}`. Add
      `risk_level`, `score`, `detections` (the per-channel findings) and
      `latency_ms`. `decision` and `reason` are what the host reads and stay
      byte-compatible; the new keys are additive.
      verify: `npx vitest run tests/hooks/injection_scan_output_contract.test.ts`
      passes with cases asserting each new key.
- [ ] **2.2 Number the widened detector against the same frozen corpus.**
      Record recall and false-positive rate over
      `internal/bench/corpora/encoding-channels/` for the combined
      four-regex-plus-encoding detector, and its p95 against the
      `any_hook_event` budget in `src/config/hook-latency-budget.json`
      (`p95_ci: 250`). A number that does not clear both is a finding, not a
      reason to loosen a budget.
      verify: `test -f agents/evidence/reports/injection-detector-wiring.md`
      and the file states both numbers.
- [ ] **2.3 Give `CAPABILITIES.yaml` an honest per-host vocabulary.** Add a
      row using exactly four states — `detects` / `warns` / `blocks` /
      `not-enforceable-on-host` — for the injection scanner. Today the file
      says nothing, which reads as absence rather than as a warn-only,
      default-OFF posture. `hook_manifest.yaml:130-135` is the ground truth:
      `fail_closed: false`, `severity: advisory`. `blocks` is never a legal
      value for this hook on any host.
      verify: `grep -c "not-enforceable-on-host" CAPABILITIES.yaml` returns
      ≥ 1, and `grep -A6 "injection" CAPABILITIES.yaml` shows no `blocks`.
- [ ] **2.4 No default flip in this roadmap.**
      `src/config/agent-settings.template.yml:1247-1248` stays
      `injection_scan: enabled: false`. Flipping it requires both numbers from
      2.2 inside budget AND a separate decision; a roadmap that ships a
      detector and its own default flip in one change is grading its own
      homework.
      verify: `grep -A1 "injection_scan:"
      src/config/agent-settings.template.yml` still shows `enabled: false`.

## Phase 3 — MCP tool fingerprints (gated, does not start yet)

- [ ] **3.1 Fingerprint store for third-party MCP tool definitions.** Nothing
      in the tree covers rug-pull or tool-shadowing detection at runtime.
      `src/scripts/lint_mcp_config_security.ts` (`:6-19`) reads shipped
      **config** for static smells — inline secrets, `npx -y`, unpinned
      versions, `autoApprove` — and never sees a tool description change after
      connection. `src/scripts/audit_mcp_tools.ts` (`:3-17`) is an inventory
      generator for **this package's own** consumer tool catalog, not a
      third-party integrity monitor. Record a hash per connected third-party
      tool definition and surface a change.
      verify: blocked — see `b-pre-tool-turn-budget`. Do not open this phase
      before that blocker is resolved.
- [ ] **3.2 Slot placement is a measurement, not a preference.** A rug-pull
      check that must run before a tool call is `pre_tool_use`, whose CI budget
      is `p95_ci: 175` (`src/config/hook-latency-budget.json`) and whose
      measured readings in this tree are 141–148 ms
      (`agents/roadmaps/archive/road-to-per-turn-hook-economy.md:270`, `:296`) — i.e.
      the slot is already close to its cap before anything is added.
      verify: blocked — see `b-pre-tool-turn-budget`.

## Blockers

### blocker: b-adr-123-action-boundary
- **Status:** open
- **Owner:** council
- **Blocks:** nothing in this roadmap. Phases 1–3 proceed regardless; this
  blocker exists so the proposal is surfaced rather than silently dropped, and
  so it is NOT bundled into a change that would otherwise ship uncontested.
- **What to do:** pick exactly one — (a) reopen ADR-123 §2's scope line in the
  council on the ground that its empirical rationale has eroded: the ADR
  reasons that this package supervises no tool calls and that the consumer's
  tool-execution layer is the enforcement boundary, but the tree already denies
  at `pre_tool_use` today — `block-no-verify` (`hook_manifest.yaml:143`),
  `block-kernel-rule-writes` (`:160`), `block-config-weakening` (`:176`) and
  `block-unauthorized-git` (`:357`). That is a mechanism difference the ADR did
  not weigh, and reopening it is council-decidable because an added guard
  strengthens a floor rather than lowering one; or (b) leave ADR-123 standing
  unchanged, recording that four existing PreToolUse denials do not amount to
  a general action firewall and that the three `revisit-if` triggers
  (`ADR-123:73-79`) remain the only doors.
- **Recommendation:** **option (a) — put it to the council, and keep it out of
  this roadmap either way.** The erosion is a real mechanism-match argument and
  ADR-123 never answered it; but ADR-123's own council named bundling a
  contested item with an uncontested fix "architectural sleight-of-hand", so
  the answer must arrive as its own record, not as a phase here.
- **If you do nothing:** the argument stays unrecorded and the next external
  draft proposing an action firewall gets the same flat refusal, with the same
  eroded rationale, and no one notices the second time either.
- **Resolved when:** one option is recorded at this blocker, and for (a) a
  council record exists under `agents/evidence/council/` naming the verdict.

### blocker: b-pre-tool-turn-budget
- **Status:** open
- **Owner:** `agents/roadmaps/archive/road-to-per-turn-hook-economy.md`
- **Blocks:** Phase 3 entirely. Phases 1 and 2 are unaffected — they touch a
  `post_tool_use` hook whose budget row is `any_hook_event` (`p95_ci: 250`).
- **What to do:** pick exactly one — (a) wait for that roadmap's step 4.2 to
  register a per-turn composite ceiling, then scope Phase 3 against it; its
  Phase-4 row states in as many words that "there is no ceiling on the per-turn
  number today, and that is deliberate rather than forgotten"
  (`road-to-per-turn-hook-economy.md:32`), so a new `pre_tool_use` concern
  added now is added against no budget at all; or (b) scope Phase 3 to a
  `post_tool_use` or session-start fingerprint check that never runs per tool
  call, accepting that it detects a mutated tool definition after first use
  rather than before it.
- **Recommendation:** **option (a) — wait.** `pre_tool_use` reads 141–148 ms
  against a 175 ms cap, and that cap was itself re-derived after the gate
  flapped on unchanged code; adding a per-call concern into that headroom
  without a registered per-turn number is how the flap comes back. Option (b)
  is a real fallback if the wait proves indefinite, and it is honest about what
  it gives up.
- **If you do nothing:** Phase 3 gets built into the tightest slot in the tree
  with no per-turn budget to measure it against, and the first symptom is a
  gate that goes red on code nobody changed.
- **Resolved when:** one option is recorded at this blocker, and for (a) the
  per-turn composite row exists in `src/config/hook-latency-budget.json`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The widened detector's false-positive rate on real tool output is not the corpus rate | implementation | The 0.00 % FP was measured over 353 in-repo negatives, and the report itself says at `:115` that this is not a guarantee for another corpus. Tool output — web fetches, MCP responses — is a different distribution, and a noisy warn on every fetch trains the reader to ignore it | Step 2.2 records the number rather than assuming it; step 2.4 keeps the default OFF, so a bad rate costs nobody until it is measured and a separate decision is taken | Phase 2 — Widen the output on the contract that already exists, and say what the tree does |
| 2 | Wiring a detector reads as wiring a gate | product | A hook that now names 15 channels and emits a `risk_level` looks like enforcement. If `enforced_by: none` drifts, or `CAPABILITIES.yaml` acquires a `blocks` value, the tree starts claiming a prevention it does not have — the exact inflation `untrusted-input-defense:74` refuses | Step 1.4 pins `enforced_by: none` explicitly as a non-change; step 2.3 fixes `blocks` as never legal for this hook and makes the four-state vocabulary the only way to say it | Phase 1 — Wire the measured layer into the hook, and correct the stale prose |
| 3 | The frozen corpus gets edited to make a test pass | implementation | `internal/bench/corpora/encoding-channels/manifest.json` freezes both files by sha256 and its note forbids tuning detectors against it. A failing fixture is the cheapest thing in the world to "fix" from the wrong side | Step 1.3 reads the corpus and never regenerates it; the sha256 freeze makes an edit visible in the diff | Phase 1 — Wire the measured layer into the hook, and correct the stale prose |
| 4 | Phase 3 starts before its blocker is resolved | implementation | Phase 3 is written out in full, which makes it look startable. Its slot is the one already nearest its cap | Both Phase-3 steps carry `verify: blocked` pointing at `b-pre-tool-turn-budget` instead of a runnable command, so a step that runs cannot be marked done | Phase 3 — MCP tool fingerprints (gated, does not start yet) |

## Acceptance Criteria

- [ ] AC-1 — `src/scripts/injection_scan_hook.ts` imports
      `scan_encoding_findings` from `src/scripts/_lib/retrieval_sanitize.ts`
      and imports nothing that mutates the scanned text, so the hook detects
      the 15 measured channels without rewriting what the agent read.
- [ ] AC-2 — A test file drives the hook over the frozen corpus at
      `internal/bench/corpora/encoding-channels/`, and both corpus files still
      match the sha256 entries in their `manifest.json`.
- [ ] AC-3 — No line in `src/rules/untrusted-input-defense.md` states that a
      content-scanning backstop does not yet exist, and its `enforced_by`
      field still reads `none`.
- [ ] AC-4 — The warn payload carries `risk_level`, `score`, `detections` and
      `latency_ms` alongside the unchanged `decision` and `reason`, with the
      output-contract test asserting each.
- [ ] AC-5 — `agents/evidence/reports/injection-detector-wiring.md` states the
      widened detector's recall, its false-positive rate over the frozen
      corpus, and its p95 against the `any_hook_event` budget.
- [ ] AC-6 — `CAPABILITIES.yaml` describes the injection scanner in the
      four-state vocabulary and never as `blocks`, and
      `src/config/agent-settings.template.yml` still ships
      `injection_scan: enabled: false`.
- [ ] AC-7 — Both blockers carry a recorded option, or Phase 3 is untouched
      and `b-adr-123-action-boundary` is still `open` with its argument stated
      — a proposal that was surfaced and left open is a discharged obligation;
      a proposal that was quietly dropped is not.
