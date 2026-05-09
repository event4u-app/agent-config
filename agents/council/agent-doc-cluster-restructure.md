# Command-cluster restructure: agent-doc surface

## Context

A governed skill / rule / command suite for AI coding tools (Augment, Claude Code, Cursor, Cline, Windsurf, Gemini CLI). Slash commands are organised in verb clusters (e.g. /optimize skills, /optimize rtk) using colon syntax /cluster:sub. Locked clusters live in docs/contracts/command-clusters.md. New atomic commands are linter-blocked unless they declare cluster: pointing to a locked cluster. Rename / collapse cycle: deprecation-shim then 1 minor then 1 major before removal.

## Today: 7 commands touch agent docs across 3 clusters

Cluster /copilot-agents (introduced when AGENTS.md was Copilot-specific):
- /copilot-agents init — creates AGENTS.md and .github/copilot-instructions.md from package templates, fills in placeholders from auto-detected stack.
- /copilot-agents optimize — refactors both files for line / char budgets.

Cluster /optimize (general):
- /optimize agents — audits agent infrastructure: token overhead, rule triggers, AGENTS.md, stale refs. Suggest only.
- /optimize agents-md — focused refactor of one AGENTS.md to the Thin-Root contract (caps, pointer ratio at least 40%, capability bullets, emergency-triage block). Suggest only.
- /optimize skills, /optimize augmentignore, /optimize rtk — non-agent siblings, stay.

Cluster /agents (the agents/ knowledge DIRECTORY, NOT AGENTS.md):
- /agents prepare — scaffolds the agents/ dir.
- /agents audit — audits agents/ content, emits a cleanup roadmap.
- /agents cleanup — executes the cleanup roadmap.

## Pain points the user named explicitly

1. 4 different commands touch AGENTS.md — nobody knows which one to call.
2. "agents" is overloaded — same word means three things (folder, AGENTS.md, agent infra).
3. copilot-agents is misleading — AGENTS.md is now the universal multi-tool standard (Anthropic, AI Hero, Netresearch all converged on it), not Copilot-specific.

## Proposed restructure (host agent's draft, what the council MUST critique)

Two clusters split by ARTEFACT:

  /agents                    — agents/ DIRECTORY
     /agents init            (renamed from prepare for cluster-verb consistency)
     /agents audit
     /agents cleanup

  /agents-md                 — AGENTS.md FILE family (incl. copilot-instructions.md, multi-tool roots)
     /agents-md init         (was /copilot-agents init)
     /agents-md optimize     (merger of /optimize agents-md + /copilot-agents optimize)
     /agents-md check        (was /optimize agents — audit-only, never edits)

  /optimize                  — non-agent only
     /optimize skills
     /optimize augmentignore
     /optimize rtk

Drop /copilot-agents cluster entirely (deprecation-shim then /agents-md).
Drop /optimize agents and /optimize agents-md (deprecation-shim then /agents-md).
Verb set unified: init / audit / check / cleanup / optimize.

## What the council must answer — please debate, don't just list

1. Naming: hyphen-cluster /agents-md is novel here (every other cluster is one word: /optimize, /agents, /fix, /feature, /judge). Alternatives:
   a. /agents-md — explicit, two artefacts unambiguously separated by -md suffix.
   b. /docs — /docs init, /docs optimize, /docs check for AGENTS.md; /agents keeps folder ops. Generic but /docs could collide with project docs later.
   c. /agents folder-* vs. /agents md-* — three-level cluster, all under /agents, sub-prefix disambiguates artefact. More to type, no new cluster.
   d. Drop /agents (folder cluster), fold its 3 verbs into /agents-md as e.g. /agents-md folder-init — collapses to one cluster, but mixes artefact concepts.
   e. Rename /agents → /agents-dir, keep /agents-md — both clusters get a suffix, naming is symmetric.

   Which is least confusing for a developer who has never seen this surface, and why? Disagreement is welcome.

2. Verb consistency — is init / audit / check / cleanup / optimize the right verb-set? Is check distinct enough from audit? Should audit and check collapse?

3. Migration risk — is the deprecation-shim cycle (1 minor + 1 major) the right cadence here, or is this surface small enough that a single-release breaking change with a loud CHANGELOG entry is cleaner?

4. Hidden third option — is there a structural option neither side has named (e.g. flatten everything to /optimize agent-*, or move AGENTS.md ops out of /optimize entirely and into a doc-tooling cluster)?

5. The user's complaint distilled: "niemand weiß was was macht." Rank the top 3 things the proposal MUST nail to make that complaint go away — beyond renames.

## Constraints

- Must respect docs/contracts/command-clusters.md (locked clusters, deprecation cycle).
- AGENTS.md remains the canonical multi-tool root file; CLAUDE.md, GEMINI.md, .cursorrules etc. are stub / symlink references to it.
- Linter lint_no_new_atomic_commands.py blocks new top-level commands; everything new MUST land in a cluster.
- Council members are reviewing as independent voices — Anthropic Sonnet-4.5 and OpenAI gpt-4o. Disagree where you disagree. Argue, don't average.

## Output the council must produce

A single ranked recommendation per member: which option (1a–1e) wins, why, what to change in the rest of the proposal (verbs, migration, etc.), and one risk the host agent missed.
