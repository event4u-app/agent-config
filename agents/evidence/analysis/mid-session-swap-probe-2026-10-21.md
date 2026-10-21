<!-- evidence-type: analysis -->

# Mid-session swap probe, re-run against the 17.0.0 hook command

Step 4.1 of `road-to-hook-guards-that-hold-17-findings`. Measured 2026-10-21 on
macOS, Node v26.7.0, npm 11.19.0, against a tarball packed from branch
`fix/hook-command-trust-order` (the trust-order and exit-guard commits of
PR #2573), repacked once with the version bumped so every round is a real
replacement.

## Result

**0 non-verdict exits** among **11,901** `PreToolUse` hook invocations fired
while five installs ran (two upgrades, two downgrades, all exiting 0). Every
invocation exited 0 — a dispatcher verdict for `Bash: ls`. The sequential
baseline: 100 of 100 exited 0.

The 2026-10-18 reading of the 16.x command
(`agents/evidence/analysis/mid-session-swap-probe-2026-10-18.md`) counted 490
failures in 4,190 invocations: 487 exit-127 (the `agent-config` binary missing
while npm replaced it) and 3 exit-1 (a half-written tree). Claude Code lets a
tool call through on any exit other than 2, so each was a silent pass of every
`fail_closed` guard.

## Why the window closed

The 17.0.0 command reaches the staged runtime under
`~/.event4u/agent-config/runtime/current` before `PATH`, so an npm replacement
of the global binary no longer sits on the hook's path at all; and on
`PreToolUse` any dispatcher exit other than 0 or 2 is turned into a refusal, so
a window that does open is refused rather than passed. This run produced no
refusals either: no invocation landed in such a window.

## How it was measured

One scratch directory outside the repository held `HOME`, the npm global
prefix, the npm cache and a consumer project. Install the first tarball
globally, run `agent-config global --no-ui`, read the installed `PreToolUse`
command from the sandbox's `~/.claude/settings.json`, fire it 100 times
sequentially, then fire it from two concurrent loops while the foreground
alternates `npm install -g <tarball>` and `agent-config global --no-ui --force`
four times. `--force` matters: without it a downgrade round refuses to re-stage
(`Recorded version 16.5.1, current 16.5.0`), and a first run without it
re-staged only on upgrades — 6,281 invocations, also 0 non-verdict exits, kept
here as the weaker reading. Each invocation records its exit code and whether
stderr carried the refusal text.

The probe script, verbatim:

```bash
#!/bin/bash
# Mid-session swap probe for the 17.0.0 hook command (road-to-hook-guards-that-hold 4.1).
set -u
SP="$1"; ROUNDS="${2:-4}"
export HOME="$SP/home" NPM_CONFIG_PREFIX="$SP/prefix" NPM_CONFIG_CACHE="$SP/cache" NPM_CONFIG_UPDATE_NOTIFIER=false
NODEDIR="$(dirname "$(command -v node)")"
export PATH="$SP/prefix/bin:$NODEDIR:/usr/bin:/bin"
rm -rf "$HOME" "$SP/prefix" "$SP/project" "$SP/log" && mkdir -p "$HOME" "$SP/prefix" "$SP/project" "$SP/log"
git -C "$SP/project" init -q
install() { npm install -g "$SP/event4u-agent-config-$1.tgz" >/dev/null 2>&1 && agent-config global --no-ui --force >/dev/null 2>&1; echo "install $1 rc=$?" >> "$SP/log/installs"; }
install 16.5.0
CMD="$(node -e 'const s=require(process.argv[1]);const g=s.hooks.PreToolUse;for(const x of g)for(const h of x.hooks)if(h.command.includes("dispatch:hook --platform claude")){console.log(h.command);process.exit(0)}' "$HOME/.claude/settings.json")"
[ -n "$CMD" ] || { echo "no PreToolUse command installed"; exit 1; }
printf '%s' "$CMD" > "$SP/log/command.txt"
IN='{"session_id":"probe","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"},"cwd":"'"$SP/project"'"}'
fire() { # $1 = tag, $2 = log
  printf '%s' "$IN" | CLAUDE_PROJECT_DIR="$SP/project" sh -c "$CMD" >/dev/null 2>"$SP/log/err.$1.$$"; rc=$?
  refused=0; grep -q "this tool call is refused" "$SP/log/err.$1.$$" && refused=1
  echo "$rc $refused" >> "$2"; rm -f "$SP/log/err.$1.$$"
}
for i in $(seq 1 100); do fire base "$SP/log/baseline"; done
loop() { while [ ! -f "$SP/log/stop" ]; do fire "s$1" "$SP/log/swap"; done; }
loop 1 & L1=$!; loop 2 & L2=$!
for r in $(seq 1 "$ROUNDS"); do
  if [ $((r % 2)) = 1 ]; then install 16.5.1; else install 16.5.0; fi
done
touch "$SP/log/stop"; wait $L1 $L2
echo "baseline: $(wc -l < "$SP/log/baseline") invocations, exit codes: $(cut -d' ' -f1 "$SP/log/baseline" | sort | uniq -c | tr '\n' ' ')"
echo "swap: $(wc -l < "$SP/log/swap") invocations, exit codes: $(cut -d' ' -f1 "$SP/log/swap" | sort | uniq -c | tr '\n' ' ')"
echo "swap refusals naming the repair: $(awk '$2==1' "$SP/log/swap" | wc -l)"
echo "swap non-verdict exits (neither 0 nor 2): $(awk '$1!=0 && $1!=2' "$SP/log/swap" | wc -l)"
cat "$SP/log/installs"
```
