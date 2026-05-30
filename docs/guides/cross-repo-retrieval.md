# Cross-repo retrieval — pull sibling context without copying files

Once the agent knows about a sibling repo ([detection guide](cross-repo-linked-projects.md)),
cross-repo retrieval lets it **read targeted context** from that sibling — a shared type, an
API contract the frontend consumes, a config the sibling owns — without bulk-including the
sibling's files. It is the read layer on top of detection.

It stays inside [ADR-032](../decisions/ADR-032-linked-projects-scope.md) Option A: read-only,
opt-in per sibling, targeted query only. No full-tree sweep, no implicit inclusion, no writes.

## 1. See which siblings are reachable

```
agent-config linked-projects:list
```

Prints the opted-in siblings as `path · detected via · large`. Add `--all` to see detected
siblings you have not decided on yet. A sibling only becomes reachable once you set
`include: true` for it in `agents/settings/.agent-settings.local.yml` (see the detection guide).

## 2. Retrieve targeted context

```
/knowledge:cross-repo "OrderApiContract"
```

Under the hood:

```bash
python3 scripts/cross_repo_retrieve.py "OrderApiContract" [--path-scope 'src/*.ts'] [--max-chunks 8]
```

You get a bounded table — `source_repo · path · freshness · why` — drawn only from opted-in
siblings. Each chunk is redacted (secrets and PII are scrubbed before anything is shown), so
no credential ever crosses a repo boundary.

## 3. Scope large siblings

A sibling flagged `large` by the detector **requires** a `--path-scope` glob:

```
/knowledge:cross-repo "config" --path-scope 'packages/shared/**'
```

Without a scope, a large sibling is skipped with a note — this keeps retrieval cheap and
targeted instead of walking a huge tree.

## How it ranks in memory

When a skill retrieves memory with the `cross-repo` type, matches are tagged `source: cross-repo`
and scored **below** the project's own curated knowledge — so cross-repo context informs the
answer but never outranks your own repo's truth.

## Notes

- **Read-only.** The surface never writes to a sibling. Out-of-root writes still pass the host
  permission gate; cross-repo retrieval writes nothing.
- **Opt-in only.** A sibling that is not `include: true` is never read.
- **Targeted only.** Path-glob + content grep, never a blind full walk.
- Contract: [`cross-repo-retrieval`](../contracts/cross-repo-retrieval.md). Detection story:
  [`cross-repo-linked-projects`](cross-repo-linked-projects.md).
