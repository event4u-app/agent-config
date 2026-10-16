<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-16 for branch fix/gate-header-matches-hooks-20261016,
     round 2, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch fix/gate-header-matches-hooks-20261016, round 2 — delta after round 1

Round 1 (prompt `agents/evidence/council/gate-header-matches-hooks-review-20261016.question.md`, reviewed `91dd93b6c`): anthropic APPROVE; openai REQUEST_CHANGES — the two guard-specific statements are credible, but "neither is denied" and "the only layer" are universal claims resting on two guards; either enumerate every registered tool-call guard or scope the sentence to what was verified.

Disposition (`7a66dd1ac`): both, enumerate AND scope.

- Enumeration, from the tree: the `pre_tool_use` slot in `src/scripts/hook_manifest.yaml` binds `block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, memory-recall` (one profile adds `one-question-per-ask`, `spawn-guard-shadow`, `source-first-gate`). The guard-shaped ones in the compiled manifest are `block-no-verify`, `block-kernel-rule-writes`, `block-plumbing-writes`, `block-speaking-inbox-dir`, `block-config-weakening`, `reread-guard`.
- Probe, empirical rather than read: the hook bundle was built in the branch's worktree (`npm run build:hooks`) and a `PreToolUse` payload for an `Edit` of each path was sent through the real dispatcher (`dist/hooks/dispatch.js --platform claude --event pre_tool_use`). Results: `src/scripts/hooks/dispatch_hook.ts` → exit 0, no deny; `src/scripts/_lib/kernel_rules.ts` → exit 0, no deny. Controls through the same harness: `hooks/hooks.json` → exit 2, "BLOCKED — hooks/hooks.json is a build output, not a source"; `src/rules/non-destructive-by-default.md` → exit 2, "BLOCKED — kernel rule non-destructive-by-default is immutable". So the harness can see a deny, and none of the bound concerns denies either path.
- Scope: the sentence now names its population — "No `pre_tool_use` concern bound in `hook_manifest.yaml` denies an edit to either" — instead of a bare universal.

```diff
- * Neither is denied at tool-call time: the plumbing guard protects three
- * generated build outputs and names `dispatch_hook.ts` only where it reads one,
- * and the kernel-rule write guard imports `kernel_rules.ts` without protecting
- * it. For these two paths the record this gate demands is the only layer, not a
- * second one beside a deny.
+ * No `pre_tool_use` concern bound in `hook_manifest.yaml` denies an edit to
+ * either: the plumbing guard protects three generated build outputs and names
+ * `dispatch_hook.ts` only where it reads one, and the kernel-rule write guard
+ * imports `kernel_rules.ts` without protecting it. For these two paths the
+ * record this gate demands is the only layer, not a second one beside a deny.
```

Not taken here, named by anthropic as a follow-up: a machine-checked assertion of which hooks deny these paths. Step 4.3's verify, `grep -c 'also denied at tool-call time'`, still reads 0.

Review the delta and the evidence. Report any remaining defect with file:line, scenario and severity. State your stance (APPROVE or REQUEST_CHANGES).
