---
complexity: lightweight
execution:
  mode: autonomous
---

# Road to rootless-write refusal

> A command that resolved its project root from an anchorless working directory
> writes to the wrong place and exits 0; after this roadmap `session:recycle`
> refuses instead, the Stop advisory stops recommending a blind `/clear`, and
> the five sibling commands that write or delete under the same resolver are
> inventoried.

## Goal

`agent-config session:recycle` invoked from a directory with no project anchor
exits non-zero and writes nothing, instead of exiting 0 after writing an
envelope the successor session can never find.

## Prerequisites

- [x] The `cli-delegate` entry-guard defect (PR #1291) is merged and released —
      it is the *other* cause of the same symptom and is already fixed
      (`git tag --contains 1ea3f670` → `9.36.0`, `10.0.0`).

## Context

Source: `agents/tmp.old/session-recycle-defekt.txt` (observed 2026-08-10 and
2026-08-12 in a consumer repo; four occurrences across two sessions).

The report describes `session:recycle` exiting 0 while writing no envelope, and
lists three suspected causes. Verification against the tree found that the
observed symptom had a **different** cause than any of the three — the
`cli-delegate` entry guard shipped four commands as zero-byte no-ops
(`src/scripts/_cli/cmd_session_recycle.ts:255-306`), fixed in PR #1291 and
released. The report's own suspicions 1 and 2 are not reachable in the code.

Suspicion 3 — "does it derive the repo from the CWD?" — is **correct, still
open, and a distinct defect**. `runSessionRecycle` calls
`resolve_project_root(null, { cwd })` (`cmd_session_recycle.ts:117`), which
falls through to `ORIGIN_CWD_FALLBACK` — the CWD itself — when no anchor is
found (`_lib/agent_settings.ts:770-775`). Reproduced against the current tree
from an anchorless directory:

    exit code: 0
    recycle envelope written — agents/runtime/state/recycle-envelope.json (1047 bytes)
      1. End this session now: run /clear …
      2. The successor session receives the envelope automatically at session_start

The file landed at `<anchorless-cwd>/agents/runtime/state/recycle-envelope.json`.
Three things compound:

1. The **origin is discarded** — `resolve_project_root` returns
   `[root, origin]` and the caller destructures only `[projectRoot]`, so the
   one fact that distinguishes a real repo from a fallback is thrown away at
   the call site.
2. The success line prints the **relative** path (`RECYCLE_ENVELOPE_REL`), so
   the operator cannot see that it went somewhere else.
3. The resume instruction that follows is **false** in this case, and it is the
   instruction that costs the whole session.

Grep across the same resolver: **zero** call sites in `src/` import
`ORIGIN_CWD_FALLBACK` (`grep -rn ORIGIN_CWD_FALLBACK src/` → 6 hits, all
definitions or comments in the two `agent_settings.ts` copies). One command —
`doctor` — does surface the fallback, but re-derives it from a duplicated
string literal (`cmd_doctor.ts:3376`) and only *reports* it; nothing gates on
it anywhere. Six commands resolve the root and then write or delete under it:
`session:recycle`, `migrate`, `update`, `uninstall`, `doctor`, `prune`. This
roadmap fixes the one where a wrong location is silently destructive to a
session and inventories the rest rather than rewriting all six blind.

The second half of the report's minimum fix — "the Stop hook that recommends
the call should make the same counter-check before advising `/clear`" — is
unimplemented: `session_eol_hook.ts` never references the envelope path.

## Phase 1 — `session:recycle` refuses a rootless write

- [x] Thread the resolver origin into `runSessionRecycle`: destructure
      `[projectRoot, origin]` at `cmd_session_recycle.ts:117` and refuse with
      exit 1 when `origin === ORIGIN_CWD_FALLBACK`, naming the directory that
      was resolved and the two ways to override it (`--project <path>`,
      `AGENT_CONFIG_PROJECT_ROOT`). The refusal runs before the write and
      before the resume instruction — a wrong-location envelope is worse than
      none, because the instruction that follows it is what triggers `/clear`.
      <!-- verify: npx vitest run tests/scripts/session_recycle.test.ts -->
- [x] Add `--project <path>` to `parseArgv` and pass it as the first argument
      of `resolve_project_root` (the parameter already exists and yields
      `ORIGIN_EXPLICIT`). This is the documented escape for the reported
      consumer shape — a repo whose `devEngines` pin forces the call from
      outside the tree.
      <!-- verify: npx vitest run tests/scripts/session_recycle.test.ts -->
- [x] Print the **absolute** target path in the success line instead of
      `RECYCLE_ENVELOPE_REL`. A relative path is unfalsifiable by the reader at
      exactly the moment the location is the thing in doubt.
      <!-- verify: npx vitest run tests/scripts/recycle_roundtrip.test.ts -->
- [x] Cover the refusal in `tests/scripts/session_recycle.test.ts`: one case
      asserting exit 1 + no file written from an anchorless cwd, one asserting
      `--project` restores the write, and one asserting an anchored cwd is
      unchanged (the regression guard for the normal path).
      <!-- verify: npx vitest run tests/scripts/session_recycle.test.ts -->
- [x] Update the `--help` text and the `src/cli/registry.ts:71` synopsis for the
      new flag.
      <!-- verify: grep -q -- "--project names the repo" src/cli/registry.ts -->
- [x] Re-anchor the fixtures the refusal invalidated. `session_recycle.test.ts`
      and `recycle_roundtrip.test.ts` both built their scratch root with a bare
      `mkdtemp`, i.e. the exact anchorless shape the command now rejects; both
      now create an `agents/overrides/` marker. `envelope_drift_roundtrip.test.ts`
      needed no change — it already `git init`s, which anchors.
      <!-- verify: npx vitest run tests/scripts/recycle_roundtrip.test.ts tests/scripts/envelope_drift_roundtrip.test.ts -->

**Exit criteria:** `npx vitest run tests/scripts/session_recycle.test.ts` exits
0 with the three new cases present; a manual run from an anchorless directory
exits 1 and creates no `agents/` tree there.

**Rollback:** revert the `cmd_session_recycle.ts` and `registry.ts` hunks; the
new tests fail and are reverted with them. No state format changes, so no
consumer migration.

## Phase 2 — The Stop advisory stops recommending a blind `/clear`

- [x] Sharpen `buildAdvisoryLine` (`hooks/session_eol_hook.ts:139-146`): the
      line must tell the reader what proof to look for before clearing — the
      absolute path the command prints — rather than presenting `/clear` as the
      unconditional next step. Wording change only, no new state.
      <!-- verify: npx vitest run tests/scripts/session_eol_hook.test.ts -->
- [x] Add the counter-check the report asks for, exactly once: when
      `advisory_fired_at` is already set and `agents/runtime/state/recycle-envelope.json`
      does **not** exist under the workspace root, emit one further advisory
      line saying so. Track it with a second timestamp field beside
      `advisory_fired_at` so it can never repeat — the once-per-session shape
      the advisory already uses, not a nag loop.
      <!-- verify: npx vitest run tests/scripts/session_eol_hook.test.ts -->
- [x] Keep every failure path silent-and-exit-0: an unreadable state file, an
      absent workspace root, or a stat error must not block the Stop slot
      (the hook's existing fail-open contract). `envelopeExists` returns `true`
      on a stat error on purpose — a failed check must never manufacture a
      warning that the envelope is gone.
      <!-- verify: npx vitest run tests/scripts/session_eol_hook.test.ts -->
- [x] Extend `tests/scripts/session_eol_hook.test.ts` with: advisory fires,
      envelope absent at the next Stop → second line once; envelope present →
      silence; second Stop after the second line → silence; below threshold →
      never (a missing envelope means nothing where no recycle was advised).
      <!-- verify: npx vitest run tests/scripts/session_eol_hook.test.ts -->

**Exit criteria:** `npx vitest run tests/scripts/session_eol_hook.test.ts`
exits 0; the new cases assert both the fire-once and the stay-silent branches.

**Rollback:** revert the hook hunk. The extra state field is additive and
ignored by the existing reader, so a rollback needs no state migration.

## Phase 3 — Inventory the same defect across the sibling commands

- [x] Record the count and the file list for the exact wrong construct —
      `resolve_project_root(...)` destructured without its origin, in a command
      that subsequently writes or deletes. Confirmed set at authoring time:
      `cmd_session_recycle.ts` (Phase 1), `cmd_migrate.ts`, `cmd_update.ts`,
      `cmd_uninstall.ts`, `cmd_doctor.ts`, `cmd_prune.ts`.
      <!-- verify: grep -rn "resolve_project_root" src/scripts/_cli/ -->
- [x] For each of the five, write one line in
      `agents/evidence/analysis/rootless-write-inventory.md` stating what it
      writes or deletes under the resolved root, and whether a wrong root is
      destructive (`uninstall`, `prune`), merely useless (`doctor`), or
      recoverable. No code changes in this phase — the decision per command is
      a separate change with its own blast radius.
      <!-- verify: test -f agents/evidence/analysis/rootless-write-inventory.md -->
- [x] State in the same file whether a shared helper is warranted, with the
      argument either way. A single `require_anchored_root()` would generalize
      the fix; five bespoke refusals would not. The finding is the deliverable,
      not the refactor. Verdict recorded: **not yet** — the correct behaviour
      differs per command, two of the six carry no override flag to refuse
      *into*, and five of the six are unmeasured.
      <!-- verify: grep -q "Shared-helper verdict" agents/evidence/analysis/rootless-write-inventory.md -->

**Exit criteria:** `agents/evidence/analysis/rootless-write-inventory.md`
exists, names all five commands, and carries the shared-helper verdict.

**Rollback:** delete the evidence file. No code touched.

## Risk Register

| # | Risk | Type | Why it is plausible | Mitigation | Anchored at |
|---|---|---|---|---|---|
| 1 | The refusal breaks a legitimate anchorless call | implementation | Some consumer may intentionally run from outside the tree — the reported repo does exactly that because of a `devEngines` pin. A hard refusal with no escape converts a silent failure into a hard block. | `--project <path>` ships in the same phase as the refusal, and the refusal message names it plus `AGENT_CONFIG_PROJECT_ROOT`. | Phase 1, step 2 |
| 2 | The second advisory line becomes a nag | product | An advisory that fires whenever an envelope is absent would fire on every Stop of every session that ignored the first line. | Gated on `advisory_fired_at` being set AND a separate once-only timestamp; the tests assert the third Stop is silent. | Phase 2, steps 2 and 4 |
| 3 | The counter-check reads the wrong path in a consumer | implementation | The hook resolves its workspace root from the envelope payload, not from `resolve_project_root` — a mismatch would make the check report a missing envelope that exists. | The check reuses `RECYCLE_ENVELOPE_REL` joined to the hook's own `workspaceRoot`, the same root it already writes `context-fill.json` to; a wrong answer there would already be visible in that file. | Phase 2, step 2 |
| 4 | Phase 3 grows into a six-command refactor | implementation | Two of the five (`uninstall`, `prune`) delete files, which invites fixing them in the same pass. | Phase 3 is explicitly evidence-only; its exit criterion is a written file, and its steps forbid code changes. | Phase 3, steps 2 and 3 |
| 5 | The absolute path leaks a local path into a shared transcript | product | The success line will print a full filesystem path where it printed a relative one. | The path is already visible to the operator running the command and is the same class of string `doctor` and `sync` print today; no new egress surface. | Phase 1, step 3 |

## Acceptance criteria

- [x] `session:recycle` from an anchorless directory exits 1, writes no file,
      and names both overrides in its message. Verified against the same
      directory that reproduced the original defect: before, exit 0 + a file in
      `/tmp`; after, exit 1 + no file.
- [x] `session:recycle --project <repo>` from that same directory writes the
      envelope into `<repo>/agents/runtime/state/` and prints the absolute path.
      Covered by the unit case and by a live CLI run, which is what proves the
      argv wiring in `main()` — the unit test exercises `parseArgv` and
      `runSessionRecycle`, never the hand-off between them.
- [x] `session:recycle` from inside a repo behaves exactly as before, proven by
      the pre-existing cases in `tests/scripts/recycle_roundtrip.test.ts`
      passing unchanged.
- [x] The Stop advisory names the proof to look for, and the missing-envelope
      counter-check fires at most once per session.
- [x] `agents/evidence/analysis/rootless-write-inventory.md` names all five
      sibling commands and carries the shared-helper verdict.
