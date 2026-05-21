---
name: memory:learn-low-impact
tier: 2
cluster: memory
sub: learn-low-impact
skills: [ai-council, upstream-contribute]
description: Preview validated low-impact entries that would be upstreamed to the package seed (default `--preview`); `--apply` opens a draft PR via `upstream-contribute` after re-redaction.
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "upstream low-impact decisions, share validated council questions, contribute the learning corpus"
  trigger_context: "user has accumulated validated entries in agents/decisions/low-impact-decisions.md and wants to share with the package"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# /memory learn-low-impact

Promote `## Validated` entries from
[`agents/decisions/low-impact-decisions.md`](../../agents/decisions/low-impact-decisions.md)
into the upstream seed at
`.agent-src.uncompressed/data/low-impact-decisions-seed.md` via a DRAFT
PR against the agent-config package. **Validated entries only** — probation
entries never upstream, they're unconfirmed signal.

## Flags

| Flag | Default | Behaviour |
|---|---|---|
| `--preview` | **on** | Build the plan, run the redactor, render promoted / refused / already-seeded buckets + draft PR body. **No file write, no branch, no PR.** Default behaviour. |
| `--apply` | off | Mutually exclusive with `--preview`. Required to invoke `upstream-contribute` and open the draft PR. Refusals from the redactor still block. |

Iron Law: ``--apply`` never auto-fires on the first invocation. The
user always sees the preview block first and re-runs explicitly.

## Iron Law — privacy floor runs TWICE

```
THE REDACTOR RUNS AT INTAKE (WRITE GATE) AND AGAIN HERE (UPSTREAM GATE).
ANY VIOLATION → REFUSE THE PR. NO SILENT REWRITES.
```

See [`low-impact-corpus-privacy-floor`](../rules/low-impact-corpus-privacy-floor.md)
for the eight forbidden-content classes.

## Steps

### 1. Build the preview plan

Call
`scripts/ai_council/learn_low_impact_preview.py::build_preview` with
the project-local corpus and the package seed:

```python
from scripts.ai_council.learn_low_impact_preview import build_preview
plan = build_preview(
    corpus_path="agents/decisions/low-impact-decisions.md",
    seed_path=".agent-src.uncompressed/data/low-impact-decisions-seed.md",
    repo_slug="<owner>/<repo>",  # from `git remote get-url origin`
    repo_root="<absolute repo root>",
    private_domains=(),   # from .agent-settings.yml policy
    customer_names=(),    # from .agent-settings.yml policy
    sql_identifiers=(),   # from .agent-settings.yml policy
)
```

The builder runs all three contract checks in one pass:

1. Parses `## Validated` (strict mode — drift surfaces as
   `CorpusParseError`).
2. Diffs against the seed file — already-seeded entries land in
   `plan.already_seeded` and never upstream.
3. Re-runs `redact_low_impact_entry` on every candidate. Failures
   land in `plan.refused`.

### 2. Surface the preview block

Print `plan.render()` verbatim. Always. This is the user-facing
audit trail per `fast-path-marker-visibility` Iron Law — the host
agent MUST NOT swallow or paraphrase it.

```
## learn-low-impact preview — repo=<slug>
last-upstreamed: <sha>
seed: <path>

### Promoted (N) …
### Refused (M) — redactor blocked …
### Already seeded (K) …
```

### 3. Decide based on the flag

- **`--preview` (default)** — stop here. If `plan.would_open_pr` is
  true, the rendered block ends with
  `> Re-run with \`--apply\` to open the draft PR via \`upstream-contribute\`.`
  Hand control back to the user.
- **`--apply`** — refuse when `plan.refused` is non-empty; surface
  the refusals and stop. Otherwise invoke
  [`upstream-contribute`](../skills/upstream-contribute/SKILL.md)
  with:
    - **target file:** `.agent-src.uncompressed/data/low-impact-decisions-seed.md`
    - **PR title:** `plan.render_pr_body()` first heading
    - **PR body:** `plan.render_pr_body()`
    - **patch:** `plan.render_diff()`
    - **draft:** `true` — never auto-merge; review is a human gate.

### 4. Advance the local baseline (`--apply` path only)

When the PR is opened (step 3 returns a PR URL + new commit SHA on
the package branch):

```bash
# update the local pointer so subsequent runs are deltas
sed -i.bak -E "s|^last-upstreamed: .*|last-upstreamed: <new-sha>|" \
    agents/decisions/low-impact-decisions.md
rm agents/decisions/low-impact-decisions.md.bak
```

### 5. Surface result (`--apply` path only)

```
> Drafted PR <url>
> Entries upstreamed: N
> Provenance bumped: <old-sha> → <new-sha>
```

## Halt conditions

- Redactor refuses (any class) — surface, stop. `--apply` is rejected.
- No candidates (`plan.has_work == False`) — exit 0 with the preview
  block; no PR even on `--apply`.
- `--preview` (default) — always stops before any side-effect.
- Package repo unavailable per `upstream-contribute § Step 4` — surface
  the access options, stop.
- User explicitly declines the PR option — exit 0, no PR.

## See also

- [`upstream-contribute`](../skills/upstream-contribute/SKILL.md) — PR
  machinery (branch, commit, gates).
- [`agents/decisions/low-impact-decisions.md`](../../agents/decisions/low-impact-decisions.md)
  — the project-local corpus.
- [`low-impact-corpus-privacy-floor`](../rules/low-impact-corpus-privacy-floor.md)
  — Iron Law.
