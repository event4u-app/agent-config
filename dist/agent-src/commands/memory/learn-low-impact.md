---
model_tier: medium
name: memory-learn-low-impact
pack: memory
visibility: internal
cluster: memory
sub: learn-low-impact
skills: [ai-council]
description: Preview which validated low-impact entries would be worth upstreaming — read-only, opens nothing, writes nothing.
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - memory
---

# /memory learn-low-impact

Show which `## Validated` entries from
[`agents/decisions/low-impact-decisions.md`](../../agents/decisions/low-impact-decisions.md)
would be worth upstreaming, and which the privacy floor refuses.
**Validated entries only** — probation entries are unconfirmed signal and
never appear here.

## This command opens nothing

```
READ-ONLY. NO BRANCH, NO COMMIT, NO PUSH, NO PULL REQUEST, NO FILE WRITE.
THE `--apply` FLAG WAS RETIRED: IT WROTE INTO A PACKAGE SEED FILE
THAT DOES NOT EXIST, AND A SECOND WAY OUT WOULD BE A SECOND SET
OF GUARANTEES. ONE WAY OUT IS `self-repair:release`.
```

The package ships no seed corpus today, so the already-seeded baseline is
empty and every validated entry that clears the redactor shows as promotable.
That is a true reading of the tree, not a backlog.

## Iron Law — privacy floor runs TWICE

```
THE REDACTOR RUNS AT INTAKE (WRITE GATE) AND AGAIN HERE (REVIEW GATE).
ANY VIOLATION → THE ENTRY IS REFUSED AND NAMED. NO SILENT REWRITES.
```

See [`low-impact-corpus-privacy-floor`](../rules/low-impact-corpus-privacy-floor.md)
for the eight forbidden-content classes.

## Steps

### 1. Build the preview plan

Call `build_preview` from
`src/scripts/ai_council/learn_low_impact_preview.ts` with the project-local
corpus and the exported seed path:

```ts
import {
    build_preview,
    PACKAGE_SEED_PATH,
} from '../../scripts/ai_council/learn_low_impact_preview.js';

// Both paths are RELATIVE and must be resolved explicitly — the corpus
// against the project root, the seed against the PACKAGE root. Passed bare
// they resolve against cwd, where a consumer project that happens to carry
// `data/low-impact-decisions-seed.md` would be read as the package seed and
// silently mark its own entries `already_seeded`.
const plan = build_preview(path.join(projectRoot, 'agents/decisions/low-impact-decisions.md'), path.join(packageRoot, PACKAGE_SEED_PATH), {
    repoSlug: '<owner>/<repo>',   // from `git remote get-url origin`
    repoRoot: '<absolute repo root>',
    privateDomains: [],           // from .agent-settings.yml policy
    customerNames: [],            // from .agent-settings.yml policy
    sqlIdentifiers: [],           // from .agent-settings.yml policy
});
```

`PACKAGE_SEED_PATH` is the one place that literal lives, so no caller
restates it. The file it names is not in the tree, and that is not an error:
the builder returns an empty already-seeded set, which is the current state
of this package.

The builder runs all three contract checks in one pass:

1. Parses `## Validated` (strict mode — drift surfaces as a parse error).
2. Diffs against the seed file — already-seeded entries land in
   `plan.already_seeded`.
3. Re-runs `redact_low_impact_entry` on every candidate. Failures land in
   `plan.refused`.

### 2. Surface the preview block

Print `plan.render()` verbatim. Always. This is the user-facing audit trail
per the `fast-path-marker-visibility` Iron Law — the host agent MUST NOT
swallow or paraphrase it.

```
## learn-low-impact preview — repo=<slug>
last-upstreamed: <sha>
seed: <path>

### Promoted (N) …
### Refused (M) — redactor blocked …
### Already seeded (K) …
```

### 3. Stop

Hand control back to the user. The block is the deliverable. Nothing in this
command sends anything; if the package ever ships a seed corpus again, the
`revisit if` on decision D2 of
`road-to-one-upstream-that-checks-what-leaves` fires and the route is designed
once, on the one ladder.

## Halt conditions

- Redactor refuses (any class) — surface the refusals in the block, stop.
- No candidates (`plan.has_work` is false) — exit 0 with the preview block.
- Corpus missing or drifted — surface the parse error, stop.

## See also

- [`agents/decisions/low-impact-decisions.md`](../../agents/decisions/low-impact-decisions.md)
  — the project-local corpus.
- [`low-impact-corpus-privacy-floor`](../rules/low-impact-corpus-privacy-floor.md)
  — Iron Law.
- [`upstream-contribute`](../skills/upstream-contribute/SKILL.md) — the one
  front on the one outward step, for findings that are worth sending.
