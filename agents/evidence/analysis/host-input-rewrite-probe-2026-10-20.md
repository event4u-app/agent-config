<!-- evidence-type: analysis -->
# Host input-rewrite probe — Claude Code 2.1.304

The structured record `rewrite_capability.ts` reads for the `input` channel. The
probe itself, its commands, hook scripts and every observation, is step 0.2 of
`host-output-rewrite-probe-2026-10-20.md`, run in the same session on the same
host; this file exists because a capability record names one channel.

host: claude
host_version: 2.1.304
channel: input
result: delivered

What `delivered` rests on, from that record's 0.2 table: a PreToolUse hook that
returned `updatedInput` alone, with no `permissionDecision`, made the Bash call
run with the replaced input, and the PostToolUse envelope and the host's own
telemetry both carried the replaced input. Two limits stay with the record and
not with this line: with `permissionDecision: "ask"` a non-interactive session
denies the call rather than prompting, and the model's own `tool_use` block keeps
its original input on the next turn while the hook's stdout reaches the
transcript verbatim.
