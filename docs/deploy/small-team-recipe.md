# Small-Team Recipe — 3–10 people, no code change

> **Status** · v0 · 2026-05-24. Phase 9 of
> [`road-to-employee-product-and-external-proof.md`](../../agents/roadmaps/road-to-employee-product-and-external-proof.md).
> The recipe relies entirely on **existing primitives**. No new
> code, no new server, no shared backend. Each user runs the
> workspace locally; the team shares the inputs.

## Audience

A team of 3–10 people in one organisation that wants every member
to use agent-config as their daily AI tool, with **shared prompts**,
**shared role experiences**, and **shared knowledge sources** —
but where buying / running a central server is not justified.

Examples this recipe is sized for:

- A 4-person landscape-gardening business (one owner, three foremen).
- A 6-person content team at a small agency.
- A 5-person consulting partnership.

## Architecture in one picture

```
┌─ shared NAS / SharePoint / Dropbox ──────────────────────────┐
│   knowledge/                                                  │
│     ├── handbuch.pdf                                          │
│     ├── offer-templates/                                      │
│     └── customer-history/                                     │
└───────────────────────────────────────────────────────────────┘
                       ▲                          ▲
                       │ each user mounts         │
                       │                          │
┌──────────────────────┴──┐    ┌─────────────────┴─────────┐
│  Person A laptop        │    │  Person B laptop          │
│  workspace + local        │   │  workspace + local        │
│  knowledge index (per-    │   │  knowledge index (per-    │
│  user, ingested from NAS) │   │  user, ingested from NAS) │
└─────────────┬─────────────┘   └────────────┬──────────────┘
              │                              │
              └──────── git pull / push ─────┘
                          ▲
                          │
              ┌───────────┴────────────────┐
              │  Shared `agents/overrides/`│
              │  git repo (private)         │
              │   ├── prompts/             │
              │   ├── roles/               │
              │   └── glossaries/          │
              └─────────────────────────────┘
```

## Set up the shared overrides repo

One person does this once:

1. Create a **private** git repo, e.g. `internal-agent-pack`.
2. Inside, mirror the structure of the package's `agents/overrides/`:
   `prompts/`, `roles/`, `glossaries/`.
3. Add the team's role experiences (Phase 3 of the roadmap):
   one folder per role under `roles/<role>/` with `index.md`,
   `skills.yml`, `prompts/`, and (Phase 6) `explain-glossary.yml`.
4. Push to the team's git host. Grant read access to every team
   member, write access to the maintainers.

Each team member then:

```bash
git clone <repo> ~/internal-agent-pack
ln -s ~/internal-agent-pack/prompts   ~/.event4u/agent-config/overrides/prompts
ln -s ~/internal-agent-pack/roles     ~/.event4u/agent-config/overrides/roles
ln -s ~/internal-agent-pack/glossaries ~/.event4u/agent-config/overrides/glossaries
```

`git pull` from anywhere on the team rolls out new prompts /
glossaries to every laptop without any code change.

## Set up shared knowledge

Pick one shared mount the whole team has read access to: NAS,
SharePoint mounted via DAV, Dropbox, Google Drive desktop sync.
Anything that surfaces as a file path.

Each team member runs once:

```bash
npx @event4u/agent-config knowledge:ingest /Volumes/team-share/knowledge
```

Per-user index. Same content. When new files land on the share,
each user re-runs the ingest (Phase 2 will add a watcher later).

## Daily flow per team member

```bash
npx @event4u/agent-config workspace
```

Opens the browser tab. Launcher shows the team's role experiences
(from the shared overrides). Click a task → workspace shells out
to the user's Tier-1 host (Claude Code / Codex / Gemini) or writes
to the inbox for Tier-3 hosts. Documents land under
`~/.event4u/agent-config/workspace/documents/`, **encrypted at
rest** (Phase 8) with the user's per-machine key.

Output documents are local to each user. The team shares **inputs**
(prompts, role experiences, knowledge sources). The team does
**not** share **outputs** (offers, mails, memos) through this
recipe — those are user-private until manually saved to the team
share.

## Optional: publish the overrides as an npm pack

Once the shared overrides repo is stable, the maintainer may
publish it as a thin npm package:

```bash
# inside the overrides repo
npm init --scope=@your-org
# package.json names: "@your-org/agent-config-team"
npm publish --access restricted
```

New team members then `npm install --global @your-org/agent-config-team`
instead of cloning the repo. The package's `postinstall` script
creates the same symlinks. This is **optional**; the git-clone path
above works fine.

## What this recipe does not give you

- **No SSO.** Each user authenticates to their host agent (Claude
  Code, etc.) independently.
- **No central policy enforcement.** Overrides ship via git; users
  can locally edit them.
- **No shared output store.** Customer-facing documents stay on the
  user's laptop. If the team needs shared output, they save / commit
  the document file to the team share manually.
- **No org-mode threat model.** This recipe is single-user-per-machine
  with team-level input sharing. The org-mode threats (cross-user
  policy enforcement, audit log centralisation) are explicitly out
  of scope; see [`team-deployment-posture`](team-deployment-posture.md).

## Cross-references

- Posture: [`team-deployment-posture`](team-deployment-posture.md).
- Workspace: [`docs/contracts/daily-workspace.md`](../contracts/daily-workspace.md).
- Knowledge ingestion: [`docs/contracts/local-knowledge-ingestion.md`](../contracts/local-knowledge-ingestion.md).
- Role experiences: [`docs/contracts/role-experience.md`](../contracts/role-experience.md).
