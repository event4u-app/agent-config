---
complexity: lightweight
status: completed
execution:
  mode: autonomous
estate_offset_exempt: "Two payload-measurement defects no active roadmap owns: the hook bundle carries a second YAML parser beside a source comment that calls the other one the only YAML reader, and the standing-payload census reads one host's surface from whatever the working tree last generated. Merging into road-to-a-kernel-that-guards-its-plumbing was rejected because that roadmap verifies the bundle's integrity, not its size; the archived payload roadmaps closed before either defect existed, and parking an active roadmap would not shrink the bundle."
relates:
  - slug: road-to-a-kernel-that-guards-its-plumbing
    relation: disjoint
    note: That roadmap verifies the bundle's integrity; this one measures and bounds its size and contents.
---
# Road to a hook bundle with one YAML reader

> **Source:** `agents/tmp.old/inbox-2026-10-a/` — a supplied scorecard rescore
> of the 16.2.0 release whose context-efficiency row fell on a 10.3 % bundle
> growth and a census line read from an untracked file. Verified against `main`
> at `9bc8cd4f2` on 2026-10-01; disposition at
> `agents/evidence/analysis/inbox-2026-10-a-disposition.md`.

## Goal

The hook bundle that every dispatch loads carries one YAML parser, its byte size
is ratcheted so the next unannounced dependency is a red check rather than a
review finding, and the standing-payload census reports every host from what the
tree generates instead of what happens to be on disk. Done means: `js-yaml` is
absent from `dist/hooks/dispatch.js`, a byte ceiling for the bundle exists and
fails a fixture over it, and the census produces the same windsurf figure on a
fresh worktree and on a long-lived checkout.

## Context

- `src/scripts/hooks/block_config_weakening.ts:48` imports `js-yaml`;
  `concern_registry.ts` registers the concern, so it is bundled by
  `build:hooks` (`package.json:83`). `src/scripts/hooks/host_lowering.ts:22`
  imports `yaml`, and its header at `:36-46` says that reader is "the ONLY
  remaining YAML reader on that path". Both parsers are dependencies
  (`package.json:135,139`).
- The rescore's bundle figures (1,417,597 → 1,564,211 bytes) were not
  re-derived here: the worktree this was verified in has no built bundle.
  Step 1.1 re-measures before anything changes.
- `report_standing_payload_by_host.ts:152-155` reads `.windsurfrules` and
  `singleFileChars` (`:218-224`) reads it from the working tree. The file is a
  generated, untracked projection, so the figure depends on when the checkout
  last ran `task generate-tools`.

## Phase 1 — One parser on the dispatch path

- [x] **1.1 Measure the bundle and its parsers.** Build the hook bundle in a
      checkout with a real `node_modules` (a symlinked one rewrites tracked
      bundle paths), record its bytes and the esbuild metafile's per-package
      share for `js-yaml` and `yaml` in
      `agents/evidence/analysis/hook-bundle-composition-<date>.md`.
      verify: `grep -c 'js-yaml' agents/evidence/analysis/hook-bundle-composition-*.md` -> /^[1-9]/
- [x] **1.2 Read the settings contract without `js-yaml`.** Port the class
      contract read in `block_config_weakening.ts` to the `yaml` package the
      bundle already carries, keeping its fail-closed path (an unreadable
      contract refuses). The existing class-C tests must pass unchanged, and a
      YAML 1.1 versus 1.2 boolean case (`on`, `yes`) is added before the swap.
      verify: `npx vitest run tests/scripts/hooks/block_config_weakening.test.ts` -> 0
- [x] **1.3 A second YAML parser in the bundle fails a test.** Read the
      metafile from the bundle build and fail if more than one YAML package
      contributes bytes. Seen red with `js-yaml` still imported.
      verify: `npx vitest run tests/scripts/hook_bundle_composition.test.ts` -> 0

## Phase 2 — The bundle has a byte ceiling

- [x] **2.1 Ratchet the bundle size.** Record the post-1.2 byte count as a
      ceiling in a budget file the bundle-freshness job already reads, shrink-only
      with a recorded reason on any raise, and fail a planted bundle one byte
      over. Registered with a gate-coverage row and a self-test.
      verify: `npx vitest run tests/scripts/hook_bundle_composition.test.ts -t ceiling` -> 0

## Phase 3 — The census reads what the tree generates

- [x] **3.1 Render the single-file surfaces instead of reading them.** For each
      single-file host surface the census reports, compute the bytes from the
      emitter's output in memory (the same function `condense.ts` writes with),
      or refuse with a named reason when the emitter cannot be called. Never read
      an untracked file's current contents as the figure.
      verify: `npx vitest run tests/scripts/report_standing_payload_by_host.test.ts` -> 0
- [x] **3.2 Prove it is checkout-independent.** Run the census in a fresh
      worktree with no generated trees and in this checkout; the windsurf row
      must match.
      verify: `npx vitest run tests/scripts/report_standing_payload_by_host.test.ts -t fresh` -> 0

## Outcome (2026-10-01)

Measured, not asserted — the full composition tables are in
`agents/evidence/analysis/hook-bundle-composition-2026-10-01.md`.

| Quantity | Before | After |
|---|---:|---:|
| `dist/hooks/dispatch.js` bytes | 1,564,211 | 1,468,237 |
| YAML packages in the bundle | 2 | 1 |
| Published windsurf standing-payload figure | 34,160 | 398,211 |

The 1,564,211 reproduces the source rescore's figure exactly, so the growth it
reported was real rather than a measurement artefact of its own checkout.

The windsurf row is the one number that moved UP, and the direction is the
finding: the published 34,160 bytes was a stale `.windsurfrules` read off
whichever checkout last emitted the artifact, against 398,211 bytes the emitter
actually renders for the unscoped corpus every other row in that table reports.
An eleven-fold understatement sat in a contract document (`rule-router.md`) with
nothing able to see it, because the figure's own source was the thing that
varied. Both now come from the renderer.

**D1's revisit condition fired halfway and the decision stands.** `js-yaml` IS
the smaller parser (95,846 B against 258,839 B), but the condition is a
conjunction and its second half fails: there are seven `yaml` importers on the
dispatch path against one `js-yaml` importer, and one of the seven is
`dispatch_hook.ts` itself. Recorded as evaluated rather than silently satisfied.

## Gap table

| Source item | Verdict | Where |
|---|---|---|
| Bundle +10.3 % from a second YAML parser | KEEP, re-measured first | 1.1, 1.2 |
| Ban a second parser | KEEP | 1.3 |
| Byte ratchet for the hook bundle | KEEP | 2.1 |
| Windsurf row read from an untracked file | KEEP | Phase 3 |
| `dispatch_hook.ts` at exactly 1,500 lines after moving a sink out | CUT — the size gate did its job; moving code out is the sanctioned response | disposition |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Keep `yaml`, drop `js-yaml` on the dispatch path | `yaml` is already loaded by `host_lowering.ts` on the fallback path; `js-yaml` serves one concern | 1.1 shows `js-yaml` is the smaller of the two and both callers can move to it |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The parser swap changes what a settings key parses to | implementation | `js-yaml` and `yaml` differ on YAML 1.1 booleans; a class-C key written as `on` could read differently and slip the fence. | 1.2 adds the 1.1-versus-1.2 case before the swap and keeps the fail-closed test. | Phase 1 — One parser on the dispatch path |
| 2 | The ceiling is set on a worktree-built bundle | implementation | A bundle built through a symlinked `node_modules` carries rewritten paths and a different size. | 1.1 names the build condition, and the ceiling is read from CI's build. | Phase 2 — The bundle has a byte ceiling |
| 3 | The in-memory render diverges from what `condense.ts` writes | product | A census that renders through a different code path measures a file nobody receives. | 3.1 calls the emitter function itself, never a reimplementation. | Phase 3 — The census reads what the tree generates |

## Acceptance Criteria

- [x] AC-1 — `dist/hooks/dispatch.js` contains one YAML parser and a test fails
      when a second is bundled.
- [x] AC-2 — The hook bundle has a byte ceiling that fails a planted bundle over it.
- [x] AC-3 — The standing-payload census reports the same windsurf figure in a
      fresh worktree and in a long-lived checkout.
