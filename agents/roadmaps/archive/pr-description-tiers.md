---
complexity: structural
---

# Roadmap: Token-efficient, capability-aware PR descriptions

> Make `/create-pr` descriptions "as good as possible but limited to the
> essentials," configurable via a verbosity tier (default: minimal), with
> two additive, evidence-gated enrichments: JSON examples for API-endpoint
> changes, and capability-gated screenshots for frontend changes. All three
> settings-driven; the two enrichments default OFF / grounded so `min` stays
> genuinely minimal and no feature can mislead a reviewer or block a PR.

## Context

The `/create-pr` family (`src/domains/git/pr/create/command.md` +
`.../create/description-only/command.md`) generates a PR body from the diff,
commits, and (optional) Jira ticket. Descriptions run long, costing agent
output tokens on every PR and adding reviewer load. This roadmap adds a
verbosity dial plus two optional enrichments the user requested.

This is an **instruction-layer** change: the package ships markdown the agent
follows; nothing executes in the consumer. That framing decides the shape of
every feature below — especially screenshots, which are a capability-gated
*contract*, not a runtime orchestrator.

## Council convergence (2026-07-14 · members: anthropic/claude-sonnet-4-5, openai/gpt-4o · design lens, 2 rounds)

Both members converged; verdicts folded into scope:

1. **Ship the verbosity tier first** — high value, low risk, prompt-only.
2. **`min` default is correct, but must be "minimal-but-complete".**
   Critical info (breaking changes, migrations, security, rollback) appears
   in **every** tier — a `critical-info-always` layer *orthogonal* to the
   tier. `min` omitting a breaking-change callout would be a P0 bug. This is
   the single most load-bearing council finding.
3. **Screenshots are a tarpit if built as a cross-stack runtime orchestrator.**
   Two hard blockers confirmed by grounding research: (a) no browser/screenshot
   host-capability flag exists; (b) the `github-api pulls` write path cannot
   upload image bytes and GitHub markdown ignores `data:` URIs. Therefore v1
   is a **capability-gated instruction contract, default OFF, honest
   degradation** — never a fragile server-orchestration script, and before/
   after + region-highlighting is explicitly **best-effort**, not guaranteed.
4. **API examples must be evidence-grounded** — emitted only from a real
   response DTO/resource, OpenAPI, test fixture, or actual probe output;
   otherwise a pointer ("contract changed — see `X`"), never an invented
   JSON. A hallucinated example is worse than none.
5. **No brittle framework classifier.** Frontend/API detection uses a light
   path/extension heuristic plus optional user-declared paths, fail-open.
6. **Avoid config explosion + silent-failure UX.** Keep the setting surface
   lean; when an opted-in feature can't run, say so (a one-line note), never
   fail silently and never block the PR.

Divergence: one member argued for fully deferring screenshots; the other for
a limited capability-gated trial. Resolved in favor of the trial **because the
user explicitly requested screenshots (default off)** and the instruction-layer
framing removes the "build a fragile orchestrator" risk the deferral was
guarding against — there is no runtime pipeline to build, only a careful
capability-gated instruction.

## Design decisions

**Settings (5 new keys under `commands.create_pr`, mirroring
`preview_description`):**

```yaml
commands:
  create_pr:
    preview_description: false        # existing
    detail_level: min                 # NEW: min | med | max  (default min)
    api_examples: true                # NEW: bool (default true, grounded-only)
    screenshots: false                # NEW: bool (default false, capability-gated)
    ui_paths: []                      # NEW: optional glob list for frontend detection (fail-open)
    api_paths: []                     # NEW: optional glob list for API detection (fail-open)
```

Naming: keep the user's `min | med | max` (clear with docs; per council both
naming schemes acceptable). `detail_level` is scoped under `commands.create_pr`
so it never collides with the `verbosity.*` namespace. `screenshots` and
`api_examples` are **booleans** (not on/off enums) — `on`/`off` are YAML 1.1
boolean keywords, so an enum string value would be mis-parsed; booleans also
match the `preview_description` precedent and the user's plain on/off ask. The
"grounded-only, never invent" behavior of `api_examples: true` is enforced in
the command contract, not encoded as a separate enum value.

**Tier content model (critical-info-always is tier-independent):**

- `min` (default): title (imperative) + 2-3 sentence what/why/impact +
  linked ticket. **Critical-info block always present** (breaking changes,
  migrations, security implications, non-trivial rollback). No per-file walk,
  no restated commits.
- `med`: `min` + grouped logical changes (bullets) + tests note.
- `max`: `med` + how-to-test + edge cases/trade-offs + reviewer guidance
  (≈ today's output).

## Phase 1: Settings surface + schema

- [x] Add `detail_level`, `api_examples`, `screenshots`, `ui_paths`,
      `api_paths` to `commands.create_pr` in
      `src/config/agent-settings.template.yml` with commented defaults
      (min / true / false / [] / []) explaining each, mirroring the existing
      `preview_description` comment style.
- [x] Extend the `create_pr` zod object in `src/server/schemas/settings.ts`
      with the five keys (`detail_level` enum min|med|max default 'min';
      `api_examples` boolean default true; `screenshots` boolean default
      false; `ui_paths`/`api_paths` string arrays default []), each
      with a `.describe()` matching the template comment.
- [x] Add enum `properties` for `commands.create_pr.detail_level`,
      `api_examples`, `screenshots` to
      `src/scripts/schemas/agent-settings.schema.json` so CI enum-validates
      them (permissive schema otherwise lets typos through). Verify with
      `./scripts-run src/scripts/validate_agent_settings`.

## Phase 2: Verbosity tier + critical-info-always in description generation

- [x] Rewrite `src/domains/git/pr/create/description-only/command.md` § 4
      (Build the PR body) to be tier-driven: read
      `commands.create_pr.detail_level` (default `min`); define the three
      tiers; add the **critical-info-always** rule as an explicit, tier-
      independent MUST (breaking changes / migrations / security / rollback
      appear at every tier). Keep template-filling behavior; the tier governs
      the Description section depth, not which template sections exist.
- [x] Update `src/domains/git/pr/create/command.md` § 2 + § 4e to read
      `detail_level` in the single cached settings read (join the existing
      read-once-and-cache block, do NOT add a re-read), and pass the resolved
      tier to the description step.

## Phase 3: API response examples (evidence-grounded)

- [x] Add an "API-example enrichment" step to `description-only/command.md`:
      when `api_examples: true` AND the diff touches an API endpoint
      (detected via light path/extension heuristic + `api_paths`), include a
      fenced request/response JSON block **grounded in a real source**
      (response DTO/resource class, OpenAPI/schema, test fixture, or an actual
      probe). If no grounded evidence exists → emit a one-line pointer
      ("API contract changed — see `<file>`"), NEVER an invented example.
      `false` → skip. Cite `senior-engineering-discipline` (never invent an API).

## Phase 4: Screenshots (capability-gated instruction contract)

- [x] Add a "Screenshots" step to `description-only/command.md`, gated on
      `commands.create_pr.screenshots: true`. Contract:
      - Fire only when the diff touches a frontend surface (heuristic +
        `ui_paths`) AND the host has browser/preview capability.
      - **Capability gate is explicit, not silent:** on `true` + a frontend
        change + no browser/preview tooling → emit a one-line note in the
        reply and leave the template Screenshots placeholder, never fail or
        block the PR.
      - When capable: capture after-state screenshot(s) of the changed UI;
        before/after + changed-region highlighting is **best-effort** (base
        checkout is fragile mid-PR — attempt only if cheap, else after-only).
      - Multiple screenshots for multiple surfaces, each with a one-line
        caption.
      - **Embedding honesty:** the `github-api` write path cannot upload
        bytes and GitHub ignores `data:` URIs. Document the realistic path
        (host image-upload capability if present; otherwise save locally +
        reference + instruct the user to attach in the GitHub UI). Never
        claim an embed that did not happen (`direct-answers` Iron Law 2).
- [x] State the limitations inline in the command so expectations are set
      (default off; capability-dependent; before/after best-effort).

## Phase 5: Docs + regeneration + verification

- [x] Document the five settings in `docs/customization.md` (a create-pr
      settings table) and in `src/agent-src/templates/agent-settings.md`
      (setting block + table row), matching the `post_action_reports` style.
- [x] Regenerate projections: `task sync` (dist/agent-src + .augment) and
      `task generate-tools` (.claude/.cursor/.clinerules/.windsurfrules);
      condense any touched skill/rule (none expected — commands flow via
      sync/generate-tools). Verify the projected `.claude/commands/**` and
      `dist/agent-src` reflect the edits.
- [x] Targeted verification: `./scripts-run src/scripts/validate_agent_settings`
      (settings + schema), `task lint-skills` scoped to touched files if any
      skill changed, and `git grep` for stale references. Full `task ci` is
      the remote-CI gate per `roadmap-ci-steps-policy` (local_auto_run false).

## Acceptance criteria

- [x] `commands.create_pr.detail_level` defaults to `min`; `min` produces a
      short description that still always carries breaking-change / migration /
      security / rollback callouts when present.
- [x] `api_examples: true` emits a JSON block only when grounded in real
      evidence; never an invented example; `false` skips.
- [x] `screenshots: false` by default; `true` is capability-gated with an explicit
      note on degradation and never blocks PR creation.
- [x] All five settings are seeded in `template.yml`, typed in the zod schema,
      enum-validated in the JSON schema, and documented.
- [x] Projections regenerated; `validate_agent_settings` green; no stale refs.
