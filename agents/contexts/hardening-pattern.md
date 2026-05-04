# Hardening Pattern — Tier 1 Mechanical Rules

> Template extracted from the Phase 3 pilot of `road-to-rule-hardening.md`
> (rule: `roadmap-progress-sync`, platform: Augment PostToolUse). Every
> Tier 1 rule rolled out in Phase 4 follows this shape.

## Why mechanical hardening?

A Tier 1 rule has a binary-verifiable trigger: a file is written or it
isn't, a turn count crosses a threshold or it doesn't, a session starts
or it doesn't. When the trigger is binary, agent self-discipline is the
wrong enforcement layer — the runtime can check it deterministically.
Mechanical hardening converts the rule from "agent must remember" into
"the platform fires a hook; the rule body becomes the hook's
specification".

## The four pieces

Every hardened Tier 1 rule ships **four artefacts** together:

| # | Artefact | Path | Owner |
|---|---|---|---|
| 1 | **Hook script** (platform-agnostic) | `scripts/<rule>_hook.py` | This repo |
| 2 | **Augment trampoline** | `scripts/hooks/augment-<rule>.sh` | This repo |
| 3 | **Claude Code wiring** (Phase 4 onward) | `.claude/hooks/<rule>.sh` (symlink or shim) | This repo |
| 4 | **Rule body update** | `.agent-src.uncompressed/rules/<rule>.md` | This repo |

The hook script is the **truth**; the trampolines are thin shims; the
rule body cites the hook as the primary enforcement and demotes the
prose to "what the hook checks for, in case it ever silently fails".

## Hook script anatomy (Pilot 1 reference)

`scripts/roadmap_progress_hook.py` (160 LOC, stdlib only) is the
canonical shape:

1. **CLI** — `argparse` with `--platform NAME` (informational) and
   `--verbose`. Exit code is always 0.
2. **Stdin parser** — `json.load(sys.stdin)`; on malformed input, exit
   silently. Hooks **must never block the agent loop**.
3. **Trigger filter** — pull every plausible path from the payload
   (`file_changes`, `tool_input.path`, `tool_input.target`, …). Cross-
   platform field names are union-ed, not branched per platform.
4. **Tool allowlist** — explicit `WRITE_TOOLS` frozenset. New tool
   names default to "no trigger" so an MCP tool that happens to mention
   the path in its input does not cause spurious work.
5. **Domain check** — does any path match the rule's domain? For
   `roadmap-progress-sync`, that is the `agents/roadmaps/` prefix
   minus `archive/` and `skipped/`.
6. **Effect** — on hit, run the deterministic regenerator
   (`subprocess.run`, no shell, fixed argv). On miss, no-op.
7. **Stdout discipline** — Augment surfaces stdout to the user;
   stdout stays empty. `--verbose` may write **one short line** to
   stderr.

Hard caps from the pilot, used as defaults for new hooks:

- ≤ 200 LOC, stdlib only
- < 100 ms wall-clock per invocation on a clean repo
- No network access, no installed packages
- Exit 0 unconditionally

## Augment trampoline anatomy

`scripts/hooks/augment-<rule>.sh` (≈ 60 LOC) does three things:

1. Read the JSON event from stdin into a buffer.
2. Extract `workspace_roots[0]`; bail silently when missing or not a
   directory or no `./agent-config` entrypoint.
3. `cd` into the workspace and re-pipe the JSON into
   `./agent-config <rule>:hook --platform augment`.

Always exit 0. The trampoline is per-rule because Augment registers
hooks individually, but the dispatcher path inside `agent-config`
keeps the implementation single-sourced.

## Cross-platform parity (Phase 4 contract)

Production = Augment + Claude Code, both. A rule is "hardened" only
when both platforms have a working hook. Cursor / Cline / Windsurf
parity is tracked as a deferred follow-up under the
`hardening-platform-parity` GitHub label, with the specific capability
gap recorded (e.g. "Cursor lacks PostToolUse"). Deferred ≠ rejected;
it is a backlog the next roadmap can drain.

## Rule body update template

After the hook is wired, the rule body changes in three places:

1. **Top of the rule** — add a one-line `Enforced by:` callout that
   names the hook script and the supported platforms.
2. **Iron Law section** — keep the prose; the hook is the
   enforcement, the prose is the spec.
3. **See also** — link to this pattern doc and the hook script, so
   the next maintainer can find the four artefacts at once.

The rule's character budget under Model (b) only includes the prose;
the hook script lives outside the always-budget surface.

## When to NOT mechanically harden

- Rule's trigger requires reading code or chat semantics → Tier 2 or
  Tier 3, not Tier 1.
- Hook would need to call out to an LLM to decide → out of scope.
- Trigger overlaps with a `/`-command the user invokes manually →
  prefer the command (see `rule-type-governance` § convert-to-command).

## Reference implementation

- Hook: [`scripts/roadmap_progress_hook.py`](../../scripts/roadmap_progress_hook.py)
- Trampoline: [`scripts/hooks/augment-roadmap-progress.sh`](../../scripts/hooks/augment-roadmap-progress.sh)
- Rule body: `.agent-src.uncompressed/rules/roadmap-progress-sync.md`
- Tier classification: [`rule-trigger-matrix.md`](rule-trigger-matrix.md) (`roadmap-progress-sync` → Tier 1)
