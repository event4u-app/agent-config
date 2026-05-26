# Ghostwriter profiles (project-local)

Profiles in this directory capture the public writing voice of
documented public figures so `/ghostwriter:write` and
`/post-as:ghostwriter` can emit copyable drafts in that voice.

## Storage rules

- **Gitignored by default.** Every `*.md` in this directory (except
  this `README.md`) is excluded by the package-managed `.gitignore`
  block. Profiles never get committed unless the maintainer
  explicitly opts in (the `--shared` flag is deferred to v2 — until
  then, profiles stay local).
- **Real-person profiles only.** Fictional fixtures belong in the
  package source at `.agent-src.uncondensed/ghostwriter/`, not here.
  The `task lint-ghostwriter-source` CI gate fails on any consumer
  file carrying `fictional: true`.
- **Created by `/ghostwriter:fetch`.** Direct hand-editing works but
  is not the recommended path — `/ghostwriter:fetch` runs the
  public-figure attestation gate, derives confidence, and stamps
  `source_provenance.verification` correctly.

## What lives in each file

See [`docs/contracts/ghostwriter-schema.md`](../../docs/contracts/ghostwriter-schema.md)
for the locked v1 frontmatter, field reference, ethics floor, and
command surface.

## Commands

| Command | Role |
|---|---|
| `/ghostwriter:fetch` | Create or refresh a profile from URL or name input. |
| `/ghostwriter:write` | Draft text in the chosen voice (with mandatory disclosure footer). |
| `/ghostwriter:list` | Numbered listing of available profiles. |
| `/ghostwriter:show` | Read-only render of one profile. |
| `/ghostwriter:delete` | Two-step confirmation, hard-deletes the file. |
| `/post-as:ghostwriter` | Thin alias to `/ghostwriter:write`. |

## See also

- [`docs/contracts/ghostwriter-schema.md`](../../docs/contracts/ghostwriter-schema.md)
  — the locked v1 schema.
- [`.agent-src.uncondensed/ghostwriter/README.md`](../../.agent-src.uncondensed/ghostwriter/README.md)
  — package-source side and fixture allowlist policy.
