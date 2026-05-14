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
into upstream seed at
`.agent-src.uncompressed/data/low-impact-decisions-seed.md` via DRAFT
PR against agent-config package. **Validated entries only** — probation
never upstreams, unconfirmed signal.

## Iron Law — privacy floor runs TWICE

```
THE REDACTOR RUNS AT INTAKE (WRITE GATE) AND AGAIN HERE (UPSTREAM GATE).
ANY VIOLATION → REFUSE THE PR. NO SILENT REWRITES.
```

See [`low-impact-corpus-privacy-floor`](../rules/low-impact-corpus-privacy-floor.md)
for eight forbidden-content classes.

## Steps

### 1. Read provenance baseline

```bash
grep "^last-upstreamed:" agents/low-impact-decisions.md
```

Extract trailing SHA. `0000…0000` → first-ever upstream; else git SHA of last seed update.

### 2. Collect candidates

Parse `agents/low-impact-decisions.md`:

- Read every bullet under `## Validated` (skip probation, skip anti-examples).
- For each, compare against existing
  `.agent-src.uncompressed/data/low-impact-decisions-seed.md` in
  package repo. Already-seeded entries skipped.

Empty candidate set → exit 0 with `> No new validated entries to upstream.`

### 3. Re-redact (defence in depth)

For each candidate, run
`scripts/ai_council/redact_low_impact_entry.py::redact_low_impact_entry`
again. Any `RedactionResult.ok == False` → **refuse the PR**, surface
violation, stop. Author drops/rewrites entry locally and re-runs.

### 4. Open draft PR via `upstream-contribute`

Invoke [`upstream-contribute`](../skills/upstream-contribute/SKILL.md)
skill with:

- **target file:** `.agent-src.uncompressed/data/low-impact-decisions-seed.md`
- **PR title:** `feat(low-impact-seed): add N validated entries from <repo-slug>`
- **PR body:** lists each entry + source provenance line
  (validated date only — never original `seen` timestamps).
- **draft:** `true` — never auto-merge; review is human gate.

### 5. Advance local baseline

When PR opens (step 4 returns PR URL + new commit SHA on package branch):

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
  access options, stop.
- User explicitly declines PR option — exit 0, no PR.

## See also

- [`upstream-contribute`](../skills/upstream-contribute/SKILL.md) — PR
  machinery (branch, commit, gates).
- [`agents/low-impact-decisions.md`](../../agents/low-impact-decisions.md)
  — project-local corpus.
- [`low-impact-corpus-privacy-floor`](../rules/low-impact-corpus-privacy-floor.md)
  — Iron Law.
