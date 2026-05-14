---
name: learn-low-impact
tier: 2
skills: [ai-council, upstream-contribute]
description: Diff project-local `agents/low-impact-decisions.md` against the upstream seed, re-redact validated entries, and open a draft PR to the agent-config package adding them to the seed.
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "upstream low-impact decisions, share validated council questions, contribute the learning corpus"
  trigger_context: "user has accumulated validated entries in agents/low-impact-decisions.md and wants to share with the package"
---

# /learn-low-impact

Promote `## Validated` entries from
[`agents/low-impact-decisions.md`](../../agents/low-impact-decisions.md)
into the upstream seed at
`.agent-src.uncompressed/data/low-impact-decisions-seed.md` via a DRAFT
PR against the agent-config package. **Validated entries only** — probation
entries never upstream, they're unconfirmed signal.

## Iron Law — privacy floor runs TWICE

```
THE REDACTOR RUNS AT INTAKE (WRITE GATE) AND AGAIN HERE (UPSTREAM GATE).
ANY VIOLATION → REFUSE THE PR. NO SILENT REWRITES.
```

See [`low-impact-corpus-privacy-floor`](../rules/low-impact-corpus-privacy-floor.md)
for the eight forbidden-content classes.

## Steps

### 1. Read provenance baseline

```bash
grep "^last-upstreamed:" agents/low-impact-decisions.md
```

Extract the trailing SHA. `0000…0000` → first-ever upstream;
otherwise it's the git SHA of the last seed update.

### 2. Collect candidates

Parse `agents/low-impact-decisions.md`:

- Read every bullet under `## Validated` (skip probation, skip
  anti-examples).
- For each, compare against the existing
  `.agent-src.uncompressed/data/low-impact-decisions-seed.md` in
  the package repo. Already-seeded entries are skipped.

Empty candidate set → exit 0 with `> No new validated entries to upstream.`

### 3. Re-redact (defence in depth)

For each candidate, run
`scripts/ai_council/redact_low_impact_entry.py::redact_low_impact_entry`
again. Any `RedactionResult.ok == False` → **refuse the PR**, surface
the violation, do not continue. The author is asked to drop / rewrite
the offending entry locally and re-run.

### 4. Open draft PR via `upstream-contribute`

Invoke the [`upstream-contribute`](../skills/upstream-contribute/SKILL.md)
skill with:

- **target file:** `.agent-src.uncompressed/data/low-impact-decisions-seed.md`
- **PR title:** `feat(low-impact-seed): add N validated entries from <repo-slug>`
- **PR body:** lists each entry plus its source provenance line
  (validated date only — never the original `seen` timestamps).
- **draft:** `true` — never auto-merge; review is a human gate.

### 5. Advance the local baseline

When the PR is opened (step 4 returns a PR URL + new commit SHA on
the package branch):

```bash
# update the local pointer so subsequent runs are deltas
sed -i.bak -E "s|^last-upstreamed: .*|last-upstreamed: <new-sha>|" \
    agents/low-impact-decisions.md
rm agents/low-impact-decisions.md.bak
```

### 6. Surface result

```
> Drafted PR <url>
> Entries upstreamed: N
> Provenance bumped: <old-sha> → <new-sha>
```

## Halt conditions

- Redactor refuses (any class) — surface, stop.
- No candidates — exit 0, no PR.
- Package repo unavailable per `upstream-contribute § Step 4` — surface
  the access options, stop.
- User explicitly declines the PR option — exit 0, no PR.

## See also

- [`upstream-contribute`](../skills/upstream-contribute/SKILL.md) — PR
  machinery (branch, commit, gates).
- [`agents/low-impact-decisions.md`](../../agents/low-impact-decisions.md)
  — the project-local corpus.
- [`low-impact-corpus-privacy-floor`](../rules/low-impact-corpus-privacy-floor.md)
  — Iron Law.
