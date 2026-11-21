---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
parent_roadmap: road-to-a-language-pin-from-owner-prose
relates:
  - slug: road-to-a-language-pin-from-owner-prose
    relation: extends
    note: "Archived parent; its steps 3.2 (hook half), 3.3 (hook write), 3.4, 4.1, 4.2, 5.1 and AC-2, AC-3, AC-5 are carried here."
  - slug: road-to-language-pin-short-lead
    relation: disjoint
    note: "Archived stub the parent superseded; its defect is closed by the library classifier this file wires in, nothing of it is carried."
  - slug: road-to-webfont-delivery-ownership
    relation: disjoint
    note: "Keyword hit only (live, owner); webfont delivery shares no code path with the language hooks."
review_by: 2026-12-21
estate_growth_exempt: "Carried from road-to-a-language-pin-from-owner-prose, archived in the same change, so the active count does not grow. It holds exactly the live hook wiring and the dispatch-bundle raise the owner withdrew from the parent (option 2, 2026-11-21): parent steps 3.2 (hook half), 3.3 (hook write), 3.4, 4.1, 4.2, 5.1 and AC-2, AC-3, AC-5."
estate_offset_exempt: "The parent is archived in this change and offsets this file one for one. Folding the wiring into another active roadmap was rejected because none owns the language hook, and parking it in later/ was rejected because the owner ordered the measure executed (owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md)."
---
# Road to a language pin from owner prose — live wiring

> **Source:** carried on 2026-11-21 from
> [`road-to-a-language-pin-from-owner-prose`](archive/road-to-a-language-pin-from-owner-prose.md).
> Its classifier, pin step and gate rule landed as a library the hook
> dispatcher does not import; the dispatch-bundle raise that wiring them needs
> (1,595,300 → 1,600,295 B) went through 22 ratification rounds without the
> council converging, and the owner chose to land the feature without growing
> the live bundle (option 2, 2026-11-21). The parent's items 3.2 (hook half),
> 3.3 (hook write), 3.4, 4.1, 4.2, 5.1 and AC-2, AC-3, AC-5 were `[~]` there
> with the carry recorded at the item; they are restated here as open work.

## Goal

The live hooks set the reply-language pin only from owner prose and the
turn-end gate refuses on language only behind such a pin — the library already
in the tree, wired in — with the bundle growth that costs ratified, or avoided.

## Context

Landed with the parent, at the tree this file was written on:

- `classifyOwnerProse` and `ownerProseNextState` in
  `src/scripts/_lib/owner_prose_pin.ts`; `ownerProse` / `ownerSpans` in
  `src/scripts/_lib/prompt_shape.ts`; `gatePinLanguage` in
  `src/scripts/hooks/language_pin_gate.ts`. None is imported by
  `src/scripts/hooks/dispatch_entry.ts`'s graph, so the dispatch bundle
  measured 1,595,224 B against its unchanged 1,595,300 B ceiling.
- `measure_turn_end_gate --language-split` replays the pin with the library.
- The hook-driven owner-prose tests drive the library through a `pinReplay`
  helper (`tests/scripts/language_mirror_hook.test.ts`), and the gate cases read
  `gatePinLanguage` directly (`tests/scripts/turn_end_gate_hook.test.ts`).

## Phase 1 — Wire the library into the hooks

- [ ] **1.1 Pin from owner prose in `language_mirror_hook`.** In `run`, classify
      the prompt with `classifyOwnerProse` and step the pin with
      `ownerProseNextState`, so every prompt pin records `owner_prose_chars`.
      Rename the hook's whole-body `classify` to `classifyText` and keep it for
      replies; point `turn_end_gate_hook.detectLanguage` and
      `conformance_scan` at `classifyText` (parent 3.2 hook half, 3.3, 3.4).
      verify: `npx vitest run tests/scripts/language_mirror_hook.test.ts tests/scripts/conformance_scan.test.ts tests/scripts/measure_turn_end_gate.test.ts` -> 0
- [ ] **1.2 Gate on provenance.** `readLanguagePin` returns
      `gatePinLanguage(pin)` (parent 4.1).
      verify: `npx vitest run tests/scripts/turn_end_gate_hook.test.ts -t "language pin"` -> 0
- [ ] **1.3 Move the replayed sequences back onto the hook.** Replace the
      `pinReplay` sequences with `run(envelope(…))` / `readState()` and the
      `gatePinLanguage` gate cases with `writePin` + `readLanguagePin`, each run
      red against the tree before 1.1/1.2 and green after.
      verify: `grep -c "pinReplay" tests/scripts/language_mirror_hook.test.ts` -> /^0$/
- [ ] **1.4 Bundle budget.** Rebuild (`npm run build:hooks`) and read
      `./scripts-run src/scripts/check_hook_bundle_composition`. Under the
      ceiling → done. Over it → first measure moving the owner-prose reader into
      a lazily loaded chunk (`src/scripts/hook_chunks.mjs`) with its own
      registered ceiling, as the egress engine was on 2026-10-18; only if that
      is not viable, propose a `max_bytes` raise with a `raise_log` entry and
      put it through ratification — the owner decides a raise the council does
      not converge on (parent 4.2).
      verify: `./scripts-run src/scripts/check_hook_bundle_composition` -> 0

## Phase 2 — Measure the wired pin

- [ ] **2.1 Regenerate the split with the wired classifier.** Run
      `./scripts-run src/scripts/measure_turn_end_gate --language-split --out agents/evidence/analysis/language-split-after.md`
      over the parent's baseline window and transcripts, one row per class in
      the form `| <class> | <before> | <after> |` (parent 5.1).
      verify: `grep -cE '^\| (synthetic-turn|paste-decided|trailing-typed-line|system-locale) \|[^|]*\| 0 \|$' agents/evidence/analysis/language-split-after.md` -> /^4$/

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The wiring cannot fit the dispatch ceiling | implementation | The parent measured the wired bundle at about 5 KB over the ceiling, and 22 ratification rounds did not converge on a raise. | 1.4 measures a lazily loaded chunk first; a raise goes to ratification and, failing convergence, to the owner. | Phase 1 — Wire the library into the hooks |
| 2 | Real drift goes unrefused | product | Owner-prose-only pins and locale-pin exemption mean fewer refusals, so a genuine wrong-language reply can pass. | An undetermined owner span keeps the previous pin (parent D1); 2.1 lists every remaining `owner-prose` fire. | Phase 2 — Measure the wired pin |
| 3 | Library and hook drift apart before wiring | implementation | Edits to the hook's classifier while this waits could diverge from `classifyOwnerProse`. | 1.3 moves the sequences back onto `run`, so one test suite covers the wired path. | Phase 1 — Wire the library into the hooks |

## Acceptance Criteria

- [ ] AC-1 — The turn-end gate raises no `language` finding on a pin not set by
      owner prose (`system-locale`, or `owner_prose_chars: 0`), read through
      `readLanguagePin` on a pin the hook wrote (parent AC-2).
- [ ] AC-2 — `language-split-after.md` is command output, reproducible at its
      recorded sha, and shows 0 fires in the four non-owner classes (parent AC-3).
- [ ] AC-3 — No ceiling in `src/config/hook-bundle-budget.json` rises without a
      converged ratification or an owner decision recorded in this file.
- [ ] AC-4 — `task ci` is green on the branch carrying these changes (parent AC-5).
