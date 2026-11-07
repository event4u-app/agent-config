<!-- evidence-type: analysis -->

# Council verdict — the `windsurf` row of `host_lowering.yaml` (issue #2805)

- **Date:** 2026-11-07
- **Delegated by:** the repository owner, in chat: "entscheide das im ai council".
- **Prompt:** `windsurf-hooks-row-20261107.question.md` (this directory), sent once. It
  states the three options without a recommendation. Its `evidence-type` comment line
  was added after the run; nothing else differs.
- **Members:** anthropic (Claude CLI), openai (Codex CLI). Subscription transport, USD 0.00.
- **Verdict:** `option-2` — unanimous (2/2): withdraw the two undocumented slots
  (`pre_user_prompt`, `post_cascade_response`), keep `post_setup_worktree` cited from the
  live legacy Cascade page.

## Conditions both seats attached, and where each is met

| Condition | Met by |
|---|---|
| Attempt a probe and record the outcome | Not possible: neither Windsurf nor Devin Desktop is installed on the machine that ran the reading. Recorded in the row comment; `probe_at` stays null. |
| Upgrade removes the package's withdrawn entries and preserves user hooks | `WITHDRAWN_EVENTS` in `src/scripts/_lib/host_hook_merge.ts`: exact command-string equality per writer, foreign / edited / mixed entries kept. Ratified in `agents/evidence/ratifications/fix-host-docs-digest-drift-2805.md`. |
| Audit downstream consumers of the two slots | `hook_manifest.yaml` windsurf block, bridge golden, `docs/hook-payload-capture.md`, `docs/contracts/{install-layout,host-tool-vocabulary}.md`, `docs/enforcement-by-host.md`, two `agents/settings/contexts/` files. `verify-before-complete` on windsurf now only resets counters (no verdict, no block). |
| Ratify before release | The ratification record above, four rounds. |

## Reasons given

- Option 1 (cite an archived snapshot) couples evidence provenance to monitoring policy: a
  slot with its own `docs_url` is exempt from the watcher, and an archive proves past
  documentation, not execution.
- Option 3 (re-bind to `.devin/hooks.v1.json`) is a different host, not a migration of this
  row; both seats said it deserves its own decision rather than being folded in here.
- Withdrawing an unsupported claim does not establish the events stopped working; restoring
  them needs fresh evidence and its own ratification.

## Left open, named by the seats

- Whether `post_setup_worktree` (fires per new worktree) satisfies what `session_start`
  consumers assume — recorded in the row comment.
- Binding Devin Local as its own host.
