---
model_tier: medium
name: analyze-roadmap-repos
pack: analysis-workbench
visibility: internal
sub: roadmap-repos
cluster: analyze
type: orchestrator
replaces: []
skills: [subagent-orchestration]
description: Walk the roadmap estate's encrypted reference tokens and feed each unique repository through analyze-repo, one subagent at a time, without producing one roadmap per repository.
argument-hint: "[--limit=N] [--resume] [--refresh] [--mode=plan|execute]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# analyze-roadmap-repos

The thin harvester in front of [`analyze-repo`](repo.md). It walks the roadmap
estate's encrypted reference tokens, resolves each to a repository identity, and
feeds the unique ones through the analysis command one at a time.

**This command contains no analysis instruction and never will.** It resolves,
dispatches, and folds. Every judgement about a reference — what to fetch, what
to compare, what to adopt, how to converge — belongs to `analyze-repo`, which
owns the loop contract and its limits. A second copy of that reasoning here
would be a second implementation to keep in step with the first, which is the
condition step 1.1 of its roadmap removed.

## Steps

### 1. Discovery — run the script, read the manifest

```bash
./scripts-run src/scripts/harvest_reference_tokens --dry-run          # census only
./scripts-run src/scripts/harvest_reference_tokens --resume --limit=N # write the manifest
```

The script is the only discovery mechanism: it extracts the `ENC1:` tokens
across the five estate levels, decrypts them, classifies each resolved URL,
canonicalizes the repositories, deduplicates on identity plus pinned revision,
and writes `agents/.harvest-local/manifest.jsonl`.

It **refuses without a link-encryption key** rather than reporting a short
census — a classification of zero repositories that actually means "nobody could
look" is the failure mode this whole pass exists to avoid.

Read the manifest. Do not re-derive any of it here.

### 2. Dispatch — one subagent per repository, sequential

For each manifest entry with status `pending`, in manifest order, up to the
batch limit:

- Spawn **one subagent** and have it run `/analyze:repo` for that entry.
- Pass the subagent **the opaque id only** — never a resolved URL. The subagent
  reads the URL from `agents/.harvest-local/manifest.jsonl` itself. One
  indirection, taken on precaution (`analyze-repo` § 7).
- **Sequential, never a fan-out.** Over a hundred identities at four passes each
  cannot share one session, and every external fetch is spent deliberately. The
  manifest is the only shared state between subagents.
- Write the entry's status back as the run progresses: `running`, then `done` or
  `failed`. A batch interrupted mid-flight resumes from those statuses.

Default batch limit is **small**. A harvester that walks the whole estate in one
invocation spends a hundred repositories' worth of fetches on a decision nobody
took.

### 3. Ownership fold — one gap, one roadmap

After the batch, and never during it, run the fold pass of
[`analyze-repo`](repo.md) § 7 across the batch's findings as a set. Consult
`src/scripts/roadmap_context.ts` and the run's own candidate registry, then pick
exactly one disposition per repository:

| Disposition | When |
|---|---|
| no action | the finding is REJECT or ALREADY throughout |
| already planned | an active roadmap already owns the gap |
| extend an existing roadmap | the gap belongs to an owner that exists |
| create a follow-up | the gap belongs under an owner but is out of its scope |
| create new | no owner exists |
| contested | two owners claim it — stop and ask |

**Three repositories showing the same gap strengthen the evidence on one owning
roadmap. They never create three.** That is the whole reason this command exists
rather than a loop that invokes `analyze-repo` and keeps whatever it returns.

### 4. Landing — local-only

The batch's consolidated result is written to `agents/.harvest-local/` and
nowhere else. **No per-run consolidate roadmap takes an active top-level estate
slot** — decided 2026-09-06 under the maintainer's standing delegation, recorded
in `road-to-bounded-reference-harvest-loop` § Blockers. A recurring process that
takes a slot per run converts the estate ratchet's allowance into a standing
exemption, which removes the pressure the ratchet exists to apply.

Accepted consequence, stated rather than hidden: **no batch is visible in the
roadmap dashboard.** Any roadmap the fold pass does land is an ordinary estate
entry landed for a named capability gap, and is subject to the estate gate like
any other.

## Safety

- Read-only on every reference. The no-execute invariant of `analyze-repo`
  § Safety binds every subagent this command spawns.
- No plaintext repository URL is ever passed as a dispatch argument.
- Nothing tracked is written by this command itself.
- Hard-Floor actions stay this-turn gated. A batch authorizes fetches, never a
  commit, a push or a merge.

## When **not** to use

- One known reference → [`analyze-repo`](repo.md) directly. The harvester's only
  job is the estate walk.
- Analyzing this repository → `/project-analyze`.
- A dropped local artifact → [`/analyze:inbox`](inbox.md).

## Related

- Command: [`analyze-repo`](repo.md) — the analysis engine this dispatches to.
- Script: `src/scripts/harvest_reference_tokens.ts` — discovery, the only one.
- Rule: [`source-confidentiality`](../../../../rules/source-confidentiality.md)
  — why the identities stay in the gitignored area.
