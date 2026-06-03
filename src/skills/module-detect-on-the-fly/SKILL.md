---
model_tier: medium
name: module-detect-on-the-fly
description: "Use when editing a file under a module-shaped path (`Modules/*`, `packages/*`, `apps/*`, `internal/*`) while `modules.enabled` is `false` — asks the user once whether to enable the config."
domain: process
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# module-detect-on-the-fly

## When to use

Fires the first time the agent edits, reads, or references a file
inside a module-shaped path while the project has not yet opted into
the module config. Goal: catch projects with real module structure
that never ran `/agents init` or the GUI wizard, and offer to enable
the config — once, without nagging.

**Trigger heuristic** (any one):

- The agent is about to edit a path matching `*/Modules/*`,
  `*/app/Modules/*`, `*/packages/*/<non-noise>`, `*/apps/*/<non-noise>`,
  `*/src/Module*/*`, or `*/internal/*/<non-noise>`.
- The user names such a path in their request.
- A `/module *` command runs while `modules.enabled` is `false`.

**Hard gate** — skip the skill entirely when **any** of these hold:

1. `modules.enabled` is `true` (already configured — use `module-management`).
2. `modules.detection_acknowledged` is `true` (user already answered).
3. The path matches a `_NOISE_SEGMENTS` entry (`vendor`, `node_modules`,
   `dist`, `build`, etc.) — see `scripts/_lib/module_detection.py`.

Confirm both flags via `get_modules_config()` before running detection.

## Procedure

1. **Detect** — call `detect_module_roots(project_root)` from
   `scripts/_lib/module_detection.py`. Returns a list of
   `ModuleCandidate` ordered `high → medium` confidence.
2. **Bail early** — if the list is empty OR every candidate has
   `confidence: "medium"` AND no candidate matches the path the agent
   is currently working on, skip silently. (False positives nag worse
   than missed detections.)
3. **Surface once** — present a single numbered-options block:

   ```text
   Detected module-shaped structure not yet in config:
   - app/Modules/  (laravel-hmvc, high confidence, 4 modules)
   - packages/     (node-monorepo, medium confidence, 2 candidates)

   1. Enable modules config — add detected paths to
      `.agent-project-settings.yml` so module-aware skills activate.
   2. Not now — silence this prompt for the project (you can revisit
      via `/agents init` later).
   3. Show details first — list the candidates with their stack guess
      and per-module subdirs before deciding.

   Recommendation: 1 when the high-confidence list matches your
   intent. 2 when the layout is intentionally flat.
   ```

4. **Persist the choice**:

   - **Option 1** — build the payload (matches `propose_modules_config.py
     --json` shape, includes `detection_acknowledged: true`), pipe into
     `python3 scripts/apply_modules_config.py --project <root>`.
   - **Option 2** — run `python3 scripts/apply_modules_config.py
     --project <root> --acknowledge-only`. Flips only the ack flag;
     every other `modules.*` key stays untouched.
   - **Option 3** — list candidates, then loop back to step 3.

5. **Resume the original task** — never block work on the prompt. If
   the user picks 2, treat the project as flat for the rest of the
   session.

## Output format

1. One-paragraph note naming the detected paths + stack guess +
   confidence per row.
2. Single numbered-options block (1 = enable, 2 = silence,
   3 = show details).
3. After the user picks: the apply-script invocation that was run,
   then resume the original task on the next turn.

## Gotcha

- **False positives nag worse than misses.** Only fire when
  `is_module_like_path()` matches AND `detect_module_roots()` returns
  a `high`-confidence candidate that overlaps the path the agent is
  touching. Pure `medium`-only hits on unrelated paths → skip silently.
- **Vendored trees mimic module shape.** `vendor/foo/Modules/Bar`,
  `node_modules/*/packages/*`, `dist/Modules/*` — the noise filter in
  `is_module_like_path()` already drops these, but never call
  `detect_module_roots()` against a vendored sub-root.
- **Maintainer dogfooding.** This repo (`event4u/agent-config`) ships
  `packages/*/agents/` that look module-shaped. The repo's own
  `.agent-project-settings.yml` sets `detection_acknowledged: true` to
  silence the skill here.
- **Intentional flat monorepos.** When `packages/*` is just a
  vendoring directory for unrelated tools, option 2 is the right
  answer and the skill must respect it permanently.

## Do NOT

- Do NOT background-scan. Detection only runs when the trigger
  heuristic fires on a path the agent is actively touching.
- Do NOT re-prompt once `modules.detection_acknowledged` is `true`.
  Re-entry goes through `/agents init`, never automatic.
- Do NOT auto-enable on a `high`-confidence match. The user has to
  pick option 1 — the whole point is one explicit decision.
- Do NOT commit or push the patched `.agent-project-settings.yml`.
  Persistence writes the file only; staging is the user's call per
  `commit-policy`.
- Do NOT block the original task on the prompt. If the user ignores
  the options block, continue the work and treat the project as flat
  for the rest of the session.

## See also

- `module-management` — the active skill once modules are configured.
- `scripts/_lib/module_detection.py` — `detect_module_roots()` +
  `is_module_like_path()` helpers.
- `scripts/apply_modules_config.py` — persistence with
  `--acknowledge-only` for option 2.
- `commands/agents/init.md` — the explicit re-entry point if the user
  wants to revisit detection later.
