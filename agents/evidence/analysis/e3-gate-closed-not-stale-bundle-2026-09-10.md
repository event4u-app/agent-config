---
title: The E3 injection gate is closed by configuration, not by a stale hook bundle
date: 2026-09-10
---
<!-- evidence-type: analysis -->

# The E3 injection gate is closed by configuration, not by a stale hook bundle

`road-to-delivery-on-hook-hosts` step 1.1's second limb has never been met. Since
2026-09-09 the roadmap and its `no-host-observed-true-injection` blocker both
explain that with a **stale local hook bundle**, and both prescribe
`npm run build:hooks` plus one session as the cheap fix.

That explanation is wrong, and the prescription closes nothing. Reproduced here
at `09d9bc760`, on a bundle rebuilt the same day.

## Four measurements

Identical payload throughout — a `user_prompt_submit` envelope whose prompt
(`"refactor this legacy module and clean up the duplication"`) trips three
labelled rules — and identical repository root.

| # | invocation | bytes out | rule bodies |
|---|---|---:|---|
| 1 | `npx tsx src/scripts/hooks/dispatch_hook.ts` | 17,823 | 3 (16,378 B) |
| 2 | the same, with `AGENT_CONFIG_REPLAY=1` | **826** | none |
| 3 | `node dist/hooks/dispatch.js` (freshly built) | **826** | none |
| 4 | the same bundle, with `lean_projection.mode: delivery` set | **17,823** | 3 |

Row 3 was taken after `npm run build:hooks` — the prescribed fix — and again
after `task preflight` had independently rebuilt and verified the bundle
byte-identical to a rebuild from source (`sha256 72a0909d356d`). The bundle is
neither stale nor broken.

## What the rows say

**Rows 2 and 3 are the same number, and that is the finding.** The source and
the built dispatcher agree exactly once the probe branch is switched off. The
826 B they both emit is the language-mirror pin and nothing else.

**Row 1 is the probe branch, and the module says so in its own words.**
`gateOpen` (`src/scripts/hooks/rule_inject_hook.ts:314-320`) ends with
`return cliEntry && process.env['AGENT_CONFIG_REPLAY'] !== '1'`, documented
directly above as *"A DIRECT CLI invocation is a probe by definition — an
operator piping an envelope into this file is asking to see what it would
deliver — so there the gate defaults to open."* `_isCliEntry()` (`:388`) returns
`false` unconditionally when `__AGENT_CONFIG_BUNDLE__` is set, which is why the
bundle never takes that branch. `AGENT_CONFIG_REPLAY=1` re-imposes the gate on
the source path, and row 2 is what that produces.

**Row 4 is the actual cause.** `gateOpen`'s first clause is
`deliversBodies(mode) && hosts.includes(DELIVERY_HOST)`. `deliversBodies`
(`src/scripts/_lib/lean_projection_mode.ts:42-44`) returns true for exactly one
value, `'delivery'`. `DEFAULT_LEAN_PROJECTION_MODE` at `:21` is **`'eager-all'`**.
There is no `.agent-settings.yml` in this repository — it is gitignored at
`.gitignore:317` and its absence is deliberate, since absent IS the CI shape — so
`leanProjectionModeRaw` returns `''`, the mode normalises to `eager-all`, and the
first clause is false. The second clause (`hooks.rule_inject` opt-in) is false for
the same reason: no settings file. So in every real session here the gate is
**closed**, and the concern emits nothing because it is configured not to.

## The two claims this corrects

Both appear in the roadmap's step 1.1 and again in the blocker body:

1. *"`lean_projection.mode` resolves to `delivery` and `lean_projection.hosts` to
   `["claude-code"]` from the shipped defaults, with nothing set in any settings
   file."* — The hosts half is right (`DEFAULT_LEAN_PROJECTION_HOSTS` is
   `['claude-code']`, `:67`). The mode half is not: the shipped default is
   `eager-all`, and `deliversBodies` accepts only `delivery`.
2. *"`gateOpen` … therefore returns true here."* — It returns true **under a
   probe**. Every measurement offered as evidence that the carrier works
   (5,346 B, 6,458 B, and row 1's 17,823 B) was taken on the probe path, which
   is the branch that exists precisely so an operator can see what the gate
   would deliver if it were open.

The second is the sharper error, and it has the shape the roadmap's own K1
warns about one layer further in: a probe measurement read as a statement about
the configured tree. The earlier round refused to write `observed-true` off
byte-equivalence for exactly that reason, then diagnosed the carrier off a probe.

## What actually closes step 1.1's second limb

Not `npm run build:hooks`. Row 4 is the closing move: `.agent-settings.yml` at
the repository root carrying

```yaml
lean_projection:
  mode: delivery
  hosts:
    - claude-code
```

then one live Claude Code session, a prompt that trips a labelled rule, and a
**second party** reading the transcript for the turn that reflects the delivered
body. The independence requirement is unchanged and is not satisfied by this
document: the observer may not be the session that produced the turn.

Two things worth stating about that config edit rather than discovering them
afterwards. It is local and gitignored, so it changes this machine and no
consumer. And it is not free: row 4 measures 17,823 bytes of injected context on
a single prompt, which lands in every turn whose prompt trips a labelled rule.

## Reproduction

```bash
P='{"session_id":"probe","cwd":"'"$PWD"'","prompt":"refactor this legacy module and clean up the duplication"}'
printf '%s' "$P" | npx tsx src/scripts/hooks/dispatch_hook.ts --platform claude --event user_prompt_submit | wc -c
printf '%s' "$P" | AGENT_CONFIG_REPLAY=1 npx tsx src/scripts/hooks/dispatch_hook.ts --platform claude --event user_prompt_submit | wc -c
npm run build:hooks
printf '%s' "$P" | node dist/hooks/dispatch.js --platform claude --event user_prompt_submit | wc -c
printf 'lean_projection:\n  mode: delivery\n  hosts:\n    - claude-code\n' > .agent-settings.yml
printf '%s' "$P" | node dist/hooks/dispatch.js --platform claude --event user_prompt_submit | wc -c
rm -f .agent-settings.yml   # absent is the CI shape; do not leave it behind
```
