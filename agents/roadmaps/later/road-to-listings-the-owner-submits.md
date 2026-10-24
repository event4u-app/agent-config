---
complexity: lightweight
status: later
parent_roadmap: road-to-listings-a-release-keeps-current
execution:
  mode: phase-checkpoints
owner: maintainer
entry_condition:
  what: >
    The parent is archived, and at least one of: the owner's go for a named
    Tier B batch is recorded under blocker tier-b-go; the repo-admin topic
    secret exists (blocker topic-push-secret); a plain X.Y.Z release that
    contains the parent's Phase 2 has been published.
  when: >
    The release half arrives with the next release after the parent merges;
    the two owner halves arrive whenever the owner answers.
  who: >
    The owner, for the go and the secret; the maintainer who cuts the next
    plain X.Y.Z release, for the publish (the publish-mcp-registry job runs
    it); an agent session, for every read and every Tier B act once the go
    exists.
review_by: 2026-12-24
estate_offset_exempt: "split from road-to-listings-a-release-keeps-current in the same change: it holds only the acts that wait on an owner go, a repo secret or a future release, so the parent can close on the work the tree can carry"
estate_growth_exempt: "two open blockers, topic-push-secret and cline-install-test. topic-push-secret already existed as an owner-act queue in the stub road-to-a-visibility-sync-that-can-write; cline-install-test (2026-10-24) replaces tier-b-go, resolved in the same change, so the open count is unchanged; this file names them as decidable blockers rather than adding new work"
---
# Road to listings the owner submits

> **Source:** `agents/tmp.old/inbox-2026-10-ad/`, through the parent
> [`road-to-listings-a-release-keeps-current`](../archive/road-to-listings-a-release-keeps-current.md),
> which ships the payload, the CI publish, the manifests and the watcher.

## Goal

Every target in the parent's register has a ledger row that a **live read**
moved to `accepted`, or a recorded reason it was not pursued. A submission is
done when the entry is publicly live (owner constraint, transcript turn 3);
the parent's daily watcher reds any row that drifts from that.

## Phase 1 — Reads after the first release with the CI publish

- [ ] **1.1 Official MCP Registry live.** Carries the parent's AC-2 — it
      stays unverified until this read. Read the registry query for the
      released version; set ledger row 4 `accepted` with the read date.
      verify: the row-4 query returns a count above 0 for the version.
- [ ] **1.2 GitHub MCP Registry.** One week after 1.1, search
      `github.com/mcp`; if absent, add an email request to the owner packet.
      verify: a ledger row with the read date.
- [ ] **1.3 Passive indexes.** Read skills.sh, LobeHub, PulseMCP and
      mcp.directory once each and record what each shows; submit nothing.
      verify: four ledger rows, each with a `Last read` date.

## Phase 2 — Tier B: the agent submits under one named go

Each act re-reads the upstream's contributing text first; a changed rule stops
the act. Each opens a ledger row `submitted`, and only a live read moves it on.

- [ ] **2.1 awesome-mcp-servers, attempt 1c.** Precondition: the Glama badge
      renders a grade. Fork, add one alphabetical line in Developer Tools with
      the badge and the legend's language and scope markers, open a PR whose
      title ends `🤖🤖🤖`, answer review inside that PR until it closes.
      **Submitted 2026-10-24** as `punkpeye/awesome-mcp-servers#17444` (ledger
      row `1c`); open until the upstream merges or closes it.
      verify: ledger row `1c` carries the PR number and a live state.
- [ ] **2.2 The Copilot CLI's default plugin list.** Its repository name is on
      the source-confidentiality denylist as a past idea source, so its ledger
      row records the ref as an `ENC1:` token. Precondition: the parent's 3.3
      is in a release. File the external-plugin issue form with repo, path
      `.github/plugin`, release tag and its 40-character SHA.
      verify: the intake bot's comment on the issue is green; ledger row added.
- [ ] **2.3 Docker MCP Catalog.** A PR adding `servers/agent-config/` in a
      fork of `docker/mcp-registry`, with `source.dockerfile:
      internal/docker/mcp-server/Dockerfile` (stdio, non-root) pinned to a
      `main` commit that carries the repaired image. The Glama Dockerfile this
      step first named wraps the server in an HTTP proxy, which the catalog's
      stdio contract does not take. `task create` takes no Dockerfile flag, so
      generate with `--build=false --tools=false`, set `source.dockerfile` and
      the commit, then validate with `task build -- --tools agent-config`.
      **Submitted 2026-10-24** as `docker/mcp-registry#6046` (ledger row `6`),
      pinned to `184251b1`; `task validate` and `task build --tools` passed
      locally, and the upstream CI waits on maintainer approval.
      verify: the PR's CI is green; ledger row added.
- [ ] **2.4 Cline MCP Marketplace.** An issue with the
      `mcp-server-submission` template and `assets/logo-400.png`. Blocked on
      `cline-install-test`: the template's required checkbox states that Cline
      set the server up from the README alone, which only a real Cline run can
      make true.
      verify: issue number in the ledger.

## Phase 3 — Tier C: the owner submits from the packet

- [ ] **3.1 Claude community marketplace, Cursor Marketplace, agentskill.sh,
      awesome-claude-code.** The owner pastes the values from
      `docs/distribution/owner-packets.md`; the agent records each result.
      verify: one ledger row per target with its upstream ref.

## Phase 4 — Topics pushed

- [ ] **4.1 Push the new topic.** Run the visibility sync once the
      secret exists.
      verify: the check — `gh repo view event4u-app/agent-config --json repositoryTopics`
      lists `gemini-cli-extension`, and the Gemini gallery shows the
      extension within 48 hours (ledger row).

## Blockers

### blocker: tier-b-go
- **Status:** resolved — the owner gave a go on 2026-10-24 in two parts: (b)
  for 2.1 at once, then (a) for the batch 2.1–2.4 with follow-up replies,
  started after the parent's PR merged. 2.1 is submitted; 2.2 waits on a
  release, 2.3 on the repaired image reaching `main`, 2.4 on
  `cline-install-test`.
- **Owner:** user — every Tier B act is an irreversible external publish
  under the owner's identity (`non-destructive-by-default`).
- **Blocks:** steps 2.1–2.4.
- **What to do:** pick exactly one — (a) give one go naming the batch
  (2.1, 2.2, 2.3, 2.4, follow-up replies inside each included), recorded here
  with its date; (b) give a go for 2.1 alone; (c) decline Tier B and record why.
- **Resolved when:** this entry carries the owner's go with its date and the
  named objects, or the decline.
- **Recommendation:** (b) now, (a) once the parent's 3.3 is in a release —
  2.1 is ready today; 2.2 needs a release first.
- **If you do nothing:** the awesome-list attempt stays at two closed PRs,
  and the three other Tier B targets are never filed.

### blocker: cline-install-test
- **Status:** open — no Cline run recorded.
- **Owner:** user — the agent session has no Cline, and the template's
  checkbox is a statement about a run, which may not be ticked without one.
- **Blocks:** step 2.4.
- **What to do:** pick exactly one — (a) give Cline only the repository's
  `README.md`, confirm it sets the server up, and say so here; (b) add an
  `llms-install.md` first and run (a) against it; (c) drop the Cline listing
  and record why.
- **Resolved when:** this entry records the run with its date and result, or
  the decision to drop the listing.
- **Recommendation:** (a) — the README already carries the one-line `npx`
  start, so the run is a few minutes.
- **If you do nothing:** the Cline marketplace never lists the server.

### blocker: topic-push-secret
- **Status:** open — the visibility channel answers HTTP 403.
- **Owner:** user — a repository secret with admin scope is an owner act.
- **Blocks:** step 4.1.
- **What to do:** pick exactly one — (a) store a fine-grained token with
  Administration: write on this repository as a repo secret and dispatch
  `sync-visibility.yml`; (b) run `task sync-github-topics` once locally under
  the owner's own `gh` login.
- **Resolved when:** `gh repo view event4u-app/agent-config --json repositoryTopics`
  lists `gemini-cli-extension`.
- **Recommendation:** (a) — it also closes the stub
  `road-to-a-visibility-sync-that-can-write`.
- **If you do nothing:** the Gemini manifest ships but the gallery crawler
  never sees the repository, and the weekly visibility-drift sweep on `main`
  stays red on the one unpushed topic.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Attempt 1c closes for inactivity like 1b | product | Nobody answers the reviewer in time. | The parent's daily watcher reds `needs-response` on an open PR with changes requested. | Phase 2 — Tier B: the agent submits under one named go |
| 2 | A directory changed its rules after the read | implementation | A submission follows a stale rule. | Every act re-reads the contributing text first. | Phase 2 — Tier B: the agent submits under one named go |

## Acceptance Criteria

- [ ] AC-1 — Every target in the parent's register has a ledger row with a
      live-read status and a `Last read` date, or a recorded reason it was not
      pursued.
