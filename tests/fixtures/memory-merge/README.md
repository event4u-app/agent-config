# Memory-Merge Fixture

Proves the no-conflict contract from
[`road-to-memory-merge-safety.md`](../../../agents/roadmaps/road-to-memory-merge-safety.md):
**parallel intake writes on two branches merge clean under `merge=union`**.

Layout:

- `base.jsonl` — starting content committed on `main`.
- `branch-a.jsonl` — what branch A appends.
- `branch-b.jsonl` — what branch B appends.
- `expected-merge.jsonl` — the union-merged result `git merge` produces
  with `merge=union` configured.

The fixture is consumed by `tests/test_memory_merge_fixture.py` — it
boots a throw-away repo, configures `merge=union` for the intake glob,
replays the fixture on two branches, merges, and asserts the tree
matches `expected-merge.jsonl` without a conflict marker.
