<!-- evidence-type: original-review -->

# Ratification prompt, round 1 — copilot hooks row re-established for issue #2951 (verbatim, as sent 2026-11-11)

~~~text
Ratification review (modification review), round 1, of one change touching src/scripts/hooks/host_lowering.yaml and its compiled sibling src/scripts/hooks/host_lowering.json, two files on this repository's ratification watched set (hook-plumbing sources).

subject: 6f96714494e24d92e7dd4d58d959f6dd1539fc251f1bcacae5de5b48f4973e85

Commit reviewed: e5a31617b0ed1793d8d444a2d6d3bf46994cc6e9 (branch fix/host-docs-digest-drift, base origin/main 417e7b56df).

Closed verdicts (ADR-268 § 4): ratified (an approved expansion of what an agent may do) · confirmed-non-expanding (no authority expanded, no gate weakened, no enforcing step made non-enforcing) · refused (must not land).

Context. host_lowering.yaml records, per host, how a dispatcher verdict is lowered into that host's hook contract and what this package has established about it. Each row carries verified.docs_url (the page read), docs_at (the day a human read it), docs_digest (sha256 of the body that reading was against) and expires (policy: docs_at + 1 year for rows established by a dated documentation read). A weekly watcher (check_host_docs_digest --fetch) re-fetches every docs_url; when the digest moves on a row that claims no native-event token (copilot binds no slot, slots: {}), it goes red as CHANGED and asks a human to read the page and re-establish the row by hand. The scheduled run of 2026-11-09 did that for copilot/any (issue #2951). The page was fetched on 2026-11-11; its sha256 is 09bfeebbddfe6fce6e49fd9eec180d40409311f5bc62ed97374dfc37b7201f7e, equal to the digest the scheduled run saw.

Excerpts of the page as fetched 2026-11-11 (https://docs.github.com/en/copilot/reference/hooks-reference.md), verbatim lines:
  * **Repository-level hook files** — `.github/hooks/*.json` in the repository root.
  * **User-level hook files** — `*.json` files in the user-level hooks directory. By default this is `~/.copilot/hooks/` on macOS and Linux, or `%USERPROFILE%\.copilot\hooks\` on Windows. If `COPILOT_HOME` is set, it is `$COPILOT_HOME/hooks/`.
  * **Inline `hooks` block in user-level config** — the `hooks` field at the top level of `~/.copilot/settings.json`. The CLI no longer reads `~/.copilot/config.json` for hooks.


## Hook events

The table below lists every supported event. The **Cloud agent** column shows whether the event fires under cloud agent and notes any behavior differences.

| Event                   | Fires when                                                                                                                          
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------
| `agentStop`             | The main agent finishes a turn.                                                                                                     
| `errorOccurred`         | An error occurs during execution.                                                                                                   
| `notification`          | Fires asynchronously when the CLI emits a system notification (shell completion, agent completion or idle, permission prompts, elici
| `permissionRequest`     | Fires before the permission service runs (rules engine, session approvals, auto-allow/auto-deny, and user prompting). If the merged 
| `postToolUse`           | After each tool completes successfully.                                                                                             
| `postToolUseFailure`    | After a tool completes with a failure.                                                                                              
| `preCompact`            | Context compaction is about to begin (manual or automatic). Supports a `matcher` regex pattern (the value of the `matcher` field) to
| `preToolUse`            | Before each tool executes.                                                                                                          
| `sessionEnd`            | The session terminates.                                                                                                             
| `sessionStart`          | A new or resumed session begins.                                                                                                    
| `subagentStart`         | A subagent is spawned (before it runs). Supports a `matcher` regex pattern (the value of the `matcher` field) to filter by agent nam
| `subagentStop`          | A subagent completes.                                                                                                               
| `userPromptSubmitted`   | The user submits a prompt.                                                                                                          
| `userPromptTransformed` | Fires after the runtime transforms a submitted prompt into its model-facing content, just before that content is emitted and persist

> **Command vs HTTP fail behavior for `preToolUse`:** Command `preToolUse` hooks are **fail-closed** on errors—a crash or non-zero exit (including exit `2`) denies the tool call, even if the hook's stdout JSON reports `permissionDecision: "allow"`. Command hook **timeouts are always fail-open, even for `preToolUse` and admin-deployed policy hooks**—a timed-out hook surfaces a warning and lets the tool call proceed through the normal permission flow instead of denying it. HTTP `preToolUse` hooks are **fail-open**—a network error, timeout, or non-2xx response falls through to the default permission flow. Choose the variant that matches your security requirements.
Return empty output or `{}` to fall through to the normal permission flow. For command hooks, exit code `2` is treated as a deny; stdout JSON (if any) is merged with `{"behavior":"deny"}`, and stderr is ignored.
If multiple hooks of the same type are configured, they execute in order. For `preToolUse`, if any hook returns `"deny"`, the tool is blocked. For most events, hook failures (non-zero exit codes other than `2`, or timeouts) are logged and skipped. **Exception: `preToolUse` command hooks are fail-closed on exit `2` and on non-timeout errors**—exit `2`, a crash, or any other non-zero exit (other than a timeout) denies the tool call, even if the hook's stdout JSON reports `permissionDecision: "allow"`. **Timeouts are always fail-open, including for `preToolUse` and admin-deployed policy hooks**: a warning is surfaced and the tool call proceeds through the normal permission flow rather than being denied.
## Exit codes for command hooks

| Exit code      | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`            | Success. `stdout` is parsed as the hook output JSON if present.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `2`            | Treated as a warning by default. `stderr` is surfaced to the user but the run continues. For `permissionRequest` and `preToolUse`, exit `2` is treated as a deny: any `stdout` JSON is merged with the deny decision and the tool call is denied even if that JSON reports `permissionDecision: "allow"`. For `postToolUseFailure`, exit `2` is treated as `additionalContext` and `stdout` is appended to the failure shown to the agent.                                                                                                                                                                                                                                         |
| Other non-zero | Logged as a hook failure. The run continues (fail-open). **Exception: `preToolUse` is fail-closed**—a non-zero exit (other than exit 2) denies the tool call with `"Denied by preToolUse hook (hook errored)"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Timeout        | Killed after `timeoutSec`. Error logged, execution continues. **Timeouts are fail-open for every event, including `preToolUse` and admin-deployed policy hooks**—a warning is surfaced and processing proceeds as if the hook had not run. For `preToolUse`, the tool call proceeds through the normal permission flow rather than being denied. A crashed or explicitly-denying hook still fails-closed; only timeouts are exempt. The logged message includes the command that timed out, for example `Hook command timed out after 30 seconds: my-validation-script.sh` (the bash/PowerShell script text, or `program arg1 arg2 …` for exec hooks), truncated to 80 characters. |


Diff of host_lowering.yaml against origin/main:
diff --git a/src/scripts/hooks/host_lowering.yaml b/src/scripts/hooks/host_lowering.yaml
index 9898075e4e..694a06e71b 100644
--- a/src/scripts/hooks/host_lowering.yaml
+++ b/src/scripts/hooks/host_lowering.yaml
@@ -365,13 +365,22 @@ hosts:
         # fails open). It now also states that exit 2 on any other event is only
         # a warning, and lists further events (`subagentStart`, `preCompact`,
         # `userPromptTransformed`, …). Re-dated only; nothing is armed.
+        #
+        # RE-READ 2026-11-11 after the digest watch flagged a changed body again
+        # (issue #2951). The page still documents the eight events above at
+        # `~/.copilot/hooks/` and the same `preToolUse` refusal contract: exit 2,
+        # a crash or any other non-zero exit denies the tool call even over a
+        # stdout `allow`; a command-hook timeout is always fail-open; an HTTP
+        # `preToolUse` hook is fail-open. It also names `permissionRequest`, on
+        # which exit 2 is a deny as well, and no longer reads hooks from
+        # `~/.copilot/config.json`. Re-dated only; nothing is armed.
         verified:
-          docs_at: 2026-11-07
+          docs_at: 2026-11-11
           docs_url: https://docs.github.com/en/copilot/reference/hooks-reference.md
-          docs_digest: c139227723d63a785dc09ef59bdad59468f08647ce9e05fe545fae05284777dc
+          docs_digest: 09bfeebbddfe6fce6e49fd9eec180d40409311f5bc62ed97374dfc37b7201f7e
           probe_at: null
           host_version: null
-          expires: 2027-11-07
+          expires: 2027-11-11
         slots: {}
 
   codex:

host_lowering.json (compiled by compile_hook_manifest --table host-lowering; one line), semantic diff against origin/main:
.body_fingerprint: "9870d6c1ba360673ec4caa842c2e33b28bf2007ea4b5948050cf4957b7821b03:6187" -> "2309c1133d0aa292d735a81650c8c709568236f69369c194772d49f083fe16ac:6187"
.fingerprint: "0c453c2b87808d07ff8c5c2a50429ed544ae6e3d7e9a64822373da0dcbd95e7f:25284" -> "d8867bcc2a0ce101a8eb39985ed8f1f641f35f76a9b98b94a4f8b41773540eea:25911"
.table.hosts.copilot.surfaces.any.verified.docs_at: "2026-11-07" -> "2026-11-11"
.table.hosts.copilot.surfaces.any.verified.docs_digest: "c139227723d63a785dc09ef59bdad59468f08647ce9e05fe545fae05284777dc" -> "09bfeebbddfe6fce6e49fd9eec180d40409311f5bc62ed97374dfc37b7201f7e"
.table.hosts.copilot.surfaces.any.verified.expires: "2027-11-07" -> "2027-11-11"

Nothing else is in the change. Checks after the edit: check_host_docs_digest --fetch reports no drift (copilot/any unchanged); see the commit for the rest.

Questions — answer each, keyed by its id:
1. behaviour-change: What behaviour changes, including what follows from it that the diff does not state?
2. boundary-direction: Which authority or safety boundary becomes wider or narrower, and in which direction?
3. weakens-its-own-judge: Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. route-around: Is another host or projection left as a way around the control this change touches?
5. undo: Can it be undone, and how — by whom, with what authority, and against which revision?
6. falsifier: What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. smaller-change: Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. instruction-weight: What does it add to standing instruction weight that every later session pays?
9. untrusted-steering: Could untrusted content steer the path this change opens, and what bounds it if so?

Also check the new comment paragraph against the excerpts: does it state anything the page does not support? List findings, then close with exactly one line of the form
STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>

~~~
