---
complexity: structural
status: done
tree_pin: 58d43073b7
execution:
  mode: phase-checkpoints
# roadmap:context scanned: 1176 roadmap file(s) across active/later/stubs/archive; no sibling on the installer host-config merge
relates: []
estate_offset_exempt: "Owner search: grep -rliE 'read_json_file|merge_json_file|JSONC|parseJsonLenient' over agents/roadmaps (active, later/, stubs/, archive/) and docs/decisions returned no roadmap owning the installer's host-config merge. Opened active because the operator's invocation asked for this round's roadmaps to be processed in the same run (inbox-2026-10-bj); it is closed and archived in the PR that opens it, so the active estate does not grow at merge."
---
# Road to host configs that survive the install

> **Source:** `agents/tmp.old/inbox-2026-10-bj/` (t1) — an external reverse-engineering
> reference review that, as a side finding, traced the installer's JSON merge.
> Verified at `58d43073b7`; no roadmap owned it.

## Goal

An install over a host settings file the installer cannot parse as strict JSON —
a `.vscode/settings.json` with `//` comments, a truncated file, a file with a
duplicated key we write to — never loses a foreign line. Each case ends in a
named status the install reports; nothing is silently replaced with `{}`.

Today `read_json_file` (`src/scripts/install.ts`) warns and returns `{}` on a
parse failure, and `merge_json_file` then writes our keys over that empty
object — no backup, no readback. VS Code settings are JSONC, so one comment is
enough to wipe a user's keys.

## Phase 1 — Refuse instead of replace

- [x] **1.1 Red test first.** A fixture `.vscode/settings.json` carrying a `//` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/install.ts -->
      comment and a user key, merged through the bridge path, must keep the user
      key byte-for-byte or be skipped with a named status. Seen red at the pin.
      verify: `npx vitest run tests/install/host-config-merge.test.ts` -> 0
- [x] **1.2 Typed parse result.** `read_json_file` reports a parse failure <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/install.ts -->
      instead of returning `{}`; `merge_json_file` tries a JSONC read (comments and
      trailing commas stripped), and if that also fails it leaves the bytes
      untouched and reports `skipped-invalid` with the snippet to add by hand.
      A JSONC file is not rewritten (rewriting would drop the comments): if our
      keys already match it reports `unchanged`, otherwise `skipped-jsonc`.
      verify: `npx vitest run tests/install/host-config-merge.test.ts` -> 0
- [x] **1.3 Backup and readback.** Before overwriting an existing file, write <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/install.ts -->
      `<file>.agent-config.bak` once; after writing, re-parse and restore the
      bytes read just before the write on a mismatch (status
      `skipped-readback-mismatch`); the `.bak` is written once and may be older
      than the file, so restoring it could undo later changes.
      verify: `npx vitest run tests/install/host-config-merge.test.ts` -> 0
- [x] **1.4 Duplicate keys refuse.** A duplicated top-level key the merge would <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/install.ts -->
      touch makes the merge refuse with `skipped-duplicate-key`, since a strict
      parse silently keeps only the last occurrence.
      verify: `npx vitest run tests/install/host-config-merge.test.ts` -> 0

## Phase 2 — Own-orphans and the contract

- [x] **2.1 Remove the dead collision prompt.** `prompt_collision_choice` is <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/install.ts -->
      only kept alive by a `void` statement; delete both.
      verify: `grep -c 'prompt_collision_choice' src/scripts/install.ts` -> /^0$/
- [x] **2.2 Document the statuses.** `docs/contracts/install-layout.md` names <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      `skipped-invalid`, `skipped-jsonc`, `skipped-duplicate-key` and the backup file.
      verify: `grep -c 'skipped-invalid' docs/contracts/install-layout.md` -> /^[1-9]/
- [x] **2.3 Type-check the touched project.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/install.ts -->
      verify: `npx tsc --noEmit -p .` -> 0

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-29 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A previously "working" install now skips a file | product | Users whose file was silently rewritten before now see a skip and must add keys by hand | The skip prints the exact snippet; strict-JSON files keep today's merge behavior | Phase 1 — Refuse instead of replace |
| 2 | JSONC heuristic misreads a string containing `//` | implementation | A URL value inside a string is stripped as a comment | The stripper is string-aware and has a URL-in-string test | Phase 1 — Refuse instead of replace |

## Acceptance Criteria

- [x] AC-1 — An install over commented JSONC, truncated JSON or a duplicated
      key we touch leaves every foreign line in place, and each case reports a
      named status.
- [x] AC-2 — An overwritten host file always has a `.agent-config.bak` beside it
      and was re-read after the write.
