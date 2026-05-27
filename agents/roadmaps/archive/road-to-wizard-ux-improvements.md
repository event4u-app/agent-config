---
complexity: structural
status: active
---

# Roadmap: Wizard UX — first-run detection, fresh-start, tool-list cleanup

> Follow-up to the now-working browser wizard (PR #254 single-install +
> PR #256 `init` opens the GUI). This roadmap collects UX improvements to the
> install/setup wizard — primarily the AI-tools step (Step 1) and the
> session-start behaviour. Items are captured from maintainer feedback and
> will be planned into concrete changes once the list is final.
>
> **Status: in execution** (finalized 2026-05-27, `/roadmap:process-full`).
> Design forks resolved via AI council; see per-step notes.

## Goal

Make the wizard's first run effortless and honest: every fresh launch starts
at the beginning, the AI-tools step reflects what is actually installed
(pre-selection + per-tool badges), and the tool list shows each tool exactly
once.

## Phase 1 — Fresh start on every new session

- [x] A new wizard window/launch starts from the **first step**, not from the
      previously-reached step. <!-- GET /api/v1/wizard/state now resumes from the per-server in-memory session only; a fresh boot returns initialStep regardless of any on-disk wizard-state.json -->
- [x] **Reset policy — RESOLVED: server-boot = fresh.** Each `init`/`setup`
      launch starts a fresh server, so treat "new server boot" as "new run":
      on boot, ignore/clear the persisted `wizard-state.json` and land on
      Step 1. Resume only happens **within the same running server lifetime**
      (e.g. a browser refresh mid-session, so progress isn't lost). No
      cross-launch disk-resume; no time-window heuristic. <!-- impl: src/server/routes/wizard.ts — memState is the sole resume source for all modes; readState removed; disk write kept as a crash breadcrumb. Regression test: tests/server/wizard.state.test.ts "GET /state ignores a stale on-disk wizard-state.json" -->
  - Today `GET /api/v1/wizard/state` reads the on-disk state and resumes the
    last step with no run/session identifier (`src/server/routes/wizard.ts`
    `readState`) — that's the bug. The fix lives at the server-boot / state-read
    layer (reset-on-boot or boot-scoped in-memory state), not in the SPA.

## Phase 2 — AI-tool detection on Step 1 (AI tools)

> Step-0 finding: today's `detectToolPresence` (`src/install/detect.ts:169`)
> covers only 5 tools and checks the **project** for agent-config bridge dirs
> (`.claude`, `.cursor`, …) — i.e. "we set up a bridge here", NOT "the tool is
> installed on the system". The Step-1 list has **16** tools.

- [x] **Detect native system presence per tool — RESOLVED: all 16 tools.** <!-- src/install/toolDetection.ts: data-driven signal table (homePaths / absPaths / $PATH bins) for all 23 VALID_TOOLS ids; injectable home/pathEnv. Surfaced via GET /api/v1/wizard/detect-tools (wizard.ts, extended-mode). Best-effort: signal-less tools report false. Tests: tests/install/toolDetection.test.ts (6). -->
- [x] **First run:** pre-select the detected/installed tools on Step 1. <!-- loadToolDetectionOnce() seeds selectedTools from detected tools only when the selection is untouched (first run); re-runs keep the user's selection. -->
- [x] **Per-tool badge:** "installed / not installed" behind each tool on Step 1, works on first run. <!-- AiToolsStepBody renders an .ac-badge per tool from toolPresence; loaded on entering the ai-tools step (loadAll + goTo). -->

## Phase 3 — De-duplicate the tool list (Step 1)

- [x] "Claude Code" and "claude-code" currently appear as two entries — that is
      a duplicate. Show only **one** of them on Step 1. <!-- root cause: AiToolsStepBody rendered `{label} <code>{id}</code>` → "Claude Code claude-code". Fix: show only the human label (dropped the raw id). -->

## Phase 4 — Capability-packs step (Step 2, "Which capability packs do you want?")

- [x] **Tiles/cards.** The page is messy today. Wrap each pack entry in a tile
      (title + description grouped) so the layout looks polished and it is
      visually clear what belongs together.
- [x] **De-duplicate.** "Engineering Base" / "engineering-base" appears twice —
      show only **one**.
- [x] **Dependency-aware clustering — keep the setup as simple as possible.**
  - Don't list everything separately. Packs that are implied by another
    selection should not be shown as standalone entries.
  - **Engineering Base is auto-installed whenever it's needed** (a dependency,
    not a user choice) — remove it from the visible pack list entirely.
  - **Programming-language tiles** (PHP, TypeScript, …) get a **collapsible**.
    Expanded → all sub-items are shown, **active by default**, individually
    deselectable. Sub-items are everything belonging to that language
    (PHP → Laravel, Symfony, …; TypeScript → its frameworks; …).
  - If a language is toggled **OFF**, all its sub-items are disabled and are
    **not** installed later.
- [x] **Grouping metadata — RESOLVED via AI council (Gemini + Codex, 2026-05-27).**
      No new mapping file. `config/discovery/packs.yml` already encodes the
      dependency graph via `requires_hint` (`laravel: [php, engineering-base]`,
      `nextjs: [react, typescript, engineering-base]`, …) — but it's flat and
      cannot reliably invert into the language→framework tree (e.g. `typescript`
      itself hints `[javascript,…]`; `nextjs` hints both react+typescript). So:
  - Add ONE additive advisory field `cluster: <language-id>` to framework packs
    in `packs.yml` (e.g. `laravel: cluster: php`, `react: cluster: typescript`,
    `nextjs: cluster: typescript`). Same file = single source of truth; **no
    second file to keep in sync** (the package's maintenance burden was the
    deciding factor — a separate mapping file would mean editing every new pack
    twice).
  - `cluster` is advisory like `requires_hint` (small ADR-013 note documenting
    the new key; **not** the heavy advisory→enforced flip).
  - Emit `cluster` into the discovery manifest (build_discovery_manifest.py),
    same as `requires_hint`.
  - Extend `scripts/lint_discovery_vocabulary.py` to validate every `cluster`
    points at a known pack id — mechanical drift prevention.
- [x] **Frontend derives + resolves (no installer / ADR-013 enforcement change).**
      `install.py` treats `packs` as an opaque list (`_inject_packs`), so the
      wizard computes the final set: group by `cluster`; language OFF → exclude
      its clustered frameworks; inject `engineering-base` into the submitted
      array when any pack that requires it is selected. The installer is
      unchanged; `requires_hint` stays advisory at install time.

## Phase 5 — Module-roots step (Step 3, "Module roots for this project")

- [x] Redesign the bottom section with the text boxes — it currently looks
      amateurish ("built by a beginner"). Make the layout **multi-line** and
      give the **inputs a proper styled look** consistent with the rest of the
      wizard. The buttons already carry the design language; bring the input
      fields up to that same style.

## Phase 6 — Install→Setup hand-off screen (Step 3.5, the hard-stop before "Editor and tooling")

> This is the intermediate screen that sits **between** module-roots (Step 3)
> and "Editor and tooling" (Step 4) — i.e. a "Step 3.5". The maintainer wants
> it kept as a deliberate intermediate step: "Editor and tooling" only follows
> after Next, if the user chooses to continue rather than finish here.

- [x] **Remove the "Continue with Setup" button** — "Next" already does the same
      thing (advance into the setup steps, starting with "Editor and tooling").
- [x] **Reposition "Finish Install here":** move it **below the box**,
      right-aligned, **before** the Next button — same placement and treatment
      as the **Skip** button on the other steps. It is the early-exit
      (install-only, stop here) action; Next continues into setup.

## Phase 7 — "Rtk installed" on the Editor-and-tooling step (Step 4)

- [x] **Always detect, never load from settings.** <!-- GET /api/v1/wizard/detect-rtk (rtk on PATH); loadRtkDetectionOnce writes personal.rtk_installed from detection; removed from the editor SchemaForm paths; RtkRow widget. --> The "Rtk installed" value
      must be **auto-detected** at runtime (is `rtk` on the system?) and
      auto-filled. Never read it from `.agent-settings.yml`
      (`personal.rtk_installed`) — detection is the only source of truth.
- [x] **Install button when missing.** <!-- RtkRow surfaces the per-OS install command (copyable) + an Open-rtk-repo button when missing. Surfaced rather than auto-shelled (non-destructive-by-default; exact formula maintainer-tunable in detect-rtk). --> If rtk is not installed, show an
      "Install" button behind the field that installs it per-OS
      (macOS → e.g. `brew`; Windows / Linux → their respective method). Make it
      as frictionless as possible for the user.

## Phase 8 — New step: configure AI Council (FULL config)

> Step-0 correction: it is not "5 councils" — `agents/settings/.ai-council.yml`
> exposes **5 provider members** (Anthropic, OpenAI, Gemini, xAI, Perplexity).
> Source of truth + schema: `agents/settings/.ai-council.yml` +
> [`docs/contracts/ai-council-config.md`](../../docs/contracts/ai-council-config.md).
> **Scope RESOLVED: full config** (maintainer chose the full surface, not just
> essentials).

- [x] Add a **new wizard step** to configure the **AI Council**, writing
      `agents/settings/.ai-council.yml`.
- [x] **Master enable** + per-member (5 providers) **enable + transport mode**
      (`manual` / `api` / `cli`).
- [x] **Key install per provider** — an "add key" affordance wired to the
      existing `scripts/install_<provider>_key.sh` (security-sensitive surface;
      keys land in `~/.event4u/agent-config/<provider>.key`, mode 0600, never in
      the YAML). Mirror the rtk-style install button (Phase 7).
- [x] **Global defaults in the wizard:** debate rounds (`min_rounds`), cost
      budgets (`cost_budget`), the low-impact fast-path, and impact-based
      `decision_resolution` — all editable in the step (not just defaulted).
- [x] Reflect detected/available provider keys (which providers already have a
      key on disk) so the user sees what's ready vs. what needs a key.

## Acceptance criteria

- A freshly opened wizard window always starts on Step 1.
- Step 1 pre-selects installed AI tools on the first run and shows a correct
  installed/not-installed badge per tool (including first run).
- Each AI tool appears exactly once in the Step 1 list (no Claude-Code
  duplicate).
- Step 2 renders each pack as a tile (title + description); related items are
  visually grouped.
- No duplicate "Engineering Base"; engineering-base is auto-included, not shown
  as a selectable entry.
- Language tiles cluster their frameworks under a collapsible (sub-items active
  by default, deselectable); toggling a language off disables and excludes its
  sub-items from install. Clustering + dependency auto-include is driven by a
  single mapping file.
- Step 3's module-roots inputs are multi-line and styled consistently with the
  rest of the wizard (no raw/amateurish text boxes).
- The install→setup hand-off (Step 3.5) has no "Continue with Setup" button
  (Next replaces it); "Finish Install here" sits below the box, right-aligned
  before Next, styled like the Skip button.
- "Rtk installed" (Step 4) is always detected at runtime (never read from
  settings); when missing, an install button installs rtk per-OS.
- The wizard has a dedicated AI-Council configuration step covering all
  councils and their settings.

<!-- Further maintainer hints will be appended below before the roadmap is finalized. -->
