---
complexity: lightweight
status: ready
tree_pin: 811cea61d6
review_by: 2026-12-21
execution:
  mode: autonomous
estate_growth_exempt: "P0 measure 2 of the owner's session retro of 2026-11-21, which the owner ordered planned and executed. The owning step (later/road-to-agent-throughput-recovery 4.1) sits in later/ behind an owner WIP entry condition; this file carries only the missing delta and supersedes stubs/road-to-language-pin-short-lead, which it archives in step 5.2, so the net estate change after 5.2 is zero."
estate_offset_exempt: "road-to-a-language-pin-from-owner-prose is added on the owner's order of 2026-11-21 to plan every measure of that day's session retro as its own roadmap. No active roadmap is finished, so none was archived to offset it, and folding it into a parked later/ roadmap would hold asked-for work behind that roadmap's entry condition. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
relates:
  - slug: road-to-resume-after-limit-hits
    relation: disjoint
    note: "Same-retro sibling (measure 23). Its Phase 1 moves limit-stop and reset-sentence recognition into one `_lib/limit_stop.ts` that the language pin also calls; this file owns what sets the pin (`ownerProse()`), that file owns the limit classifier. Whichever lands second imports the other's helper rather than keep a second literal."
  - slug: road-to-language-pin-short-lead
    relation: supersedes
    note: "The stub's defect (a short typed lead over a paste lets the paste decide) is reproduced live at 811cea61d6 and is one class this roadmap removes; its open und-fallback question is answered by the owner directive (D1) and its lead-floor question by step 3.1. Archived in 5.2."
  - slug: later/road-to-agent-throughput-recovery
    relation: extends
    note: "Its step 4.1 (classify the language refusals by pin source) is blocked on language-misfire-window-after-the-agent-message-fix and its counting script was a one-off. Phase 1 here commits that count as a command and runs it over the post-fix window; 1.3 hands the result back to 4.1. Steps 4.2-4.4 there stay there."
  - slug: road-to-state-and-pins-across-compaction
    relation: disjoint
    note: "Edits the same file (language_mirror_hook.ts) for compaction restore and session pins; this roadmap changes only what sets the pin, never the restore path."
  - slug: later/road-to-language-and-tone-enforcer-claim
    relation: disjoint
    note: "Comment-language enforcer claim on a kernel rule; no shared code path."
---
# Road to a language pin from owner prose

> **Source:** the owner's session retrospective of 2026-11-21 (~380 Claude Code
> sessions, 23 chunks, 643 incidents), P0 measure 2 — "language pin only from the
> owner's prose: exclude synthetic turns, logs and code" — and its language-drift
> pattern (seen in at least 15 chunks; a 2026-10-14 reading counted 64 of 123
> stop refusals as language-pin false positives from synthetic turns). The AI
> council round of the same day (members: anthropic, openai) graded it ready for
> a roadmap (anthropic) and asked to keep language drift apart from hooks
> wrongly rejecting real verification, since the fixes differ. Tree facts
> verified at `811cea61d6` on 2026-11-21.

## Goal

The reply-language pin is set only by text the owner typed. Host-generated
turns, pasted terminal output, code and pasted documents never set it, and the
turn-end gate refuses a reply on language only when the pin came from owner
prose. Every misfire class found in real sessions has a fixture that was red
before the fix, and a committed command re-derives the refusal split on demand.

## Context

What already holds at `811cea61d6`, so this roadmap does not rebuild it:

- `isSyntheticPrompt` (`src/scripts/_lib/prompt_shape.ts:90`) skips task
  notifications, system reminders, `<agent-message`, the usage-limit resume
  sentence and, since `66dd150cfc` (2026-11-03), the framed cross-session message
  (`AGENT_MESSAGE_FRAME`, `prompt_shape.ts:110`). The hook leaves the pin
  untouched on those turns (`src/scripts/language_mirror_hook.ts:1220`).
- `classify` (`language_mirror_hook.ts:325`) strips injected regions, removes
  output-shaped paste lines (`instructionText`, `:275`), scores the typed lead
  first (`humanAuthoredLead`, `prompt_shape.ts:136`), then **falls back to the
  whole body** when the lead is under `MIN_MARKERS = 2` (`:250`).

What is still wrong, reproduced with `classify` on 2026-11-21:

| Shape (from a real session) | Verdict today | Owner typed |
|---|---|---|
| Terminal error block above one typed German line (agent-config, 2026-10-12..15) | `en` (de=3 / en=5) | German |
| `Behebe das bitte.` over an English paragraph (stub) | `en` (de=2 / en=6) | German |
| `Fix this file.` over a German paragraph (stub) | `de` (de=12 / en=1) | English |

Two mechanisms produce them: the whole-body fallback lets the paste decide,
and a typed line **after** a paste is never treated as the lead. The turn-end
gate then refuses every correct reply: `readLanguagePin`
(`src/scripts/hooks/turn_end_gate_hook.ts:638`) reads `language` only, never how
the pin was set, so a `system-locale` pin (`language_mirror_hook.ts:585`)
refuses exactly like an owner-prose pin.

Delta owned here, and only this: (1) a committed refusal-split command (the
2026-10-19 count was a one-off script, never committed); (2) fixtures from the
real cases; (3) an owner-prose extractor with no whole-body fallback; (4) gate
refusal only on owner-prose pins. Not in scope: unifying with
`_lib/machine_wake.ts` `humanTypedThisTurn` (its error budget differs, as
`prompt_shape.ts` documents), and the compaction restore path.

Owner constraint (2026-11-21): no hand-maintained context. Every evidence file
this roadmap writes is the output of a committed command and is regenerated,
never edited.

## Phase 1 — A refusal split any session can re-derive

- [x] **1.1 Add `--language-split` to `measure_turn_end_gate`, test first.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/prompt_shape.ts --> In
      `tests/scripts/measure_turn_end_gate.test.ts` add a synthetic transcript
      with one `language` fire per class: `owner-prose`, `synthetic-turn`
      (`isSyntheticPrompt`), `paste-decided` (lead `und`, body decided),
      `trailing-typed-line`, `system-locale`, `unknown`. Assert the table rows
      sum to the fires. Run it red, then implement in
      `src/scripts/measure_turn_end_gate.ts`: for each replayed `language` fire,
      find the user entry that last set the pin and assign its class.
      verify: `npx vitest run tests/scripts/measure_turn_end_gate.test.ts -t language-split` -> 0 after a recorded red run
      uses: test-driven-development
- [x] **1.2 Generate the post-fix baseline.** <!-- receipt: class=R0 · active · scope=safe · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> Run
      `./scripts-run src/scripts/measure_turn_end_gate --language-split --out agents/evidence/analysis/language-split-baseline.md`
      over every local transcript since `66dd150cfc` (2026-11-03). The file
      carries the command line, the tree sha and the per-class counts; its body
      is never hand-edited. Fewer than 20 `language` fires in the window → the
      file says so and Phase 3 proceeds on the fixtures alone.
      verify: re-running the command at the same sha reproduces the file byte-for-byte (`git diff --exit-code` on it)
- [x] **1.3 Hand the split to `later/road-to-agent-throughput-recovery` 4.1.** <!-- receipt: class=R0 · active · scope=safe · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      Its blocker `language-misfire-window-after-the-agent-message-fix` asks for
      a second split over a post-fix window. Run the council (`agent-config
      council:status`, then a council round on that blocker with 1.2's file),
      write the verdict into that blocker entry and a one-line Done note on 4.1
      citing 1.2's file.
      verify: `grep -c "language-split-baseline" agents/roadmaps/later/road-to-agent-throughput-recovery.md` -> /^[1-9][0-9]*$/

## Phase 2 — Fixtures from the real cases, red first

- [ ] **2.1 Add an owner-prose fixture table to the hook test.** In
      `tests/scripts/language_mirror_hook.test.ts` add a `describe('owner prose
      only')` table: the three rows of § Context, every non-zero misfire class
      from 1.2 (text paraphrased, identifiers and names redacted, provenance as
      the `deriveSessionKey` digest only), plus regression rows that are green
      today: task notification, `<agent-message`, framed cross-session message,
      usage-limit resume, `<bash-stdout>` pane echo, a German instruction over a
      fenced English stack trace. Expected verdict per row: the owner's
      language, or `und` where the owner text has under `MIN_MARKERS`.
      verify: `npx vitest run tests/scripts/language_mirror_hook.test.ts -t "owner prose only"` -> 1 and the failing rows are exactly the rows of § Context plus 1.2's new classes
      uses: test-driven-development
- [ ] **2.2 Add the gate-side fixtures.** In the turn-end gate test file
      (`grep -l detectLanguage tests -r` names it) add: a `system-locale` `en`
      pin plus a German reply → no `language` finding; a `prompt`-sourced `de`
      pin plus an English reply → finding (unchanged). Keep the existing
      `language-mirror` rows in `tests/fixtures/self-repair-detector-corpus.yml`
      untouched.
      verify: the new must-not-fire case fails on the current tree; the fire case passes

## Phase 3 — Pin only from owner prose

- [ ] **3.1 Council: the floor for a short typed lead.** First action: `agent-config
      council:status`, then a council round on one question — with no
      whole-body fallback, does a typed span under `MIN_MARKERS` stay `und`
      (keep the previous pin), or does the owner span get its own lower floor?
      Attach 2.1's table and the stub's warning that a floor of 1 lets one
      homograph flip a session. Record the verdict as a `## Decisions` row.
      verify: a D-row with `resolved by: council:<date>` exists in this file
- [ ] **3.2 Implement `ownerProse(prompt)` in `src/scripts/_lib/prompt_shape.ts`.**
      Order: `isSyntheticPrompt` → `stripInjectedRegions` → drop fenced code and
      output-shaped paste lines → keep the typed lead before the first document
      head **and** the typed paragraph after the last paste block → return only
      those spans. Switch `classify` (`language_mirror_hook.ts:325`) to score
      `ownerProse` with 3.1's floor and remove the whole-body fallback; correct
      the "bidirectional by construction" docstring the stub flagged.
      verify: `npx vitest run tests/scripts/language_mirror_hook.test.ts` -> 0 with 2.1's table green
- [ ] **3.3 Record pin provenance.** Add `owner_prose_chars` to `PinState`
      (`language_mirror_hook.ts:464`) and write it on every prompt-sourced pin.
      Test first: a pin written from 2.1's trailing-line row records the typed
      line's length, not `prompt_chars`.
      verify: `npx vitest run tests/scripts/language_mirror_hook.test.ts -t owner_prose_chars` -> 0 after a recorded red run
- [ ] **3.4 Keep the conformance scanner on the same reader.** `measure_turn_end_gate`
      and `conformance_scan` call `classify`; run both suites so the scanner and
      the hook still classify one entry the same way.
      verify: `npx vitest run tests/scripts/measure_turn_end_gate.test.ts tests/scripts/conformance_scan.test.ts` -> 0

## Phase 4 — The gate refuses only on an owner-prose pin

- [ ] **4.1 Make `readLanguagePin` provenance-aware.** In
      `src/scripts/hooks/turn_end_gate_hook.ts:638` return `und` for a pin whose
      `source` is not `prompt`, and for a `prompt` pin with
      `owner_prose_chars: 0`. A pin file without the field (written before 3.3)
      keeps today's behaviour. Turns 2.2's must-not-fire case green.
      verify: `npx vitest run tests/hooks tests/scripts -t "language"` -> 0
- [ ] **4.2 Rebuild the hook bundle and check its budget.** Run `npm run
      build:hooks`, then the bundle freshness and token-budget checks
      (`./scripts-run src/scripts/check_hook_bundle_freshness`); raise
      `src/config/hook-bundle-budget.json` only with the measured delta in the
      commit body.
      verify: `./scripts-run src/scripts/check_hook_bundle_freshness` -> 0

## Phase 5 — Measure, then close what this supersedes

- [ ] **5.1 Regenerate the split with the new classifier.** Run 1.2's command
      to `agents/evidence/analysis/language-split-after.md` over the same window
      and the same transcripts. Report per class the fires before and after, one
      table row per class in the form `| <class> | <before> | <after> |`.
      verify: `grep -cE '^\| (synthetic-turn|paste-decided|trailing-typed-line|system-locale) \|[^|]*\| 0 \|$' agents/evidence/analysis/language-split-after.md` -> /^4$/ and the `owner-prose` fires are listed individually
- [ ] **5.2 Archive the superseded stub.** Move
      `agents/roadmaps/stubs/road-to-language-pin-short-lead.md` to
      `agents/roadmaps/archive/` with a one-line Done note naming 3.2 and D1
      (its `en`/`en`/`de` probe target is replaced by owner-prose-only
      verdicts), then run the roadmap dashboard regeneration.
      verify: `test ! -e agents/roadmaps/stubs/road-to-language-pin-short-lead.md` -> 0 and `./scripts-run src/scripts/check_no_roadmap_refs` -> 0

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | The pin is set only from text the owner typed; a paste, a host turn or code never decides it, and an undetermined owner span keeps the previous pin. | Owner's session retro 2026-11-21, P0 measure 2, ordered planned and executed the same day. | the owner asks for paste-decided pins back |
| D2 | reversible-technical | agent | The split is a mode of `measure_turn_end_gate`, not a new script. | It already replays the gate over real transcripts with the shared `classify` (`measure_turn_end_gate.ts:91`). | the mode makes that script exceed its size budget |
| D3 | reversible-technical | agent | 1.1: the split replays the pin with the hook's own `classify` + `nextState`, reads files in name order and filters entries by their own timestamp; `synthetic-turn` also covers entries the transcript marks host-written (`isMeta`, `isCompactSummary`), which never reach `UserPromptSubmit`; `unknown` is the residual for a fire with no recoverable setter and is unreachable from a well-formed transcript, so it is unit-tested on the classifier. | `language-split-baseline.md`: 140 of 148 replayed fires came from host-marked entries, while the gate itself recorded 6 refusals in the same window. | a host starts delivering `isMeta` entries to `UserPromptSubmit` |
| D4 | reversible-technical | council:2026-11-21 | 1.3: throughput-recovery 4.1 closes on its correction (option (b)); event-level re-measurement moves to 5.1 here. | Council 2026-11-21, anthropic + openai, 2/2 chose (b), $0.00. | 5.1 finds a non-owner class still firing |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Real drift goes unrefused | product | Removing the whole-body fallback and locale-pin refusals means fewer pins, so a genuine English reply in a German session can pass the gate. | Undetermined owner spans keep the previous pin (D1); 5.1 lists every remaining `owner-prose` fire individually so a recall loss is visible. | Phase 3 — Pin only from owner prose |
| 2 | The trailing-line rule picks up a paste's last line | implementation | A paste with no blank line before the owner's sentence, or ending in prose, could be read as typed. | 2.1 carries both shapes as rows; 3.2 keeps the existing paste-head filter in front of the trailing-span rule. | Phase 2 — Fixtures from the real cases, red first |
| 3 | The window is too thin to measure | implementation | Transcripts since 2026-11-03 may hold fewer than 20 `language` fires. | 1.2 states the count; the fixtures alone gate the fix and 5.1 reports a small window as such. | Phase 1 — A refusal split any session can re-derive |
| 4 | Fixtures leak session content | implementation | Real prompts carry names, paths and identifiers. | 2.1 paraphrases and redacts, provenance as a digest only. | Phase 2 — Fixtures from the real cases, red first |

<!-- resequenced: the only broken intermediate state would be a gate reading a provenance field no pin writes yet; Phase 3 writes `owner_prose_chars` before Phase 4 reads it, and a pin without the field keeps today's behaviour, so every step is publishable and no hold is declared. -->

## Acceptance Criteria

- [ ] AC-1 — `classify` returns the owner's language (or `und`) for every row of
      § Context and every misfire class 1.2 found, and the fixtures were red
      before 3.2.
- [ ] AC-2 — The turn-end gate raises no `language` finding on a pin not set by
      owner prose (`system-locale`, or `owner_prose_chars: 0`).
- [ ] AC-3 — `agents/evidence/analysis/language-split-baseline.md` and
      `language-split-after.md` are both command output, reproducible at their
      recorded sha, and the after file shows 0 fires in the four non-owner
      classes.
- [ ] AC-4 — `stubs/road-to-language-pin-short-lead.md` is archived and
      `later/road-to-agent-throughput-recovery` 4.1 cites the committed split.
- [ ] AC-5 — `task ci` is green on the branch carrying these changes.
