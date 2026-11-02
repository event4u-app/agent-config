---
complexity: lightweight
status: ready
tree_pin: af5ab4dc22
execution:
  mode: phase-checkpoints
review_by: 2026-12-15
estate_growth_exempt: "+1 active_roadmaps, owner-directed 2026-11-02 in the /analyze:inbox invocation (\"danach arbeite die roadmaps ab mit /roadmap:process-full\"): the operator asked for an active roadmap in the invocation itself, the one exception to the later/ default of /analyze:inbox Phase 6."
estate_offset_exempt: "No owner exists. Search at af5ab4dc22: grep -rlF -e CLAUDE_CODE_REMOTE -e cloud-clone -e 'cloud session' over agents/roadmaps (active, later, stubs) returned nothing; the one tmp.old hit (inbox-2026-09-i, hook-policy surface dimension) names cloud only as a surface column of a different subject."
---
# Road to an install the cloud clone carries

> **Source:** `agents/tmp.old/inbox-2026-11-f/` (one proposal, drafted against `0bf05a0b45`, 1264 commits behind the pin).
> **Arrivals:** 1 — `inbox-2026-11-f` (2026-11-02). Partial precursor: `inbox-2026-09-i` named cloud as a hook *surface*, never the delivery gap.

## Goal

A Claude Code cloud session (claude.ai/code, `claude --cloud`, cloud routines)
starts on a fresh clone of the repository and reads only what is committed plus
server-managed settings. agent-config installs Claude Code into `~/.claude/` and
`~/.event4u/agent-config/` only, so such a session receives **zero skills, zero
rules and zero hooks — silently**, including the three fail_closed guards. This
roadmap makes that gap measured, then loud, then documented, and leaves the
delivery choice to the owner with the evidence in hand.

**Host facts** (code.claude.com/docs `cloud-environments` and `settings`
§ Settings in cloud sessions, re-read 2026-11-02): repo `.claude/settings.json`
hooks load in a single-repository session and not in a multi-repository one;
user `~/.claude/settings.json` is not read; plugins under repo `enabledPlugins`
are not installed; `CLAUDE_CODE_REMOTE` is `true` in the session VM and never
locally; setup scripts run as root and cache only under ~5 minutes; the default
network level (Trusted) allows `registry.npmjs.org`; self-hosted runners run
hooks an operator seeded into the runner's `~/.claude/`.

## Verified claims (at `af5ab4dc22`)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| D1 | Claude Code consumer install is global-only | still-true | `src/scripts/install.ts:1668`, `:1829-1832`, ADR-020 |
| D2 | Hooks only in `~/.claude/settings.json`, resolve the runtime under `$HOME` | still-true | `src/scripts/_lib/claude_settings_hooks.ts:186-194` |
| D3 | Project `.claude/settings.json` carries only `enabledPlugins` for a deprecated plugin | still-true | `install.ts:935-940`, `README.md:217` |
| D4 | Managed gitignore block ignores `.claude/skills|commands|agents|CLAUDE.md` | still-true | `src/config/gitignore-block.txt:28-31` |
| D5 | `CLAUDE_CODE_REMOTE` appears nowhere in the tree | still-true | `git grep -c CLAUDE_CODE_REMOTE` → no hit |
| D6 | `.gitignore` says `.claude/settings.json` stays tracked; nothing under `.claude/` is | still-true | `.gitignore:171`, `git ls-files .claude` → empty |
| (a) | A setup script writing `~/.claude/` delivers hooks | **never-true for hooks** | host docs: user `settings.json` is not read in cloud sessions |

## Phase 0 — Measure before building

- [x] **0.1 Cloud-reach measurement.** `src/scripts/_lib/cloud_reach.ts`
      counts what a clone carries — tracked files under `.claude/skills|rules|agents|commands`,
      managed hooks in a tracked `.claude/settings.json`, whether that file only
      enables a plugin — read from `git ls-files`, never from the working tree.
      verify: `npx vitest run tests/scripts/cloud_reach.test.ts` → 0, with an
      untracked-projection fixture reading 0/0/0/0 and a committed-hook fixture reading 1.
- [x] **0.2 Clone simulation probe.** `src/scripts/cloud_clone_probe.ts` clones a
      repository locally into a temp dir (no network), sets `HOME` to an empty
      dir and `CLAUDE_CODE_REMOTE=true`, and emits the measurement as JSON.
      verify: run on this repository; the baseline lands in
      `agents/evidence/analysis/cloud-clone-baseline-2026-11-02.json` reading 0 hooks.
- [~] **0.3 One real cloud session.** Run `/context` and `/hooks` in a <!-- deferred-resolution: carried-to=road-to-an-install-the-cloud-clone-carries-carried -->
      claude.ai/code session on this repository and on a consumer fixture; confirm
      (b) Node `>=22.6.0` on the cloud PATH and (c) install time under the cache limit.
      Deferred: needs a human in a real cloud session; nothing in this tree can run it.

## Phase 1 — Not silent any more

- [x] **1.1 `doctor` check `cloud-reach`.** Read-only. Under
      `CLAUDE_CODE_REMOTE=true` with no managed hook carried: `warn`, one line, with
      the remedy pointing at `docs/setup/cloud-sessions.md`. Locally: `ok`, stating
      what a clone of this repository would carry.
      verify: the test above asserts both branches and that the check writes nothing.
- [~] **1.2 Committed SessionStart hook in consumer repos.** A hook that prints the <!-- deferred-resolution: carried-to=road-to-an-install-the-cloud-clone-carries-carried -->
      same line inside the cloud session itself. Deferred: it writes into consumer
      repositories by default — a consumer-facing default change, owner decision
      bundled with 2.1.

## Phase 2 — A delivery path the clone carries

- [~] **2.1 Choose and build variant B** (`init --carry=repo`, opt-in: the hook <!-- deferred-resolution: carried-to=road-to-an-install-the-cloud-clone-carries-carried -->
      matrix byte-identical in `.claude/settings.json`, a SessionStart bootstrap that
      installs the runtime from npm only when `CLAUDE_CODE_REMOTE=true`). Variant A
      (setup script) is closed by the host docs for hooks. Deferred: owner decision —
      new consumer-facing install mode and a hook-time network call.
      verify: the clone probe reports the three fail_closed guards active and a
      local run shows no double fire.

## Phase 3 — Leftovers

- [x] **3.1 Correct the `.gitignore` comment** that claims `.claude/settings.json`
      stays tracked (D6, comment only).
      verify: `git ls-files .claude` agrees with the comment.
- [~] **3.2 Stop writing `enabledPlugins` for the deprecated plugin** (D3). <!-- deferred-resolution: carried-to=road-to-an-install-the-cloud-clone-carries-carried -->
      Deferred: changes what `init` writes into every consumer repo; owner decision,
      same batch as 2.1.
- [~] **3.3 Commit a `.claude/settings.json` with hooks for this repository** (D6). <!-- deferred-resolution: carried-to=road-to-an-install-the-cloud-clone-carries-carried -->
      Deferred: depends on the 2.1 choice.

## Phase 4 — Documentation per surface

- [x] **4.1 `docs/setup/cloud-sessions.md`** — Anthropic-hosted (what arrives,
      what does not, the two delivery options and their status), self-hosted runner
      (seed `~/.claude` and `~/.event4u/agent-config` into the image), Remote
      Control (local, unaffected). Every host statement carries the doc URL and the
      retrieval date; linked from README § Installation.
      verify: `grep -n cloud-sessions README.md` → one link; the reference checker passes.

## Kills (carried from the source, all accepted)

- No auto-commit of the full skill and rule projection into consumer repos (double
  delivery locally, repo bloat; `docs/contracts/install-scopes.md`).
- No marketplace-plugin path (not loaded in the cloud, deprecated).
- No default reliance on server-managed settings (only an org owner sets them).
- No secrets in environment variables of a cloud environment.
- No network at hook time beyond the one npm bootstrap of 2.1; no automatic `git rm --cached`.

## Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| The `cloud-reach` check is noise for consumers who never use cloud sessions | medium | `ok` locally; it only warns inside a cloud session |
| Host behaviour changes (docs re-read 2026-11-02) | medium | every host statement dated and linked; 0.3 re-measures |
| Variant B double-fires hooks locally if the host does not dedupe | medium | 2.1 verify line requires a no-double-fire run before ship |

## Acceptance Criteria

- AC-1 The clone measurement exists, is tested, and its baseline for this repository is recorded.
- AC-2 `doctor` warns inside a cloud session that carries no agent-config hook, and is silent-ok locally.
- AC-3 A reader of README § Installation reaches a page stating what a cloud session receives.
- AC-4 The owner decision on 1.2 / 2.1 / 3.2 / 3.3 is asked with the measurement attached.

## Decisions

| # | Decision | Rung | Record |
|---|---|---|---|
| 1 | Variant A (setup script) does not carry hooks | tree + host docs | Goal § Host facts |
| 2 | Consumer-facing write changes (1.2, 2.1, 3.2, 3.3) wait for the owner | owner-reserved (consumer default change) | Phase deferrals |
