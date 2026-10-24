---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "a search for the subject (grep -rlF -e 'mcp-publisher' -e 'gemini-extension' -e 'registry-submissions' over agents/roadmaps/*.md, later/ and stubs/, the whole roadmap tree) found no active or parked owner; the two stub hits (road-to-bus-factor-external-actions, road-to-a-visibility-sync-that-can-write) are owner-act queues that cannot hold executable repo work, so the work lands here and both stubs get an Arrivals line instead"
relates:
  - slug: road-to-bus-factor-external-actions
    relation: extends
    note: "That stub queues the official-registry publish and the third awesome-list attempt as owner acts. Phase 2 turns the first into a CI step, so it leaves the stub; the second moves to the follow-up roadmap behind one owner go."
  - slug: road-to-a-visibility-sync-that-can-write
    relation: extends
    note: "Phase 4 adds two topics; pushing them needs the repo-admin secret that stub asks for, carried as blocker topic-push-secret in later/road-to-listings-the-owner-submits. This file fixes neither the channel nor its secret."
---
# Road to listings a release keeps current

> **Source:** `agents/tmp.old/inbox-2026-10-ad/` — one transcript of two
> parallel sessions on the same owner request, one supplied plan and one
> consolidating plan. Analysed at `main@4502d328` (v17.2.1) on 2026-10-24.
>
> **Authority basis:** ADR-286 D1 declares listings in registries and
> directories a project goal; D2–D4 bound this file — no in-product ask, no gate
> on an adoption number, no new measurement.

## Goal

Every listing this package can hold is **correct, current, and published by the
narrowest actor that can publish it**, and **no submission is reported done
until the entry is publicly live** — the owner's binding constraint (transcript
turn 3: *watch the PRs and entries and react until everything is online*).

- **Tier A, CI** — the listing renews itself on every release; the owner acts
  once, by merging the workflow change.
- **Tier B, agent after one go** — the agent opens the PR or issue and answers
  review inside that scope; the owner gives one explicit go per named batch.
- **Tier C, owner portal** — a login, identity check or a humans-only rule;
  the agent hands over a packet the owner pastes in one sitting.

This roadmap ships everything the tree can carry: the registry payload, the CI
publish, the manifests, the topics file, the ledger rows and the watcher. The
acts that need an owner go, a repo secret or a release that has not happened
yet are carried to
[`road-to-listings-the-owner-submits`](../later/road-to-listings-the-owner-submits.md).

## Context — verified at `main@4502d328`

| # | Finding | Evidence | Verdict |
|---|---|---|---|
| D1 | The ledger's registry blocker ("needs the maintainer's interactive GitHub login") is stale: `mcp-publisher login github-oidc` needs only `id-token: write`, which the npm job already holds. | `docs/distribution/registry-submissions.md:68`; `.github/workflows/publish-npm.yml:62` | still-true |
| D2 | `server.json` copies the 174-character npm `description`; the 2025-12-11 schema caps it at 100. | `src/scripts/build_mcp_registry_manifest.ts:225`; schema read 2026-10-24 | still-true |
| D3 | The npm package entry carries no `packageArguments`, so a registry client starts the CLI, not the `mcp-server` subcommand. | `build_mcp_registry_manifest.ts:233-240`; `src/cli/registry.ts:73` | still-true |
| D4 | The schema is pinned to `2025-07-09`; `title` and `websiteUrl` are unset. | `build_mcp_registry_manifest.ts:224` | still-true |
| D5 | No workflow runs `mcp-publisher`. | grep over `.github/workflows/` → 0 hits | still-true |
| D6 | No `gemini-extension.json`; `.github/topics.yml` has 16 topics, none `gemini-cli-extension`, which the gallery crawler keys on. The crawler requires the manifest at the repository root. | `.github/topics.yml`; gemini-cli `docs/extensions/releasing.md` read 2026-10-24 | still-true |
| D7 | The topic channel cannot write (HTTP 403 on 2026-10-15). | stub `road-to-a-visibility-sync-that-can-write` | still-true |
| D8 | `.github/plugin/plugin.json` says `1.0.0` against 17.2.1 and sits outside the release version gate. | `.github/plugin/plugin.json:4`; `src/scripts/check_release_manifest_content.ts:40-46` | still-true |
| D9 | The only committed skill a skills crawler can find is the install-pointer skill; the 301 skills live under `src/skills/`. Whether `npx skills add` lists only that one was **not executed** (it fetches and runs a third-party CLI). | `.claude-plugin/marketplace.json:43-44` | unverifiable here |
| D10 | The submission checklist still names two registry ids and `.py` builders. | `docs/distribution/mcp-submission-checklist.md:80-90` | still-true |
| D11 | The ledger's "official plugin directory — gated, not a form" conflates the official directory (no submissions) with the community marketplace (individual submissions). The gate that still holds is the shim, not the route. | `registry-submissions.md` § The official plugin directory | still-true |
| D12 | No square raster logo exists for listings that require one (Cline asks 400×400). A wide banner exists at `.github/assets/banner.png`; the source's "only `favicon.svg`" was wrong. | `git ls-files` | partly never-true |

## Decisions

| # | Decision | Resolved by | Outcome |
|---|---|---|---|
| E1 | Does a CI publish on release count as authorised by the release, as `npm publish` already does? | owner (transcript turn 1: "everywhere an agent can do it for me automatically") | **Yes.** Merging Phase 2 is the one owner act. |
| E2 | Tier B: one go per batch or one ask per act? | rule (`non-destructive-by-default`: the approval names the exact object) | **One go per named batch**, each object listed; follow-up replies inside the same PR/issue are covered. Recorded in the follow-up roadmap. |
| E3 | What `.github/plugin/plugin.json` declares: (a) MCP server + install-pointer skill, no hooks; (b) empty, version-synced only; (c) the 301 skills without rules or hooks. | AI council 2026-10-24, 2/2 (anthropic, openai), no split | **(a)**, on four conditions: the name/description say *discovery plugin, read-only, not the full suite*; the `npx` command pins the package version, synced by the release; a clean Copilot install loads both the server and the skill before any submission; if the upstream will not take this shape, the listing is deferred rather than an empty manifest submitted. The first two land in 3.3; the last two are preconditions of the follow-up's 2.2. |
| E7 | Gemini install source: root manifest or release archive. | evidence (gemini-cli releasing docs: the gallery crawler reads the manifest at the repository root) | **Root manifest.** A release archive is an install-speed optimisation, not a listing route; not planned. |
| E9 | `closure_scan` flags C1–C9 (publish, login, submit wording) as destructive owner-owned ops. | evidence | Every hit is either the CI registry publish E1 authorises (C4, C6–C8) or an act this file carries behind blocker `tier-b-go` / `topic-push-secret` (C1–C3, C9); C5 is a test-backed verify. No act here leaves the repository except through a release the owner merges. |
| E8 | Distribution engine (`/growth:distribute`), a second distribution database, install/conversion telemetry, browser form-filling, paid listings, a persistent off-repo worker, and exporting eight standalone skills for skill directories. | ADR-286 D3/D4; Hard Floor; the completeness directive | **Declined.** The ledger is the one record; Phase 5 is the watcher the owner asked for — a daily CI job instead of a separate worker, without new measurement. A standalone skill export is a subset without rules or hooks presented on its own, which the completeness directive rules out; skill directories get the install pointer (3.5). |

## Phase 1 — A payload the registry accepts (D2–D4, D10)

- [x] **1.1 A registry description of 100 characters or fewer.** Add
      `agentConfig.registryDescription` to `package.json`, read it in
      `_render_server_json`, and make `lint_mcp_registry_manifest` fail when it
      is missing or longer than 100 characters.
      verify: tests assert a 100-character description passes and a
      101-character one fails.
- [x] **1.2 Start the server, not the CLI.** Add
      `packageArguments: [{ type: "positional", value: "mcp-server" }]` and
      `runtimeHint: "npx"` to the npm package entry.
      verify: a test reads the rendered `server.json` and asserts the argument
      list a client builds ends in `mcp-server`.
- [x] **1.3 Bump the schema; add title and site.** Pin `$schema` to
      `2025-12-11`, set `title: "agent-config"` and `websiteUrl` from
      `package.json` `homepage`.
      verify: the lint checks the schema pin, and the rebuilt `server.json`
      carries all three fields.
- [x] **1.4 Correct the checklist (D10).** Name the three registry ids and the
      `.ts` builders.
      verify: the section names `mcp-official-registry` and no `.py` path.

## Phase 2 — The release publishes the registry entry (D1, D5)

- [x] **2.1 Add the publish steps.** After the npm publish step in
      `publish-npm.yml`: install `mcp-publisher` pinned to a released version,
      build the manifest, `mcp-publisher login github-oidc`, then
      `mcp-publisher publish` from `dist/mcp/`.
      verify: the job keeps `id-token: write` and gains no secret; the
      workflow lint passes.
- [x] **2.2 Gate on the channel, not on npm's skip flag.** The steps run only
      for a plain `X.Y.Z` tag and derive that from the tag themselves, so a
      re-dispatch of a tag already on npm still reaches the registry.
      verify: the registry steps' `if:` reads the registry check, never
      `already_published`.
- [x] **2.3 Make it idempotent.** Query the registry for the released version
      first and skip the publish when it is present.
      verify: the step writes a "skipping" job-summary line on a hit.
- [x] **2.4 Fail loudly without un-publishing npm.** A registry failure turns
      the job red with the error in the job summary; npm stays published.
      verify: the registry steps sit after the npm publish step.
- [x] **2.5 Rewrite ledger row 4, the staged act, and the stub.** Row 4's
      blocker becomes "CI-published on release (OIDC)" and stays `pending`
      until a live read; the staged `login github` act is replaced; the
      bus-factor stub records that the registry item left it.
      verify: no `mcp-publisher login github` without `-oidc` remains in
      `docs/distribution/`.

## Phase 3 — Manifests that install something real (D6, D8, D9, D12)

- [x] **3.1 Gemini extension.** Root `gemini-extension.json` starting the
      read-only MCP server through `npx`, plus a context file of 15 lines or
      fewer that points at the full install. Not named `GEMINI.md`, which is a
      gitignored per-tool projection.
      verify: `tests/scripts/listing_manifests.test.ts` asserts name, version,
      the pinned `mcp-server` argument and the context file's line cap.
- [x] **3.2 Every plugin and extension manifest under the version gate (D8).**
      Add `.github/plugin/plugin.json` and `gemini-extension.json` to
      `check_release_manifest_content`, `check_release_pr_shape` and the
      release's version writer; bring both to 17.2.1.
      The release writer re-pins the `@event4u/agent-config@<version>` argument
      too, and the content gate admits exactly that change.
      verify: tests show a manifest at an old version or an old pin fails
      `lint_marketplace`, a swapped package or changed argument fails the
      release content gate, and both sensitivity probes go red.
- [x] **3.3 Discovery plugin shape (E3).** The Copilot manifest declares the
      read-only MCP server (`npx` pinned to the package version) and the
      install-pointer skill, no hooks, and says in its description that it is a
      discovery plugin, not the full suite.
      verify: a test asserts the manifest has no `hooks`, pins the server to
      `package.json`'s version, and names the full install in its description.
- [x] **3.4 One square raster logo (D12).** Render `site/public/favicon.svg` to
      `assets/logo-400.png` at 400×400.
      verify: `file assets/logo-400.png` reports `400 x 400`, and the image was
      opened and inspected.
- [x] **3.5 Make the pointer skill findable (D9).** Rewrite the install-pointer
      skill's description for what a person searches for (Claude Code, Cursor,
      GitHub Copilot, Gemini CLI); keep the shim honesty sentence. The source
      is `PLUGIN_POINTER_SKILL_BODY` in `src/scripts/condense.ts`.
      verify: `task sync` and `task generate-tools` leave the projection
      byte-equal to that constant, and the skill linter reports the same seven
      findings on the shim as on `main` — this shim never passed the full-skill
      sections (it sits outside `--all`), and adding them would grow
      `condense.ts`, which must stay net-zero.

## Phase 4 — Topics the crawlers read (D6, D7)

- [x] **4.1 Add the gallery topic.** `gemini-cli-extension` in
      `.github/topics.yml`, with its rationale and the `Gemini CLI` README
      equivalent; 17 of GitHub's 20. `claude-code-plugin` stays out: the
      topics file records it as considered and declined on 2026-10-16 because
      that plugin is deprecated, and E3 changes the Copilot plugin, not that
      one — same mechanism, no new evidence, so the earlier decision holds.
      verify: `lint_topics_yaml` and `lint_positioning` pass with 17 topics.
- [~] **4.2 Push it.** Needs the repo-admin secret (D7). Until then the
      weekly visibility-drift sweep on `main` reports the pending topic; this
      PR itself runs that check in advisory mode.
      <!-- deferred-resolution: carried-to=road-to-listings-the-owner-submits -->
      verify: `gh repo view` lists `gemini-cli-extension`.
      **Resolution (AI council 2026-10-24, 2/2 anthropic + openai, no split):**
      criterion "push the new topic"; blocker `topic-push-secret`; options
      (A) carry to the follow-up, (B) keep this roadmap open, (C) restore to
      `[ ]`; verdict **(A)** — the repository change is complete and only an
      owner-held credential remains, which `later/` exists to hold. Dissent:
      none on the verdict; one round-1 critique preferred (B) and withdrew it
      once the follow-up's provenance was shown. Destination:
      `later/road-to-listings-the-owner-submits` step 4.1. Closes when
      `gh repo view` lists `gemini-cli-extension`; never before.

## Phase 5 — Watch every submission until it is online (owner constraint)

The owner's constraint, as an acceptance criterion and not a step that can be
cut: a submission is done when the entry is publicly live, not when the PR or
form went out. The reader already exists (`adoption_status --check-upstream`);
what is missing is that nothing runs it outside a session and nothing turns a
changed upstream into a red.

- [x] **5.1 Action verdicts.** `adoption_status` reports `sheet-behind` for a
      `pending` or `submitted` row whose upstream closed, merged or is now
      listed (the 39-day false
      `submitted` on row 1b), `needs-response` for an open pull request with
      changes requested, and `listing-lost` for an `accepted` listing that now
      reads `not-listed`.
      verify: tests drive each verdict through a fake reader, plus the quiet
      cases that must stay quiet.
- [x] **5.2 `--fail-on-action`.** Exit 2 when any action verdict is present,
      naming the row and the next act.
      verify: a test asserts exit 2 with an action and 0 without.
- [x] **5.3 Run it daily outside any session.** Fold one step into
      `release-adjacent-health.yml` (no new workflow, ADR-118).
      verify: the workflow step calls `adoption_status --check-upstream
      --fail-on-action` with `GITHUB_TOKEN` and read-only permissions.
- [x] **5.4 The registry carries the released version.** A registry row read
      compares the registry's latest version with `package.json`; a lagging
      version is `listing-stale`.
      verify: a test with a lagging fixture reports `listing-stale`.

## Phase 6 — One ledger, one packet, and the acts carried forward

- [x] **6.1 Every target in the ledger.** The ledger gains a § Planned
      targets table naming every target in the register below with its tier,
      route and precondition, and the plugin-directory section is corrected
      (D11). Not tracking rows: a target with no upstream yet would be reported
      `unread-never` on every run, and the ledger's own rule 2 opens a tracking
      row at submission.
      verify: `adoption_status` still parses exactly the six tracking rows, and
      the planned-targets table names all eleven targets.
- [x] **6.2 Owner packets.** `docs/distribution/owner-packets.md` holds the
      field values for every Tier C form; no secret.
      verify: the file names every Tier C target in the register.
- [x] **6.3 Carry the external acts.** Tier B submissions, Tier C submissions,
      the topic push and the post-release reads move to the follow-up roadmap
      in `later/`, each behind its trigger.
      verify: the follow-up names this roadmap as `parent_roadmap`.

### Target register

| Rank | Target | Tier | Route | Carried to |
|---|---|---|---|---|
| 1 | Official MCP Registry | A | `mcp-publisher` via OIDC in `publish-npm.yml` | Phase 2; first live read in follow-up |
| 2 | Gemini CLI Extensions gallery | A | root manifest + topic, daily crawl | Phase 3–4; push in follow-up |
| 3 | awesome-mcp-servers, attempt 1c | B | PR, title ends `🤖🤖🤖` (the list's agent fast-track) | follow-up |
| 4 | awesome-copilot | B | external-plugin issue form | follow-up |
| 5 | Docker MCP Catalog | B | PR in `docker/mcp-registry` | follow-up |
| 6 | Cline MCP Marketplace | B | issue + 400×400 logo | follow-up |
| 7 | Claude community marketplace | C | Console form | follow-up |
| 8 | Cursor Marketplace | C | publish form, manual review | follow-up |
| 9 | agentskill.sh | C | web import | follow-up |
| 10 | awesome-claude-code | C | web issue form; human submitters only | follow-up |
| 11 | GitHub MCP Registry | C | read after rank 1; email request if absent | follow-up |

Not planned: Smithery (needs a hosted endpoint and a login; later), OpenAI
plugin portal (identity verification), ComposioHQ and VoltAgent lists (they take
copied skills or subagent files, not a package), passive indexes (skills.sh,
LobeHub, PulseMCP, mcp.directory — read once in the follow-up, nothing to submit).

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The first CI publish fails on the live registry | implementation | The schema read and the live validator disagree, or OIDC is refused. | 2.4 fails loudly without touching npm; 5.4 reds a missing version daily. | Phase 2 — The release publishes the registry entry (D1, D5) |
| 2 | A listing goes stale against the package | product | A manifest keeps an old version or a dead claim. | 3.2 puts every manifest under the release version gate. | Phase 3 — Manifests that install something real (D6, D8, D9, D12) |
| 3 | A submission is reported done while it is not online | product | The 1b row read `submitted` for 39 days after it closed. | Phase 5 reds the sheet-vs-upstream drift daily. | Phase 5 — Watch every submission until it is online (owner constraint) |
| 4 | The Gemini context file grows into a second root payload | implementation | It loads into every Gemini session. | 3.1 caps it at 15 lines in a test. | Phase 3 — Manifests that install something real (D6, D8, D9, D12) |

## Acceptance Criteria

- [x] AC-1 — `dist/mcp/server.json` carries a description of 100 characters or
      fewer, the 2025-12-11 schema pin, and a package entry that starts
      `mcp-server`.
- [~] AC-2 — A release of a plain `X.Y.Z` tag publishes the registry entry with
      no owner act beyond merging this roadmap's PR. Provable only by the first
      release after the merge; the job, its checksum-pinned publisher and its
      idempotency query are in place, and the read is step 1.1 of the follow-up.
      <!-- deferred-resolution: carried-to=road-to-listings-the-owner-submits -->
      **Resolution (AI council 2026-10-24, 2/2 anthropic + openai, no split):**
      criterion verbatim above; blocker: no release has run since the merge;
      options (A) carry, (B) keep this roadmap open, (C) restore to `[ ]`;
      verdict **(A)** — the criterion needs runtime evidence from a release,
      and keeping the parent open would only duplicate tracking. Condition:
      archiving this file does not mean AC-2 holds; it stays unverified until
      the registry lists the released version and ledger row 4 reads
      `accepted`. Destination: `later/road-to-listings-the-owner-submits`
      step 1.1.
- [x] AC-3 — No plugin or extension manifest carries a version other than
      `package.json`'s; the release gate fails otherwise.
- [x] AC-4 — No ledger row can sit in `submitted` after its upstream closed, or
      in `accepted` after its listing vanished, without a red on `main` within a
      day (owner constraint).
- [x] AC-5 — No step adds an in-product ask, a telemetry field, or a condition on
      an adoption number (ADR-286 D2–D4), checked by reading the diff.
