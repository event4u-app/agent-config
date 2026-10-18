<!-- evidence-type: analysis -->

# Mid-session swap probe — what an `upgrade` does to a session that is running

> Evidence for steps **1.1**, **1.2** and **1.3** of
> `road-to-an-update-that-installs-itself-only-when-it-is-safe`. Measured
> 2026-10-18 on `main@fbc8e7c42`, macOS 26.6.2, Node v26.7.0, npm 11.19.0,
> against the two newest published releases, **16.4.0** and **16.5.0**.

## Result

**Error count: 490** hook invocations failed out of **4,190** fired while an
`upgrade` activation ran, across four swap rounds. The sequential baseline
before any swap: **0** failures out of **100**.

The count is non-zero, so step 1.2 takes its second branch: activation waits on
a live-session register, and no unattended swap ships until one exists.

## How it was measured

Everything ran inside one scratch directory outside the repository: `HOME`, the
npm global prefix, the npm cache and the consumer project all lived under it,
so neither the real global install nor the real `~/.claude/settings.json` was
read or written.

1. Install 16.4.0 globally into the sandbox prefix and run
   `agent-config global --no-ui`, which writes the sandbox's
   `~/.claude/settings.json` with the same hook wrapper a real install gets.
2. **Baseline:** fire each of `session_start`, `user_prompt_submit`,
   `pre_tool_use` (`Bash: ls`, so the fail-closed guards run), `post_tool_use`
   and `stop` twenty times, sequentially, through
   `agent-config dispatch:hook --platform claude --event <e> --native-event <N>`.
3. **Swap rounds:** two concurrent loops — two sessions — fire the same five
   events round-robin while the foreground runs the activation the `upgrade`
   verb runs: `npm install -g @event4u/agent-config@<v>` then
   `agent-config global --no-ui`. Rounds alternate 16.4.0 → 16.5.0 → 16.4.0 →
   16.5.0 → 16.4.0, so two are upgrades and two are downgrades.
4. Every invocation records event, exit code, wall time in ms, stdout bytes and
   stderr bytes. An error is any non-zero exit; the baseline establishes that
   every event's expected exit is 0.

## Swap rounds

| Round | Direction | Invocations | Errors | By exit code | By event |
|---|---|---|---|---|---|
| r1 | 16.4.0 → 16.5.0 | 2,040 | 144 | 127 × 144 | 28–30 per event |
| r2 | 16.5.0 → 16.4.0 | 180 | 120 | 127 × 118, 1 × 2 | 24 per event |
| r3 | 16.4.0 → 16.5.0 | 1,830 | 128 | 127 × 127, 1 × 1 | 25–26 per event |
| r4 | 16.5.0 → 16.4.0 | 140 | 98 | 127 × 98 | 18–20 per event |
| **total** | | **4,190** | **490** | 127 × 487, 1 × 3 | every event, `pre_tool_use` included |

The three exit-1 failures were the new code reading a half-written tree:

- `Error: Cannot find module './compose/composer.js'` (`post_tool_use`, r2)
- `Error: ENOENT: no such file or directory, open …` (`post_tool_use`, r2)
- `Error: Cannot find module '../common/null.js'` (`user_prompt_submit`, r3)

## What the 487 exit-127 failures mean in a real session

Exit 127 is the `agent-config` binary missing from `PATH` while npm replaces
the global package and its bin link. The hook wrapper `global` writes resolves
the binary first — `command -v "$BIN" >/dev/null 2>&1 || exit 0` — so in a real
session the same window has two outcomes:

- the binary is gone when the wrapper checks → the hook **exits 0 and does
  nothing**, which for a fail-closed `pre_tool_use` guard means the guard
  silently did not run;
- the binary is gone between the check and the exec → exit 127, a hook error
  the host shows.

Neither is a crash of the host, and neither is harmless: the first is a
silent hole in every fail-closed guard for the length of the swap.

## Step 1.2 — the branch taken

Non-zero. Activation of an unattended install waits on a live-session register,
which requires lifting `src/scripts/session_register_hook.ts` from repository
scope to global scope. That lift is its own step and nothing in this change
assumes it. Until it lands, the production wiring of `upgrade --unattended`
evaluates every gate and then refuses to swap, saying why.

## Step 1.3 — hook budget baseline, before any new concern

Sequential, 20 invocations per event, on the sandbox's 16.4.0 install. Wall time
includes process start of the dispatcher.

| Event | n | p50 ms | p95 ms | stdout bytes p50 | stdout bytes p95 | stderr bytes max | failures |
|---|---|---|---|---|---|---|---|
| session_start | 20 | 133 | 160 | 739 | 739 | 0 | 0 |
| user_prompt_submit | 20 | 149 | 169 | 0 | 0 | 0 | 0 |
| pre_tool_use | 20 | 115 | 125 | 209 | 209 | 0 | 0 |
| post_tool_use | 20 | 127 | 152 | 0 | 0 | 0 | 0 |
| stop | 20 | 213 | 238 | 0 | 0 | 0 | 0 |
| **all** | 100 | 137 | 232 | 0 | 739 | 0 | 0 |

Phase 3's `session_start` concern is measured against the `session_start` row:
p95 **160 ms**, **739** bytes.

## Limits of this reading

- One host, one machine, one pair of releases. A host with different hook
  timing, or a slower disk, moves the window; decision D6 names that as its
  revisit condition.
- The two loops are tighter than a real session, which fires hooks per turn,
  not continuously. That changes how many invocations land in the window, not
  whether the window exists.
- The probe fires through the binary on `PATH`. A project with a local
  `node_modules/@event4u/agent-config` takes the wrapper's first branch and is
  not exposed to a global swap at all.

## The probe

```bash
#!/bin/bash
# usage: probe.sh <S> <from-version> <to-version> <rounds>
set -u
S="$1"; FROM="$2"; TO="$3"; ROUNDS="${4:-3}"
export HOME="$S/home" npm_config_cache="$S/cache" npm_config_prefix="$S/prefix"
export PATH="$S/prefix/bin:$PATH"
unset CI AGENT_CONFIG_NO_UPDATE_CHECK CLAUDE_PROJECT_DIR
LOG="$S/probe.tsv"; : > "$LOG"
now_ms() { perl -MTime::HiRes=time -e 'printf "%d\n", time*1000'; }
payload() {
  case "$1" in
    pre_tool_use|post_tool_use) printf '{"session_id":"probe","hook_event_name":"x","tool_name":"Bash","tool_input":{"command":"ls"},"cwd":"%s"}' "$S/proj" ;;
    user_prompt_submit) printf '{"session_id":"probe","prompt":"list files","cwd":"%s"}' "$S/proj" ;;
    *) printf '{"session_id":"probe","cwd":"%s"}' "$S/proj" ;;
  esac
}
native() { case "$1" in session_start) echo SessionStart;; user_prompt_submit) echo UserPromptSubmit;; pre_tool_use) echo PreToolUse;; post_tool_use) echo PostToolUse;; stop) echo Stop;; esac; }
fire() { # phase event -> one TSV row: phase event rc ms stdout-bytes stderr-bytes stderr-head
  local phase="$1" ev="$2" t0 t1 rc out="$S/o.$$.$RANDOM" err="$S/e.$$.$RANDOM"
  t0=$(now_ms)
  payload "$ev" | agent-config dispatch:hook --platform claude --event "$ev" --native-event "$(native "$ev")" --project-dir "$S/proj" --min-version 1 >"$out" 2>"$err"
  rc=$?; t1=$(now_ms)
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$phase" "$ev" "$rc" "$((t1-t0))" "$(wc -c <"$out" | tr -d ' ')" "$(wc -c <"$err" | tr -d ' ')" "$(tr '\n\t' '  ' < "$err" | cut -c1-200)" >> "$LOG"
  rm -f "$out" "$err"
}
EVENTS="session_start user_prompt_submit pre_tool_use post_tool_use stop"
install_v() { npm install -g "@event4u/agent-config@$1" --no-audit --no-fund >/dev/null 2>&1; agent-config global --no-ui >/dev/null 2>&1; }
install_v "$FROM"
for i in $(seq 1 20); do for ev in $EVENTS; do fire baseline "$ev"; done; done
session_loop() { while [ -f "$S/swapping" ]; do for ev in $EVENTS; do fire "swap-$1" "$ev"; done; done; }
for r in $(seq 1 "$ROUNDS"); do
  if [ $((r % 2)) -eq 1 ]; then V="$TO"; else V="$FROM"; fi
  touch "$S/swapping"
  session_loop "r$r-a" & A=$!
  session_loop "r$r-b" & B=$!
  sleep 1; install_v "$V"; rm -f "$S/swapping"; wait $A $B
done
```

Run as `probe.sh <scratch-dir> 16.4.0 16.5.0 4`. The script above is the run's
script with line breaks folded; no step was changed.
