# Checklist — docs-only change (light)

Loaded on demand by [`code-review`](../SKILL.md) when the diff touches **only**
documentation / prose (no code, no config).

| Check | What to look for |
|---|---|
| **Accuracy** | Claims match the current code; no reference to a removed/renamed symbol, flag, or path. |
| **Links resolve** | Internal links and file paths point at files that exist. |
| **No secrets** | No credentials, internal hostnames, or tokens pasted into the prose. |
| **Scope** | Docs-only really is docs-only — a diff that also edits a generator's source strings is not (fix the generator, not the generated page). |

Docs-only changes are the lightest review — skip the mechanical/architecture
tiers entirely unless the diff turns out to touch code.
