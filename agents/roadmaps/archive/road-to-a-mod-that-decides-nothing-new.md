---
complexity: lightweight
status: archived
tree_pin: c073ca2e5a
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Owner search before writing: grep -rlF -e 'claude plugin' -e 'modules' -e 'tool.check' over agents/roadmaps/*.md, agents/roadmaps/later and agents/roadmaps/stubs, plus agents/roadmaps-owned.md read for neighbour/plugin/status-line/fill rows. Hits mention plugins or modules in other senses (MCP, graph, gateway); road-to-plugin-runtime-borrowings is an external-reference harvest frozen behind ADR-211, not Claude Code mods. No roadmap owns host-owned Claude Code modules. Count half: +1 active (3 -> 4, inside the owner WIP cap of 5); one-in-one-out half: this file is the one added active roadmap and carries this claim. Rejected alternatives: merging into road-to-host-inputs-the-installer-honours (owns policy-aware doctor output, not a shipped host module; its mods finding went there as an arrival); parking in later/ (the owner asked for execution in this run); archiving an unrelated finished roadmap to buy the slot (would hide the growth, and the WIP cap still has a free slot)."
relates:
  - slug: road-to-host-inputs-the-installer-honours
    relation: disjoint
    note: "Owns the policy-aware hook doctor (its H2: disableAllHooks / allowManagedHooksOnly). This round's allowManagedModsOnly finding landed there as an arrival; nothing here edits hook_effect_doctor."
  - slug: road-to-mod-surfaces-that-read-what-ac-knows
    relation: disjoint
    note: "The parked remainder of the same round: further surfaces, blast preview, sensor and holder, learning queue, mission-control pane, init registration, live-session probes. Wakes when this roadmap's read-only module ships."
---
# Road to a mod that decides nothing new

> **Source:** `agents/tmp.old/inbox-2026-10-av/` — one owner transcript (four
> user turns) and three plans on Claude Code mods; the master plan is the
> operative one, the two earlier ones are its parents. Claims re-verified and the
> load-bearing host claims reproduced in the host's own harness:
> [`claude-code-mod-harness-probes-2026-10-25`](../../evidence/analysis/claude-code-mod-harness-probes-2026-10-25.md).

## Goal

Agent-config knows Claude Code mods exist and can show one thing it already
measures inside the host, without deciding anything there. Concretely: the two
README sentences that are false or blocking today are corrected; ADR-124 has a
recorded class for a host-owned module; `doctor neighbours` lists every installed
plugin that ships a hooks module and what kind of events it hooks; and the package
ships one opt-in, read-only module that turns the existing
`agents/runtime/state/context-fill.json` into a status line, with its call surface
pinned in CI.

**Guiding line (kept from the source):** the dispatcher decides, for every host the
same way; a mod only reads and shows what the dispatcher already wrote.

## Context

- AC records context fill (`session_eol_hook.ts:275-290`) and nothing reads it back;
  no `"statusLine"` is written anywhere under `src/`. Mods are the first host surface
  that can show such state without a model call.
- A user-installed mod can override AC's deny rows and PreToolUse refusals on an
  unmanaged account, and nothing in `src/` or `docs/` mentions mods
  (0 hits for `prependPlugins`, `next.trace`, `tool.check`, `allowManagedModsOnly`).
- Reproduced on Claude Code 2.1.310: a read-only module declares exactly
  `$.fs.exists`, `$.fs.read`, `$.ui.status` in `claude plugin validate`, which makes
  the call surface pinnable; `$.fs.read` resolves relative paths against the
  session's working directory. A display hook that throws is skipped by the host,
  which is the right failure for a reader — so no `.catch` is needed on it
  (`.catch` matters only for a guarding hook, which this roadmap does not build).

## Phase 1 — Two README sentences that are false today

- [x] **1.1 Correct the replay claim (`README.md:168-169`).** It says every hook <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: dist/install/install.mjs -->
      concern lands in `agents/runtime/state/` "so you can replay it"; the journal
      is off by default (`src/scripts/hook_manifest.yaml:1568`). Say that the
      record is opt-in and name how it is switched on.
      verify: `grep -c "so you can replay it" README.md` -> /^0$/ (nothing found), and the
      new sentence names the opt-in; `task check-claims` (or the claims gate the
      README is bound to) is green.
- [x] **1.2 Narrow the non-goal (`README.md:218`).** "Runtime GUI / web dashboard" <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: dist/install/install.mjs -->
      stays a non-goal, but an opt-in host status surface that only reads existing
      state is not one, and the sentence would block Phase 4 in review.
      verify: the row still lists the web dashboard as a non-goal and names the
      read-only host surface as outside it; claims gate green.

## Phase 2 — A recorded class for a host-owned module

- [x] **2.1 Write the ADR amending ADR-124 with Class H "host-owned module".** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: dist/install/install.mjs -->
      A module that runs inside the host's worker for the session, started and
      stopped by the host, holding state only in the host's stores and never
      authoritative, is neither Class A (AC process per command) nor Class B
      (resident AC process, permitted under ADR-249's governance). Class conditions:
      decides nothing the dispatcher did not decide (I1), rewrites no input or
      prompt (I2, ADR-285), declares only `$.fs.read`, `$.fs.exists`, `$.ui.*` (I3),
      reads only, so a throw is a skip (I4), and every value it shows is also
      reachable as text on other hosts (I5). Add the amendment pointer to ADR-124.
      verify: `grep -c 'Class H' docs/decisions/ADR-124-embedded-engine-doctrine.md` -> /^[1-9]/; `./scripts-run src/scripts/check_new_adr_evidence` exits 0;
      the ADR index lists the new record.

## Phase 3 — Mods in the neighbour census

- [x] **3.1 Read installed plugins that ship a hooks module.** `census()` reads <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: dist/install/install.mjs -->
      `~/.claude/plugins/installed_plugins.json` (version 2: `plugins.<id>[].installPath`)
      and, per install path, `hooks/hooks.json`. A `modules` array marks the plugin
      as a mod. For each module file, a static source scan classifies it:
      **verdict-capable** (`'tool.check'`, `'tool.call'`, `'plugin.register'`),
      **prompt-capable** (`'prompt.`, `'session.append'`), **process/net**
      (`$.process`, `$.http`), else **display-only**. The scan reads; it never
      runs the module. A missing or unparsable file is reported, never guessed.
      verify: a fixture home with three plugins (one verdict-capable, one
      prompt-capable, one display-only) yields exactly those three classes; a
      fixture with a broken `installed_plugins.json` reports it and lists none;
      tests fail when the classification is neutralised.
- [x] **3.2 Show it in `doctor neighbours`.** One section listing each mod with its <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: dist/install/install.mjs -->
      class, and one line stating the honest limit: a verdict-capable mod can
      override AC's refusals on an unmanaged account, and the census cannot tell
      load order. Silent when no mod is installed.
      verify: CLI test over the fixture home prints the section; over an empty
      home it prints nothing about mods.

## Phase 4 — One read-only module, opt-in, pinned

- [x] **4.1 Ship the module.** `src/templates/claude-mod/` with <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: dist/install/install.mjs -->
      `.claude-plugin/plugin.json` (with `"hooks": "./module/hooks.json"`),
      `.claude-plugin/marketplace.json` (source `./`), `module/hooks.json`
      (`{"modules":["./register.ts"]}`), `module/register.ts`, `README.md`, `LICENSE`.
      `corrected-from-reproduction`: the plan put the config at `hooks/hooks.json`,
      a path the `block-plumbing-writes` guard reserves for generated output; the
      manifest field was verified to work in `validate` and `test`. One hook: `turn.complete` awaits `next(e)`, then sets
      the status line from `context-fill.json` when it exists with
      `schema_version: 1`; silent otherwise. No other hook.
      verify: `claude plugin validate src/templates/claude-mod` -> /calls: \$\.fs\.exists, \$\.fs\.read, \$\.ui\.status/
- [x] **4.2 Pin the call surface in CI without needing the host.** A vitest test <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: dist/install/install.mjs -->
      reads `register.ts` and fails on any of `$.process`, `$.http`, `$.model`,
      `$.fs.write`, `engine.create`, and on any hooked event outside
      `turn.complete`. The host's `claude plugin validate` and `claude plugin test`
      are run by hand and recorded in the evidence file: a conditional skip in the
      suite counts as a net-added suppression under `check_test_weakening`.
      verify: adding `$.process.spawn` to a copy of the module reds the first test.
- [x] **4.3 Host-harness contract tests.** `module/register.test.ts` beside the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: dist/install/install.mjs -->
      module: file present → status line; file absent → silent; wrong
      `schema_version` → silent.
      verify: `claude plugin test src/templates/claude-mod` → 3 pass.
- [x] **4.4 Stage it with the runtime and document the opt-in.** Add the module to <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: dist/install/install.mjs -->
      `STAGED_ENTRIES` in `src/install/stagedRuntime.ts`, so it lands under the
      versioned runtime. Document the one opt-in command
      (`claude plugin marketplace add <runtime>/src/templates/claude-mod` then
      `/plugin install`) in the module README and in the doctor section from 3.2.
      Nothing is registered automatically. The module's TypeScript is exempted from
      the stage's no-source filter (its test file is not).
      verify: the staged-runtime test lists the module path; the doctor output
      names the opt-in command.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Own roadmap, not a fold. | No roadmap owns Claude Code mods (owner search in frontmatter). | an owner appears for host surfaces |
| D2 | reversible-technical | evidence | The module is opt-in; nothing is installed or registered automatically. | ADR-291 (existing installs are asked, never flipped); a default flip needs measured benefit first. | the module has run long enough to measure use |
| D3 | reversible-technical | evidence | Carrier: the versioned staged runtime plus one documented `marketplace add`; `init` does not register it in this roadmap. | Whether the host records a path behind `runtime/current` resolved or literal is unmeasured (evidence W0.1(c)); auto-registration waits for that probe in the parked remainder. | the probe shows the literal path is kept |
| D4 | reversible-technical | evidence | One module, not five; the five parent functions keep their content in the parked remainder. | The owner asked why the five were dropped; the answer in the source is that only the packaging was dropped: logic stays in the dispatcher (multi-host, ADR-285), and the band above the prompt holds one mod at a time. The source's "five multiply the crash risk" argument was retracted by its own author and is not used. | a measurement shows a load-time or conflict advantage for separate modules |
| D5 | reversible-technical | evidence | ADR form is an amendment to ADR-124 (Class H), not a supersede. | The core of ADR-124 — AC starts no unsupervised resident process — is unchanged; a host-owned module is no AC process. | ADR-124 is superseded |
| D6 | reversible-technical | evidence | Mod classification is a static source scan, not a `claude plugin validate` spawn from `doctor`. | `doctor` must work on hosts without the Claude CLI; the scan is labelled best-effort. | the scan misclassifies a real module |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The module drifts into deciding | product | A later edit adds a guarding hook or a prompt rewrite and the module becomes a second decision point beside the dispatcher | The 4.2 static test refuses any event but `turn.complete` and any call outside the read/ui set; widening it needs the ADR's class conditions changed first | Phase 4 — One read-only module, opt-in, pinned |
| 2 | Static scan reads as a verdict | product | `doctor` labels a mod display-only while it hooks a verdict through an indirection the scan cannot see | Section names the scan as best-effort; a module the scan cannot read is reported as unreadable, never as display-only | Phase 3 — Mods in the neighbour census |
| 3 | Template `.ts` breaks the repo build | implementation | `register.ts` imports types from `claude-code`, which the repo's TypeScript and lint configs cannot resolve | Exclude `src/templates/claude-mod/` from the repo `tsc` and lint globs; the host's own `validate` is the type check | Phase 4 — One read-only module, opt-in, pinned |
| 4 | Silent in a subdirectory | implementation | `$.fs.read` resolves against the working directory, so a session started below the project root shows nothing | The module README states it; silence is the correct failure, never a wrong number | Phase 4 — One read-only module, opt-in, pinned |

## Acceptance Criteria

- [x] AC-1 — `README.md` no longer promises a replay a default install cannot give,
      and no longer lists a read-only host status surface as a non-goal.
- [x] AC-2 — A recorded ADR classifies a host-owned module and binds it to the
      five class conditions; ADR-124 points to it.
- [x] AC-3 — `doctor neighbours` lists installed mods with a class on a fixture home
      and says nothing about mods on an empty one.
- [x] AC-4 — The package ships a module whose only hook is `turn.complete` and whose
      call surface is held to the read/ui set by a CI test that runs without the
      Claude CLI.
