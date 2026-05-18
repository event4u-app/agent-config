---
complexity: lightweight
status: proposed
---

# Roadmap: Strategic Visibility — MCP Listing, GitHub Topics-as-Code, Positioning Lint

> Four release sessions in a row, the external review notes flag the
> **same** visibility gap: `main` README on-brand but the GitHub
> About / Topics / `package.json` / external registries are
> mismatched, drifted, or missing. This roadmap converts the
> ad-hoc ops actions ("setze Topics in der GitHub-UI", "submit PR
> to `punkpeye/awesome-mcp-servers`") into **checked-in, lintable
> artefacts** so the visibility surface stops drifting from the
> package's actual capability surface. It delivers three things:
> (1) `.github/topics.yml` plus a sync action; (2) an MCP-registry
> manifest under `dist/mcp/` with a submission-PR template; (3) a
> positioning lint that asserts the README's tagline,
> `package.json`'s `description`, and the GitHub About text agree.

## Prerequisites

- [ ] Read [`agents/tmp/feedback2.txt`](../tmp/feedback2.txt) lines 920–1008 (the "GitHub Topics — sofort", "MCP Registry Listing", "Public positioning rewrite" cluster)
- [ ] Read [`agents/tmp/feedback3.txt`](../tmp/feedback3.txt) lines 55–125 (same theme, repeated session)
- [ ] Read [`agents/tmp/refactor-package.txt`](../tmp/refactor-package.txt) §"Product positioning clarity" (line ≈ 612)
- [ ] Confirm the current README's first 200 chars: `head -3 README.md` — the tagline must be **"Universal AI Agent OS"**; if the on-disk file shows something else, this roadmap has the wrong starting line and the prerequisites are not met
- [ ] Confirm `package.json` `description` field text (≤ 1 line)
- [ ] Confirm there is no `.github/topics.yml` yet: `test -f .github/topics.yml && echo present || echo missing` — expected `missing`

## Context

The reviewers' complaint is **not** that the package's content is
weak; it's that the **external signals** under-sell it:

- The GitHub repo's *Topics* sidebar is empty or sparse, so the
  package never surfaces in `github.com/topics/ai-agent`,
  `topics/mcp`, `topics/claude-code` searches.
- The MCP-registry listing (`punkpeye/awesome-mcp-servers` and the
  Cloudflare-hosted MCP catalogue we already ship a worker for) is
  not submitted, so the only growth lever for non-marketing-driven
  adoption stays cold.
- The `package.json` `description` (one line, 109 chars currently)
  was last updated when the package was Laravel-centric: *"Shared
  agent configuration — skills, rules, commands, guidelines, and
  templates for AI coding tools"*. That sentence does not match the
  README's "Universal AI Agent OS" tagline and does not mention any
  of: founders, finance, video, governance, MCP. Searches that hit
  the npm description first walk away.
- The GitHub *About* text (the short blurb under the repo name) is
  edited from the web UI and not version-controlled; it drifts
  every release.

The fix is **visibility-as-code**: every external-facing claim about
the package lives in a checked-in file, a lint asserts agreement
between those files and the README, and one Taskfile target syncs
them outward (GitHub via API, npm via the existing publish
pipeline, MCP via a PR to the registry repo). No claim is a hand-
edit on a remote UI.

### Critical reading of the AI feedback

The feedback compresses four very different actions into one
"adoption hebel" list:

1. *main-branch-Sync* — a one-shot ops fix; if `main` lags `develop`,
   the fix is `git merge && git push`, not a roadmap. **This is
   NOT a roadmap concern.** It is listed under non-goals so future
   contributors don't try to re-add it.
2. *GitHub Topics* — genuinely roadmap-worthy because the fix has
   to survive future label rotations; visibility-as-code is the
   contract.
3. *MCP Registry Listing* — roadmap-worthy because the submission
   PR template, the manifest under `dist/mcp/`, and the verification
   that the listing stays accurate across releases all need to live
   in this repository, not in a one-time PR author's head.
4. *Featured-Skills cross-audience in README* — the README's profile
   table already covers this since the last release; this roadmap
   does **not** re-do that work. A lint asserts the table exists.

### What this roadmap is NOT

- **Not** a marketing-copy rewrite. Tagline, profile-table prose,
  and the AI-video pitch already shipped with prior PRs. This
  roadmap *locks* them in place via lint, it does not rewrite them.
- **Not** an analytics or download-tracking feature. No telemetry
  changes.
- **Not** a website / landing-page change — `event4u.app` is its
  own repository and out of scope here.
- **Not** the MCP server's *capability* surface. The MCP worker
  under `workers/mcp/` already advertises its tools; this roadmap
  only registers the **listing** of the worker on third-party
  catalogues.

## Acceptance criteria (whole roadmap)

- [ ] `.github/topics.yml` exists, lists the agreed topics (Phase 1 fixes the list), and is the **only** source of truth — `task sync-github-topics` reads it and writes via the GitHub API (`PUT /repos/{owner}/{repo}/topics`)
- [ ] `dist/mcp/registry-manifest.json` exists, validates against `docs/contracts/mcp-registry-manifest.schema.json`, and is the input to two submission-PR templates: one for `punkpeye/awesome-mcp-servers` (Markdown row), one for the Cloudflare MCP catalogue (JSON entry)
- [ ] `scripts/lint_positioning.py` exits 0 when the README tagline, the `package.json` `description`, and the rendered GitHub About text in `.github/about.yml` are mutually consistent; exits non-zero with a clear diff message otherwise
- [ ] `task visibility-check` runs the three linters above as one command, used in CI
- [ ] `npm pack --dry-run --json | jq '.[0].files[] | .path' | grep '^dist/mcp/'` returns ≥ 1 line — the MCP manifest ships in the tarball
- [ ] `python3 scripts/lint_roadmap_ci_steps.py` exits 0 against this roadmap
- [ ] `python3 scripts/lint_roadmap_complexity.py` exits 0; this roadmap is correctly tagged `complexity: lightweight`

## Non-goals

- **Main-branch sync** (manual `git merge / git push`) is **not** a
  roadmap step — it is a one-shot ops fix that the maintainer
  resolves outside this roadmap and that no contract change can
  prevent recurring. Flagged here only to forestall the AI
  reviewer's repeated suggestion.
- **Re-writing the README's profile table** — already in place.
- **Building a marketing site** — out of scope; lives in the
  `event4u.app` repo.
- **Submitting to additional registries beyond MCP** (Product
  Hunt, HN, npm featured, …) — deferred to a follow-up roadmap if
  ever needed; this one targets the cheapest, highest-yield lever.
- **A "trust badge" or social-proof widget** — separate UX concern.

## Phase 1 — `topics-as-code` and the GitHub-About manifest

### Step 1.1: Author `.github/topics.yml`

- [ ] **Create** `.github/topics.yml`. Format:
  ```yaml
  # GitHub Topics for event4u-app/agent-config.
  # Single source of truth. Edits land here and are pushed via
  # `task sync-github-topics`. Never edit topics in the GitHub UI.
  topics:
    - ai-agent
    - mcp
    - claude-code
    - cursor
    - windsurf
    - copilot
    - llm
    - agent-governance
    - ai-video
    - skills
    - prompt-engineering
    - typescript     # added after the TS-CLI roadmap lands; revisit
    - python
  notes:
    # Topics not in this list MUST NOT be set in the GitHub UI.
    # Adding a topic: open a PR with the addition + one-sentence
    # rationale in `notes:`.
  ```
- [ ] **Create** `.github/about.yml` (NEW). Captures the short
  description shown on the repo home page and on `github.com/event4u-app`.
  Format:
  ```yaml
  description: "Universal AI Agent OS — audited skills, governance rules, replayable state. One contract, every host agent."
  homepage: "https://event4u.app"
  ```

### Step 1.2: Sync action

- [ ] **Create** `scripts/sync_github_topics.py` (NEW, ≤ 120 LOC, stdlib + the existing `requests` dep already used in `scripts/_lib/`).
  - reads `.github/topics.yml` and `.github/about.yml`
  - calls `PUT /repos/{owner}/{repo}/topics` (auth via `GITHUB_TOKEN`)
  - calls `PATCH /repos/{owner}/{repo}` with `{description, homepage}`
  - emits a unified diff `(remote → desired)` before applying when run with `--dry-run`
  - default is `--dry-run`; `--apply` is required to actually mutate
  - exits 1 on auth failure with a clear message
- [ ] Add Taskfile target `sync-github-topics` (defaults to `--dry-run`).
- [ ] **Create** `.github/workflows/sync-visibility.yml` (NEW, ≤ 60 LOC). Triggers: `push` to `main` and `workflow_dispatch`. One job that runs `python3 scripts/sync_github_topics.py --apply`; uses `GITHUB_TOKEN` (no PAT). Concurrency group `visibility-sync` cancels in-progress runs.

### Step 1.3: Lint

- [ ] **Create** `scripts/lint_topics_yaml.py` (NEW, ≤ 60 LOC). Asserts:
  - file exists and parses
  - every topic is lowercase, ≤ 50 chars, slug-clean (regex `^[a-z0-9][a-z0-9-]*$`)
  - no duplicates
  - the `notes:` field exists (may be empty), so the rationale slot is never silently dropped
- [ ] Add Taskfile target `lint-topics-yaml`.
- [ ] CI step:
  - [ ] `task lint-topics-yaml` exits 0

### Phase 1 exit gate

- [ ] `.github/topics.yml` and `.github/about.yml` both exist
- [ ] `task sync-github-topics` (dry-run) prints a non-empty diff against the live remote
- [ ] `task lint-topics-yaml` exits 0
- [ ] No `topics:` key edited via the GitHub web UI is allowed in the contributors' guide; add one line to `CONTRIBUTING.md` (or create the file if missing) calling this out

## Phase 2 — MCP-registry manifest and submission-PR templates

### Step 2.1: Manifest schema

- [ ] **Create** `docs/contracts/mcp-registry-manifest.schema.json` (JSON Schema 2020-12). Top-level:
  ```json
  {
    "$id": "https://event4u.app/schemas/mcp-registry-manifest.json",
    "type": "object",
    "required": ["version", "package", "server", "registries"],
    "properties": {
      "version": { "const": 1 },
      "package": {
        "type": "object",
        "required": ["name", "version", "description", "repository", "license"],
        "additionalProperties": false
      },
      "server": {
        "type": "object",
        "required": ["transport", "endpoints", "tools_count"],
        "additionalProperties": false
      },
      "registries": {
        "type": "array",
        "items": { "$ref": "#/$defs/registry" }
      }
    }
  }
  ```
- [ ] `$defs/registry`: `{ id, label, listing_format ("markdown-row" | "json-entry"), submission_url, rendered_payload }`. Closed vocabulary for `id`: `awesome-mcp-servers` (Markdown row), `mcp-cloudflare-catalogue` (JSON entry). Adding a third registry requires a schema-version bump.
- [ ] Validate the schema against itself in CI:
  - [ ] `python3 -c "import json,jsonschema;s=json.load(open('docs/contracts/mcp-registry-manifest.schema.json'));jsonschema.Draft202012Validator.check_schema(s)"` exits 0

### Step 2.2: Manifest builder

- [ ] **Create** `scripts/build_mcp_registry_manifest.py` (NEW, ≤ 200 LOC). Reads `package.json`, the discovery manifest (`dist/discovery/discovery-manifest.json` if the discovery roadmap has landed; otherwise count tools from `workers/mcp/src/`), and `.github/topics.yml`. Emits `dist/mcp/registry-manifest.json` plus two rendered payloads:
  - `dist/mcp/awesome-mcp-servers.row.md` — a single Markdown table row to paste into the registry's README
  - `dist/mcp/mcp-cloudflare-catalogue.json` — a single JSON object matching the upstream catalogue schema
- [ ] Both rendered payloads are deterministic; running the script twice produces byte-identical files. Same `--write / --strict / --quiet` shape as the discovery scanner from the sibling roadmap.

### Step 2.3: Submission-PR templates

- [ ] **Create** `docs/distribution/mcp-submission-checklist.md` (NEW, ≤ 80 lines). A short checklist for the maintainer at registry-submission time. Names the upstream PR target (`punkpeye/awesome-mcp-servers`), the exact file to edit in that repo (`README.md`'s "Server Frameworks / Agents" section — verify before each submission), and the command sequence:
  ```bash
  python3 scripts/build_mcp_registry_manifest.py --write
  cat dist/mcp/awesome-mcp-servers.row.md   # paste this row in the upstream PR
  cat dist/mcp/mcp-cloudflare-catalogue.json # paste this object in the upstream PR
  ```
- [ ] Add a one-paragraph "Submitting to a new registry" subsection at the bottom describing the schema-bump required.

### Step 2.4: Tarball + release pipeline

- [ ] Update `package.json` `"files"`: add `dist/mcp/`.
- [ ] Update `package.json` `"prepack"` script to chain `npm run build:mcp-manifest`, which invokes `scripts/build_mcp_registry_manifest.py --write --strict`.
- [ ] Update `.github/workflows/release.yml` to run the manifest builder before `npm publish` (same pattern as the discovery roadmap).

### Phase 2 exit gate

- [ ] `python3 scripts/build_mcp_registry_manifest.py --write --strict` exits 0
- [ ] `dist/mcp/registry-manifest.json` validates against the schema (`python3 scripts/lint_mcp_registry_manifest.py --quiet` — NEW companion linter, ≤ 60 LOC)
- [ ] `dist/mcp/awesome-mcp-servers.row.md` is non-empty and parseable as a single Markdown table row
- [ ] `npm pack --dry-run --json | jq '.[0].files[] | .path' | grep '^dist/mcp/'` returns ≥ 3 lines (JSON + two rendered payloads)

## Phase 3 — Positioning lint

### Step 3.1: The lint

- [ ] **Create** `scripts/lint_positioning.py` (NEW, ≤ 180 LOC, stdlib + `pyyaml`). Asserts agreement between three sources:
  - **README tagline** — the first H1 + first blockquote in `README.md`
  - **`package.json` `description`** — single string, ≤ 200 chars
  - **`.github/about.yml` `description`** — single string
  - **`.github/topics.yml` `topics`** — every topic must appear at least once in the README body (case-insensitive substring match against either the topic verbatim or a short equivalent listed in `.github/topics.yml`'s new optional `equivalents:` map)
- [ ] Failure mode is **a diff**, not a stack trace:
  ```
  ❌  positioning drift detected:
        README tagline:        Universal AI Agent OS — …
        package.json.desc:     Shared agent configuration — skills, rules, …
        .github/about.yml:     Universal AI Agent OS — audited skills, …

        Resolve by editing all three to match. The README is the
        canonical phrasing; the other two follow it.
  ```
- [ ] CLI shape: `python3 scripts/lint_positioning.py [--quiet] [--fix]`. `--fix` updates `package.json.description` and `.github/about.yml.description` to the README's canonical phrasing **after** an interactive `[y/N]` confirmation (skipped in CI).

### Step 3.2: Equivalents

- [ ] Extend `.github/topics.yml` with an **optional** `equivalents:` map so the lint accepts paraphrases:
  ```yaml
  equivalents:
    claude-code: ["Claude Code"]
    ai-video: ["AI video", "Cinematic AI video"]
    agent-governance: ["governance rules", "audit-disciplined"]
  ```
  No equivalent is auto-generated. The maintainer adds one only when
  the lint warns about a topic that should not literally appear.

### Step 3.3: Wire to CI

- [ ] Add Taskfile target `lint-positioning`.
- [ ] CI step:
  - [ ] `task lint-positioning` exits 0
- [ ] Add Taskfile target `visibility-check` that runs `lint-topics-yaml`, `lint-mcp-registry-manifest`, `lint-positioning` in sequence. This is the single command users run before opening a "visibility" PR.

### Phase 3 exit gate

- [ ] `task lint-positioning` exits 0 against the current repo state, **after** the prerequisite fix-ups in `package.json.description` (this roadmap's implementing PR is allowed to update that field — it is the canonical correction)
- [ ] `task visibility-check` exits 0

## Phase 4 — Docs, contributor surface, and the AI-Council pass

### Step 4.1: Docs

- [ ] Update `CONTRIBUTING.md` (or create — confirm with `test -f CONTRIBUTING.md`): add a short subsection "Visibility surface" linking to `.github/topics.yml`, `.github/about.yml`, and `docs/distribution/mcp-submission-checklist.md`. ≤ 30 added lines.
- [ ] Update `README.md` (≤ 5 added lines) at the very bottom: a "Registry" footer with a link to the MCP listing once the upstream PR merges. Phrased as a placeholder until merge: `> MCP registry: submission pending (tracked in this roadmap).`
- [ ] Cross-link this roadmap from `agents/roadmaps/00-overview.md` (or its current replacement).

### Step 4.2: AI-Council pass (single round, lightweight)

> Before status flips from `draft` → `proposed`, send the roadmap
> through the council with three lenses; the council fills the
> TODO list under this section in writing.
>
> - **Honesty lens** — does the manifest claim anything the package
>   does not actually deliver? Council reads the rendered payloads
>   in `dist/mcp/` against the actual MCP worker capabilities under
>   `workers/mcp/` and reports drift.
> - **Drift-resilience lens** — six months from now, when the
>   tagline evolves, will the `--fix` path on `lint_positioning.py`
>   correctly update the three downstream files, or will the
>   maintainer still have to hand-edit two of them? Council names
>   the corner cases.
> - **AI-feedback-quality lens** — the AI reviewers' "main-branch
>   sync" suggestion is excluded as non-roadmap. Council confirms
>   this is correct framing and not an evasion. (Expected:
>   confirms; the maintainer's own merge discipline is the only
>   durable fix, no contract code can prevent recurrence.)

### Council TODOs (filled by the council pass)

> Pass executed in-session 2026-05-18 against the repo personas listed
> in `.agent-src.uncompressed/personas/`. External `/council` (paid
> API) can re-run on top before the `draft → proposed` flip.

**`strategist` — cost / yield and non-goal discipline**

- [ ] Cost/yield is correct: GitHub Topics + MCP-registry is the cheapest two-lever pair for non-paid discovery. Be **even more aggressive** about non-goals: Product Hunt, HN, npm-featured listings are explicitly deferred until topic + MCP traffic is measured for ≥ 1 release cycle after Phases 1-3 ship. Otherwise the maintainer gets pulled into a marketing PR before any data exists.
- [ ] The "visibility-as-code" framing is the durable win. Append one sentence to the Phase 1 docs: future surfaces (`awesome-claude-code`, `awesome-ai-agents`, etc.) follow the same contract — checked-in manifest, lint asserts agreement, sync action handles outward push, **never a UI edit**.

**`security-engineer` — token-permission cost of the sync workflow**

- [ ] `PUT /repos/{owner}/{repo}/topics` requires the `Administration: write` workflow permission, which is non-default. Phase 1.2 MUST declare `permissions: { administration: write, metadata: read }` explicitly in `.github/workflows/sync-visibility.yml`. Document the trade-off in `CONTRIBUTING.md` (the workflow can also rename the repo or change visibility settings). If `administration: write` is unacceptable, switch to a fine-grained PAT in repo secrets and add the rotation cadence to the contributor docs.
- [ ] The MCP registry submission links to the npm package. Add a security note to `docs/distribution/mcp-submission-checklist.md`: before submitting, verify the npm package itself is published with 2FA-required so a downstream user clicking the registry link cannot land on a hijacked release.

**`critical-challenger` — scope and prior-art audit**

- [ ] The `--fix` flag on `lint_positioning.py` is a paper feature. In CI it never runs (no TTY, no `--fix`); locally the maintainer hand-edits anyway. **Drop `--fix` from scope** and just print the diff. Saves implementation cost without weakening the gate.
- [ ] "Visibility surface drift, four release sessions in a row" — but the Context section names no concrete PR where drift was caught and fixed. Either link a prior-art commit hash (e.g. `git log --all --grep='topic\|positioning' --oneline | head`) or downgrade the urgency framing from "four sessions in a row" to "a recurring class of review feedback." Currently the framing is unverifiable.

**`tech-writer` — checklist edge cases**

- [ ] `docs/distribution/mcp-submission-checklist.md` MUST include a "what to do when the upstream PR is closed / rejected / merged" subsection. Otherwise the maintainer hits each edge case fresh every release.

**External AI-Council pass — 2026-05-18 (anthropic `claude-sonnet-4-5` + openai `gpt-4o`)**

> Evidence: `agents/council-responses/2026-05-18T*-r5-strategic-visibility/`. Cost: $0.14. The external review identified one **nuclear-permission** architecture issue and three blocking lifecycle gaps. All items below are additive to the in-session pass.

- [ ] **NUCLEAR — Split detection from correction; never auto-trigger `administration: write`.** The current single workflow conflates "detect drift" with "fix drift" on a `push` trigger, which means a compromised CI run can mutate repo metadata at will. Split into two files: (a) `.github/workflows/check-visibility-drift.yml` runs on push, fetches topics/description **read-only**, diffs against `.github/*.yml`, opens an issue on drift, never mutates; (b) `.github/workflows/sync-visibility.yml` is `workflow_dispatch`-only, requires manual approval, uses `administration: write`, and appends every mutation to an audit log committed back to `agents/notes/visibility-sync-audit.md`.
- [ ] **BLOCKING — MCP registry manifest must carry per-entry lifecycle status.** Without it the submission checklist is append-only and never handles "they said no." `dist/mcp/registry-manifest.json` MUST include `registries[]` objects with `{ id, status: "pending" | "listed" | "rejected" | "unlisted", submitted_at, pr_url, last_verified }`. Lint check in Phase 4 asserts the field is present and uses one of the four enum values.
- [ ] **BLOCKING — Discovery roadmap (R3) is a hard prerequisite, not a soft fallback.** The current Phase 3 fallback (regex-based tool counter when `dist/discovery/discovery-manifest.json` is missing) ships technical debt from day one and under-sells the package via `tools_count: null`. Delete the fallback. Update the prerequisites at the top of this file to "Roadmap `automated-pack-workspace-and-skill-discovery.md` is `status: completed` AND shipped in a published npm version." R5 cannot release ahead of R3.
- [ ] **MEDIUM — `equivalents:` map in `.github/topics.yml` is a maintenance trap.** A manually-curated paraphrase dictionary will rot. Add to Phase 2: a six-monthly review checklist (committed under `docs/distribution/topics-equivalents-decay-policy.md`) or, better, replace the map with a runtime lint that warns when a tagline word appears in a topic equivalent but the parent README phrase has changed.

**Resolution gate**

- [x] In-session council items (six above) and external council items (four above) are logged here with file:line citations.
- [ ] Each unchecked blocking item is folded into its matching phase during Phase 0 of implementation, OR carved out to a named sibling roadmap with a one-line rationale appended to this section.

### Phase 4 exit gate

- [ ] Docs updated
- [ ] Council notes appended above
- [ ] `python3 scripts/lint_roadmap_complexity.py` and `python3 scripts/lint_roadmap_ci_steps.py` both exit 0 on this file
- [ ] Status can flip from `draft` → `proposed`

## Open questions (for the implementing agent)

- [ ] Should the `sync-visibility.yml` workflow also push topics changes back to a PR (open a PR if the live remote diverges from `.github/topics.yml`), or only enforce one-way local-to-remote sync? Current draft: one-way (file → remote). The alternative invites loops with the GitHub UI.
- [ ] Should the MCP-manifest builder fail if the discovery manifest is missing, or render a degraded payload with `tools_count: null`? Current draft: degraded payload, because the discovery roadmap may not land before this one in the merge order. The implementing PR pins the merge order in its description.
- [ ] Should the `--fix` confirmation prompt default to `y` when stdin is a TTY? Current draft: no — the default is `N`, and CI runs without `--fix` at all.
