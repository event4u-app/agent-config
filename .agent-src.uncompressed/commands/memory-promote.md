---
name: memory-promote
description: Promote an intake signal (or provisional proposal) into a curated memory entry — opens a PR and runs the admission gate.
skills: [file-editor]
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Curation pipeline — overlaps /memory-add; keep explicit."
---

# /memory-promote

Moves an entry from the provisional layer (intake JSONL) into the
curated layer (`agents/memory/<type>.yml` or sharded). Promotion is
gated by
[`scripts/check_memory_proposal.py`](../../../scripts/check_memory_proposal.py),
which enforces the **pattern-vs-one-off** discipline: either ≥ 2
distinct paths share the root-cause signature, or the submitter
supplies ≥ 3 concrete future decisions that will be steered by the
entry.

## Prerequisites

- The signal already exists in `agents/memory/intake/signals-*.jsonl`
  via [`/propose-memory`](propose-memory.md) or a producer
  (`/bug-fix`, `/do-and-judge`, incident-role exit).
- The user can name the intake `id` (e.g., `sig-abc123`). If not,
  route to the read side:
  `./agent-config memory:lookup --types <type> --key <hint>` to
  surface candidates.

## Steps

### 1. Confirm the signal id

```
> Which intake signal are we promoting?
>
> 1. Paste `sig-xxxxxx`
> 2. Search by path/body — I'll list candidates
```

### 2. Run the admission gate

```bash
./agent-config memory:check-proposal --intake-id <sig-id>
```

If the gate reports failures, show them to the user numbered and ask:

```
> 1. Strengthen evidence — run /propose-memory again to add sibling paths
> 2. Fill `future_decisions:` — I'll edit the intake entry's metadata
> 3. Abandon promotion — the finding stays as intake
```

**Do NOT bypass the gate.** If the user insists, stop and require
explicit confirmation with `--force` intent. Never silently edit the
gate script to lower the bar.

### 3. Draft the curated entry

Using the schema in
[`engineering-memory-data-format`](../guidelines/agent-infra/engineering-memory-data-format.md),
hydrate the full frontmatter:

- `id` — kebab-case slug (not the `sig-*` id — that is an intake marker).
- `status: active`, `confidence: medium` (unless the pattern is old
  and well-validated — then `high`).
- `source:` — at minimum the intake jsonl file + line number.
- `owner:`, `last_validated: <today>`, `review_after_days:`.
- Type-specific fields (`rule`, `symptom`, `path`, …).

Show the YAML draft and ask for confirmation before writing.

### 4. Write the curated entry (content-addressed)

Compute the content hash and write a **one-entry file** at
`agents/memory/<type>/<hash>.yml`:

```bash
HASH=$(./agent-config memory:hash --yaml /tmp/draft.yml)
mkdir -p agents/memory/<type>
mv /tmp/draft.yml agents/memory/<type>/${HASH}.yml
```

- **One entry per file** — the filename is the sha256(canonical-JSON
  of the entry, first 12 hex chars). Two branches promoting the same
  entry converge to the same filename and `git merge` sees an
  unchanged file, not a conflict.
- **Never append** to `<type>.yml` single-file mode in content-
  addressed layouts. If the consumer still uses single-file (legacy),
  the command MUST detect that via `agents/memory/<type>.yml`
  existence and refuse with a migration hint:
  `⚠️  agents/memory/<type>.yml exists — migrate to content-
  addressed first (`/memory-migrate <type>`)`.
- **Schema validation** — run `./agent-config memory:check
  --path agents/memory/<type>/${HASH}.yml` before commit. On failure,
  delete the file and stop.

### 5. Record the supersede link

Append a `type: supersede` line to the monthly intake JSONL:

```bash
echo '{"type":"supersede","supersedes":"<sig-id>","promoted_to":"<curated id>"}' \
    >> agents/memory/intake/signals-$(date +%Y-%m).jsonl
```

This keeps the intake stream truthful — lookups will ignore the
superseded signal.

### 6. Open a promotion PR

```bash
git checkout -b memory/promote-<curated-id>
git add agents/memory/ && git commit -m "memory: promote <sig-id> → <curated-id>"
git push -u origin memory/promote-<curated-id>
# Then route to /create-pr with the memory-promote template hint.
```

### 7. Report

```
> ✅ Promotion drafted.
> - Signal:   <sig-id>
> - Curated:  <curated-id> in agents/memory/<type>.yml
> - PR:       <url or branch name>
> - Next:     review + merge
```

## Safety

- **Never** rewrite existing curated entries — conflicts go through
  supersede-chains, not overwrites.
- **Never** promote without the gate passing — the discipline is the
  value of the curated layer.
- **Never** batch-promote more than one signal per PR — each entry
  deserves a focused review.

## See also

- [`/propose-memory`](propose-memory.md) — write-side entry point.
- [`/memory-add`](memory-add.md) — direct curated write (skips intake).
- [`engineering-memory-data-format`](../guidelines/agent-infra/engineering-memory-data-format.md)
