<!-- evidence-type: original-review -->

# Ratification prompt, round 1 — copilot and codex hooks rows re-established for issue #3028 (verbatim, as sent 2026-11-25)

~~~text
Ratification review (modification review), round 1, of one change touching src/scripts/hooks/host_lowering.yaml and its compiled sibling src/scripts/hooks/host_lowering.json, two files on this repository's ratification watched set (hook-plumbing sources).

subject: a55ffadad2c00495238162e00f18e420c6c941a1b8a955bec0bc00664acf8d9b

Commit reviewed: c22472160ff8552f39c05c23e69eaefe19fb6d9f (branch fix/host-docs-digest-copilot-codex, base origin/main 8bcc444530).

Closed verdicts (ADR-268 § 4): ratified (an approved expansion of what an agent may do) · confirmed-non-expanding (no authority expanded, no gate weakened, no enforcing step made non-enforcing) · refused (must not land).

Context. host_lowering.yaml records, per host, how a dispatcher verdict is lowered into that host's hook contract and what this package has established about it. Each row carries verified.docs_url (the page read), docs_at (the day the page was read for the row's answers), docs_digest (sha256 of the body that reading was against) and expires (policy: docs_at + 1 year for rows established by a dated documentation read). A weekly watcher (check_host_docs_digest --fetch) re-fetches every docs_url; when the digest moves on a row that claims no native-event token it goes red as CHANGED and asks for the page to be read and the row re-established by hand. The scheduled run of 2026-11-23 did that for copilot/any and codex/any (issue #3028). Both rows bind no slot (slots: {}, json_shape: none, fail_policy: discard). Both pages were fetched on 2026-11-25; their sha256 values are 6ddad1a9c73ba0d51ba3673fbb0b4d3e0dc0b7772d109b4a2746cce2fe9c6135 (copilot) and 37cdbfc3b9d19925f88af3e680399fd61bd3d15979961302160f97698cc5a841 (codex), equal to the digests the scheduled run saw. The reading was done by an agent session. Precedent: the owner ruled on 2026-11-11 (issue #2951 record) that an agent reading counts as the fill for an empty-slot row, scoped to that row; on 2026-11-25 the owner directed this session in chat to take care of the open issues, #3028 included, which is a transcribed chat direction, not a forge act.

Excerpts of the copilot page as fetched 2026-11-25 (https://docs.github.com/en/copilot/reference/hooks-reference.md), verbatim lines (wide table cells truncated):
  * **Repository-level hook files** — `.github/hooks/*.json` in the repository root.
  * **User-level hook files** — `*.json` files in the user-level hooks directory. By default this is `~/.copilot/hooks/` on macOS and Linux, or `%USERPROFILE%\.copilot\hooks\` on Windows. If `COPILOT_HOME` is set, it is `$COPILOT_HOME/hooks/`.
  * **Inline `hooks` block in repository settings** — the `hooks` field at the top level of `.github/copilot/settings.json` (Git committed) or `.github/copilot/settings.local.json` (typically gitignored and user specific) in the repository. Cross-tool `.claude/settings.json` and `.claude/settings.local.json` files in the repository are also read.
  * **Inline `hooks` block in user-level config** — the `hooks` field at the top level of `~/.copilot/settings.json`. The CLI no longer reads `~/.copilot/config.json` for hooks.
| Trust           | Repository and inherited-agent hooks require workspace admission. Hook-disable settings, enterprise restrictions, and timeouts still apply. |
| `agentStop`             | The main agent finishes a turn.                                                                                                                         
| `errorOccurred`         | An error occurs during execution.                                                                                                                       
| `permissionRequest`     | Fires before the permission service runs (rules engine, session approvals, auto-allow/auto-deny, and user prompting). If the merged hook output returns 
| `postToolUse`           | After each tool completes successfully.                                                                                                                 
| `preToolUse`            | Before each tool executes.                                                                                                                              
| `sessionEnd`            | The session terminates.                                                                                                                                 
| `sessionStart`          | A new or resumed session begins.                                                                                                                        
| `subagentStop`          | A subagent completes.                                                                                                                                   
| `userPromptSubmitted`   | The user submits a prompt.                                                                                                                              
| `permissionRequest` | `toolName`                         |
| `postToolUse`       | `toolName`                         |
| `preToolUse`        | `toolName`                         |
> **Command vs HTTP fail behavior for `preToolUse`:** Command `preToolUse` hooks are **fail-closed** on errors—a crash or non-zero exit (including exit `2`) denies the tool call, even if the hook's stdout JSON reports `permissionDecision: "allow"`. Command hook **timeouts are always fail-open, even for `preToolUse` and admin-deployed policy hooks**—a timed-out hook surfaces a warning and lets the tool call proceed through the normal permission flow instead of denying it. HTTP `preToolUse` hooks are **fail-open**—a network error, timeout, or non-2xx response falls through to the default permission flow. Choose the variant that matches your security requirements.
If multiple hooks of the same type are configured, they execute in order. For `preToolUse`, if any hook returns `"deny"`, the tool is blocked. For most events, hook failures (non-zero exit codes other than `2`, or timeouts) are logged and skipped. **Exception: `preToolUse` command hooks are fail-closed on exit `2` and on non-timeout errors**—exit `2`, a crash, or any other non-zero exit (other than a timeout) denies the tool call, even if the hook's stdout JSON reports `permissionDecision: "allow"`. **Timeouts are always fail-open, including for `preToolUse` and admin-deployed policy hooks**: a warning is surfaced and the tool call proceeds through the normal permission flow rather than being denied.
| `2`            | Treated as a warning by default. `stderr` is surfaced to the user but the run continues. For `permissionRequest` and `preToolUse`, exit `2` is treated as a deny: any `stdout` JSON is merged with the deny decision and the tool call is denied even if that JSON reports `permissionDecision: "allow"`. For `postToolUseFailure`, exit `2` is treated as `additionalContext` and `stdout` is appended to the failure shown to the agent.                                                                                                                                                                                                                                         |
| Other non-zero | Logged as a hook failure. The run continues (fail-open). **Exception: `preToolUse` is fail-closed**—a non-zero exit (other than exit 2) denies the tool call with `"Denied by preToolUse hook (hook errored)"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Timeout        | Killed after `timeoutSec`. Error logged, execution continues. **Timeouts are fail-open for every event, including `preToolUse` and admin-deployed policy hooks**—a warning is surfaced and processing proceeds as if the hook had not run. For `preToolUse`, the tool call proceeds through the normal permission flow rather than being denied. A crashed or explicitly-denying hook still fails-closed; only timeouts are exempt. The logged message includes the command that timed out, for example `Hook command timed out after 30 seconds: my-validation-script.sh` (the bash/PowerShell script text, or `program arg1 arg2 …` for exec hooks), truncated to 80 characters. |

Excerpts of the codex page as fetched 2026-11-25 (https://learn.chatgpt.com/docs/hooks.md), verbatim lines (headings list included to show the event set):
## Where Codex looks for hooks

Local Codex looks for `hooks.json` in the locations below. In each directory,
you can also declare hooks inline under `[hooks]` in `config.toml`.

| Scope                    | `hooks.json` location                   |
| ------------------------ | --------------------------------------- |
| System (macOS and Linux) | `/etc/codex/hooks.json`                 |
| System (Windows)         | `%ProgramData%\OpenAI\Codex\hooks.json` |
| User                     | `$CODEX_HOME/hooks.json`                |
| Trusted project          | `.codex/hooks.json`                     |

If `CODEX_HOME` is unset, the user file is `~/.codex/hooks.json` on macOS and
Linux and `%USERPROFILE%\.codex\hooks.json` on Windows.

## Review and trust hooks

Codex lists configured hooks before deciding which ones can run. Before a
non-managed hook can run, Codex requires you to review and trust the exact hook
definition. Codex records trust against the hook's current hash, so new or
changed hooks are marked for review and skipped until trusted.

Use `/hooks` in the CLI to inspect hook sources, review new or changed hooks,
trust hooks, or disable individual non-managed hooks. If hooks need review at
startup, Codex prints a warning that tells you to open `/hooks`.

Managed hooks from system, MDM, cloud, or `requirements.toml` sources are marked
as managed, trusted by policy, and can't be disabled from the user hook browser.

For one-off automation that already vets hook sources outside Codex, pass
`--dangerously-bypass-hook-trust` to run enabled hooks without requiring
persisted hook trust for that invocation.

### Configure an MCP tool hook
### Expand arguments from the hook event
### Execution and lifecycle
### Hooks with cloud orchestration
### Managed hooks in local Codex
### Tool coverage
### Large hook output
### Configure a background hook
### How background hooks run
### Limitations
### SessionStart
### SessionEnd
### SubagentStart
### PreToolUse
### PermissionRequest
### PostToolUse
### PreModelRequest and PostModelRequest
### PreCompact
### PostCompact
### UserPromptSubmit
### SubagentStop
### Stop
### Interrupt
### Plain-text aliases
You can also use exit code `2` and write the blocking reason to `stderr`.
You can also use exit code `2` and write the feedback reason to `stderr`.
You can also use exit code `2` and write the blocking reason to `stderr`.
You can also use exit code `2` and write the continuation reason to `stderr`.
You can also use exit code `2` and write the continuation reason to `stderr`.

Diff of host_lowering.yaml against origin/main:
diff --git a/src/scripts/hooks/host_lowering.yaml b/src/scripts/hooks/host_lowering.yaml
index e7553fb178..51358bcf44 100644
--- a/src/scripts/hooks/host_lowering.yaml
+++ b/src/scripts/hooks/host_lowering.yaml
@@ -377,13 +377,25 @@ hosts:
         # as well, and says the CLI no longer reads hooks from
         # `~/.copilot/config.json`. Verification metadata refreshed; no slots
         # enabled.
+        #
+        # RE-READ 2026-11-25 after the digest watch flagged a changed body again
+        # (issue #3028). The page still documents the eight events above,
+        # `~/.copilot/hooks/` as the default user-level directory on macOS and
+        # Linux, and the same `preToolUse` refusal contract: exit 2, a crash or
+        # any other non-zero exit denies the tool call even over a stdout
+        # `allow`; a command-hook timeout is always fail-open; an HTTP
+        # `preToolUse` hook is fail-open on a network error, timeout or non-2xx
+        # response. It now also names an inline `hooks` block in
+        # `~/.copilot/settings.json` as a user-level source, and says
+        # repository and inherited-agent hooks require workspace admission.
+        # Verification metadata refreshed; no slots enabled.
         verified:
-          docs_at: 2026-11-11
+          docs_at: 2026-11-25
           docs_url: https://docs.github.com/en/copilot/reference/hooks-reference.md
-          docs_digest: 09bfeebbddfe6fce6e49fd9eec180d40409311f5bc62ed97374dfc37b7201f7e
+          docs_digest: 6ddad1a9c73ba0d51ba3673fbb0b4d3e0dc0b7772d109b4a2746cce2fe9c6135
           probe_at: null
           host_version: null
-          expires: 2027-11-11
+          expires: 2027-11-25
         slots: {}
 
   codex:
@@ -446,11 +458,25 @@ hosts:
         # twelve events listed above, `~/.codex/hooks.json`, and exit 2 with the
         # reason on stderr; it adds `PreModelRequest` / `PostModelRequest`.
         # Re-dated only: the probe above is unchanged and still the gate.
+        #
+        # RE-READ 2026-11-25 after the digest watch flagged a changed body
+        # (issue #3028). The page still documents all twelve events listed
+        # above plus `PreModelRequest` / `PostModelRequest`,
+        # `~/.codex/hooks.json` as the user file when `CODEX_HOME` is unset, and
+        # exit 2 with the reason on stderr. It now also documents hook trust:
+        # a non-managed hook runs only after its exact definition is reviewed
+        # and trusted, trust is recorded against the hook's hash, and a new or
+        # changed hook is skipped until trusted. That is a THIRD unexcluded
+        # explanation for the 2026-10-01 probe — the hook may have been skipped
+        # as untrusted — though this tree has not established that the trust
+        # gate existed in 0.148.0. It is recorded, not acted on: the probe is
+        # unchanged and still the gate. Verification metadata refreshed; no
+        # slots enabled.
         verified:
-          docs_at: 2026-11-07
+          docs_at: 2026-11-25
           docs_url: https://learn.chatgpt.com/docs/hooks.md
-          docs_digest: a50c60b697d8df62e2f907adbb18b2f5a1a25cd3360e7b843cde25f18ab6d782
+          docs_digest: 37cdbfc3b9d19925f88af3e680399fd61bd3d15979961302160f97698cc5a841
           probe_at: 2026-10-01
           host_version: 0.148.0
-          expires: 2027-11-07
+          expires: 2027-11-25
         slots: {}

host_lowering.json (compiled by compile_hook_manifest --table host-lowering; one line), semantic diff against origin/main:
.body_fingerprint: "2309c1133d0aa292d735a81650c8c709568236f69369c194772d49f083fe16ac:6187" -> "4bc7ae7f826f095b9fe1fcaa0484163ebcfaa9fe36ec778f7300e7fb9cbf8b68:6187"
.fingerprint: "cef28ca633b4e97230dd9482edcfc1ef3a1385817fd959f530f02011b09e887f:26079" -> "4ba8b56dde0152a6d1615a64b724e59cc917c75be843950a430c856c9766f5a4:27849"
.table.hosts.codex.surfaces.any.verified.docs_at: "2026-11-07" -> "2026-11-25"
.table.hosts.codex.surfaces.any.verified.docs_digest: "a50c60b697d8df62e2f907adbb18b2f5a1a25cd3360e7b843cde25f18ab6d782" -> "37cdbfc3b9d19925f88af3e680399fd61bd3d15979961302160f97698cc5a841"
.table.hosts.codex.surfaces.any.verified.expires: "2027-11-07" -> "2027-11-25"
.table.hosts.copilot.surfaces.any.verified.docs_at: "2026-11-11" -> "2026-11-25"
.table.hosts.copilot.surfaces.any.verified.docs_digest: "09bfeebbddfe6fce6e49fd9eec180d40409311f5bc62ed97374dfc37b7201f7e" -> "6ddad1a9c73ba0d51ba3673fbb0b4d3e0dc0b7772d109b4a2746cce2fe9c6135"
.table.hosts.copilot.surfaces.any.verified.expires: "2027-11-11" -> "2027-11-25"

Nothing else is in the change. Checks after the edit: check_host_docs_digest --fetch reports no drift (5 unchanged, 5 confirmed); lint_hook_manifest passes.

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

Also check both new comment paragraphs against the excerpts: does either state anything the page does not support? List findings, then close with exactly one line of the form
STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>

~~~
