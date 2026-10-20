<!-- evidence-type: analysis -->

# Independent review — the lazy-concern chunk and the two new concerns

One seat, `openai` (codex CLI, subscription transport), 2026-10-20, invoked
directly rather than through `council_cli`: six council runs over three hours
timed out at the 300 s seat timeout with zero characters on both seats, on a
host running eighteen concurrent council processes from sibling lanes.
The `anthropic` seat was asked the same question the same way and returned nothing.

**This is one seat, not a council, and it is labelled as one.** Provider
diversity is not satisfied, so it does not discharge the ratification
contract — it is a review whose findings were acted on, recorded here so the
next round starts from them rather than from the refused claim.

Prompt: `lazy-concern-chunk-20261020-direct-prompt.md`.

## Verdict

> VERDICT: refused
> 
> Matze, I checked the three gated files, lazy loader/registry, stdin bridge, both new concern implementations, package contents, targeted tests, ADR-291, and the ring-0 record.
> 
> 1. The chunk mechanism itself is non-expanding: it changes execution location, retains digest verification, and preserves the historical spawn route. However, the stated premise is incorrect: `chat-history` is bound to `session_start`, `session_end`, `stop`, `user_prompt_submit`, and `post_tool_use` on multiple platforms—not `session_start` only. The budget derivation must be corrected.
> 
> 2. A missing, invalid, or mis-digested chunk is latency-only under the shipped package: loading returns `null`, `_run_concern` uses the spawn path, and `src/scripts/` is included in `package.json`. This holds unless both chunk and shipped source are unavailable/corrupt.
> 
> 3. The global stdin override does not ordinarily disclose another concern’s envelope. Dispatch is synchronous and sequential; each invocation overwrites the string and clears it in `finally`. Separate serialized strings preserve mutation isolation. This relies on the existing synchronous-concern contract; asynchronous/re-entrant concern execution would invalidate that isolation and should remain prohibited/tested.
> 
> 4. `update-auto-invite` fits advisory/notification authority: it only emits a question, never changes `update.mode`, and has CI/TTY/headless/JSON/subagent/verified-success/once-only gates. The human-maintained `ring-0-exit: yes` record is an adequate additional rollout gate, although it is governance evidence, not a security boundary.
> 
> `update-notice` does not fit its declared `effect: notification`. It can autonomously spawn `upgrade --unattended` and thereby mutate the installation. Existing `update.mode: auto`, later-session activation, locking, and re-run gates constrain that authority, but do not make it non-expanding: this change newly grants the hook lifecycle an installation trigger. `fail_closed: false` and `severity: advisory` describe failure handling, not permitted effects.
> 
> Summary: chunking and stdin sharing are acceptable; the manifest cannot be ratified while a mutation-capable concern is classified as notification/advisory and the budget rationale contains a false binding claim.
> hook: Stop
> hook: Stop Completed
> tokens used
> 63.293
> VERDICT: refused
> 
> Matze, I checked the three gated files, lazy loader/registry, stdin bridge, both new concern implementations, package contents, targeted tests, ADR-291, and the ring-0 record.
> 
> 1. The chunk mechanism itself is non-expanding: it changes execution location, retains digest verification, and preserves the historical spawn route. However, the stated premise is incorrect: `chat-history` is bound to `session_start`, `session_end`, `stop`, `user_prompt_submit`, and `post_tool_use` on multiple platforms—not `session_start` only. The budget derivation must be corrected.

## What was done about it

- **Finding 1 (the binding claim is false)** — verified against the manifest:
  `chat-history` is bound on `session_start`, `session_end`, `stop`,
  `post_tool_use` and `user_prompt_submit` across seven hosts. The derivation
  in `src/config/hook-bundle-budget.json` and the roadmap text were corrected
  in place, the correction says what was wrong and how it happened, and the
  genuinely narrow-event candidates were measured and recorded for a redo.
- **Finding 2 (`effect: notification` does not fit)** — the activation seam
  was removed from `update-notice` rather than the closed effect vocabulary
  widened. The concern stages and reports; `upgrade --unattended` installs.
- **Findings 2–4 that passed** — the spawn-path fallback, the stdin
  isolation under the synchronous-concern contract, and
  `update-auto-invite`'s fit for advisory/notification are recorded as
  checked rather than assumed.
