# Checklist — dependency bump (expedited)

Loaded on demand by [`code-review`](../SKILL.md) when the diff is **only**
manifest/lockfile changes (`composer.json`/`.lock`, `package.json`/lockfiles,
`pyproject.toml`, `go.mod`/`go.sum`, `Cargo.toml`/`.lock`). Expedited — a
dependency bump does not need the full backend checklist.

| Check | What to look for |
|---|---|
| **Package is real** | The added package exists on the real registry (guards hallucinated / slop-squatted names) — see [`supply-chain-intake`](../../supply-chain-intake/SKILL.md). |
| **Pinned + locked** | Version is pinned and the lockfile is updated in the same diff. |
| **CVE delta** | The new version does not introduce a known CVE; a security bump names the CVE it closes. |
| **Breaking changes** | Major-version bump → the changelog's breaking changes are addressed in the diff (not just the number changed). |
| **Transitive surprise** | The lockfile diff has no unexpected large transitive additions (supply-chain surface). |

If the diff mixes a dependency bump **with** code changes, it is not a pure
dependency change — route to the change-type of the code portion and treat the
bump as one more thing to verify, not the whole review.
