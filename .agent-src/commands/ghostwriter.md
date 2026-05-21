---
name: ghostwriter
tier: 2
description: Ghostwriter cluster — fetch, write, list, show, and delete public-figure voice profiles (the third voice primitive alongside personas/ and .agent-user.md).
cluster: ghostwriter
type: orchestrator
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "fetch a public figure's writing voice, write in someone's style, list ghostwriter profiles, refresh stale profile"
  trigger_context: "user wants to capture or use the public-facing writing voice of a documented public figure for AI-assisted drafting"
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

# /ghostwriter

Top-level orchestrator for the `/ghostwriter` family — the **public-figure
voice cluster**. Captures and consumes the writing voice of documented
public figures (authors, executives, academics, journalists, public
speakers, deceased historical figures).

The third voice primitive in the package:

- `personas/*.md` — review-lens voices (internal critique).
- `.agent-user.md` — the maintainer's own voice (self).
- `ghostwriter/*.md` — external public-figure voices (this cluster).

No folding, no shared schema, no cross-cluster commands. Schema contract:
[`ghostwriter-schema`](../docs/contracts/ghostwriter-schema.md).

> Looking to write in **your own** voice? Use
> [`/post-as:me`](post-as/me.md) (reads `.agent-user.md`, no disclosure
> footer — you are the author).

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/ghostwriter:fetch` | `commands/ghostwriter/fetch.md` | Build a profile from a URL or a bare name via host-agent web-fetch / web-search; runs the public-figure attestation gate before writing |
| `/ghostwriter:write` | `commands/ghostwriter/write.md` | Draft markdown in the selected ghostwriter's voice with the mandatory disclosure footer |
| `/ghostwriter:list` | `commands/ghostwriter/list.md` | Numbered listing of available profiles with confidence and stale-warning flags |
| `/ghostwriter:show` | `commands/ghostwriter/show.md` | Read-only render of a single profile (identity, fingerprint, samples, taboos, sources) |
| `/ghostwriter:delete` | `commands/ghostwriter/delete.md` | Two-step confirmation, hard-delete the profile file |

Cluster locked in
[`command-clusters`](../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/ghostwriter:<sub> [args]` or
   `/ghostwriter <sub> [args]`.
2. Look up the sub-command in the table above.
3. Load the routed file and follow its `## Steps` section verbatim
   with the remaining args.
4. Unknown or missing sub-command → print the table and ask which one.
   **One sub-command per turn**; do not chain.

## Rules

- **Zero network code in this package.** `fetch` delegates web-fetch /
  web-search to the host agent's built-in tools. If the host cannot
  fetch / search, the command emits a paste-prompt and accepts the
  user's manual paste.
- **Public figures only.** The public-figure-category enum in
  [`ghostwriter-schema § identity`](../docs/contracts/ghostwriter-schema.md)
  is the binding allowlist. Private individuals are rejected — no
  fair-use defence.
- **Mandatory disclosure footer.** Every `:write` output ends with
  `*Written in the style of <name>, not by them.*` (or the equivalent
  in the user's language). No `--no-disclosure` flag exists.
- **Banned source content.** Private DMs, paywalled material,
  login-walled content, leaked drafts, retracted content, anything
  explicitly marked private. See
  [`ghostwriter-schema § exclusions`](../docs/contracts/ghostwriter-schema.md).
- **No commit / push / PR** unless the sub-command explicitly authorises
  it (none currently do).
- **Edit `.agent-src.uncompressed/` only.** `.agent-src/` and `.augment/`
  regenerate from source.

## Storage model (recap)

| Location | Holds | Tracked in git? |
|---|---|---|
| `agents/reference/ghostwriter/<slug>.md` (consumer) | Real-person public-figure profiles | **No** — gitignored by default. `--shared` opt-in deferred to v2. |
| `agents/reference/ghostwriter/README.md` (consumer) | Directory anchor + how-to | Yes |
| `.agent-src.uncompressed/ghostwriter/*.md` (package) | `fictional: true` fixtures only | Yes — CI-enforced by `scripts/lint_ghostwriter_source.py` |

Slug = full-name kebab-case with optional `-<discriminator>` suffix
(`alice-walker` vs `alice-walker-novelist`). The package never
deduplicates slugs across consumer projects — namespace collisions are
consumer-owned.

## See also

- [`ghostwriter-schema`](../docs/contracts/ghostwriter-schema.md) — locked v1 frontmatter and verification levels.
- [`/post-as:me`](post-as/me.md) — write in the maintainer's own voice (separate primitive, no disclosure footer).
- [`/post-as:ghostwriter`](post-as/ghostwriter.md) — thin alias for `/ghostwriter:write`.
