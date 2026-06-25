# The governance advantage — why compile-time, config-space governance is the moat

Most agent-config packages are a pile of skills. This one's defensible edge is
not skill *count* — it is **where the governance lives**: compiled into every
host's own instruction layer at projection time, so it travels with the config
and is present on every host by construction. Runtime-hook systems can only
enforce where the host exposes a tool lifecycle — a minority of hosts.

This is a **structural** claim, not a behaviour claim. See the honesty boundary
at the end.

## The two enforcement layers (and their reach)

| Layer | How it works | Reach |
|---|---|---|
| **Compile-time (config space)** | Rules + Iron Laws are compiled into each host's native instruction format at projection time (`.cursorrules`, `.windsurfrules`, `copilot-instructions.md`, `GEMINI.md`, Claude/Augment native rule dirs). | **Every projection target.** |
| **Runtime hooks** | On hosts exposing a tool lifecycle (`PreToolUse`/`PostToolUse`/`Stop`), a guard can deterministically block a call (e.g. `block_no_verify`). | **Hook-capable hosts only** (~2 of the supported set). |

Full per-host breakdown: [`enforcement-by-host.md`](enforcement-by-host.md).

The point: a runtime-first competitor's strongest enforcement simply **does not
exist** on a host that has no hook surface. The compile-time layer is there on
*that same host* because it rides in the config the host already reads.

## Governance in action — three concrete traces

### 1. A safety-floor rule survives projection into a static host
`commit-policy` (`tier: safety-floor`) is compiled into Cursor's `.cursorrules`
and Copilot's `copilot-instructions.md`. The host has no hook to block a
`git commit`, but the constraint is **in the instruction file the host loads at
session start** — present by construction, not dependent on a runtime primitive
the host lacks (a static host gives it no runtime attention guarantee, but a
runtime-only system gives it nothing at all here). A runtime-only system contributes *nothing* on these hosts.

### 2. Intent routing, not a 500-artefact dump
A prompt does not load all 258 skills. `dist/router.json` (88 rules, intent →
skill, keyword/phrase/path triggers) carries the right skill on intent. The
governance value is *selection discipline* — the host gets the relevant rule
set, not the whole catalogue as context ballast.

### 3. The enforcement spectrum is explicit, not implied
On Claude Code / Cline (MCP) the safety-floor constraints get **both** layers:
compile-time instruction **and** a deterministic runtime block. On Cursor /
Windsurf / Copilot / Gemini they get the compile-time layer alone. We state
which host gets which — we never imply "deterministic everywhere".

## What this is NOT (honesty boundary)

- **Not "un-strippable".** A human can edit any projected file. The claim is
  *present-by-construction on every host* — a host's runtime cannot selectively
  ignore it the way it ignores an absent runtime hook.
- **Not a measured behaviour-change claim.** A length-controlled A/B
  (hardened-constraint blocks vs a length-matched placebo) measured **honest-null
  at the discipline ceiling** — the cooperative rules already catch the test
  traps, so *adding emphasis* changed nothing measurable. The moat is that
  governance is **present and portable across hosts**, not that more governance
  prose provably changes a model's behaviour.
- **Not deterministic on static hosts.** Compile-time governance is
  model-cooperative; only hook-capable hosts get a hard block.

## Why it's hard to copy

A runtime-first system would have to re-author its governance to live in
config space and project into every host's native format — i.e. become a
content+governance layer — to match the reach. That is a different architecture,
not a feature bolt-on. Meanwhile this package adds runtime hooks as an opt-in
*superset* where hosts allow it, without depending on them for the floor.

## See also

- [`enforcement-by-host.md`](enforcement-by-host.md) — per-host enforcement mechanism.
- [`capability-matrix.md`](capability-matrix.md) — which artifact type projects to which host.
