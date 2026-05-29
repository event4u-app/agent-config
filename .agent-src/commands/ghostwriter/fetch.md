---
name: ghostwriter:fetch
tier: 2
cluster: ghostwriter
sub: fetch
description: Build or refresh a public-figure voice profile under agents/reference/ghostwriter/ from a URL or bare name; runs the public-figure attestation gate; delegates web-fetch/web-search to host.
suggestion:
  eligible: true
  trigger_description: "fetch public figure writing voice, capture LinkedIn / blog / Substack style, build ghostwriter profile from name, refresh stale profile"
  trigger_context: "user wants to capture a documented public figure's writing voice from a URL or by name into agents/reference/ghostwriter/<slug>.md"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /ghostwriter:fetch

Build (or refresh) a ghostwriter profile at
`agents/reference/ghostwriter/<slug>.md` from one of two inputs:

| Input | Mode | Host-agent capability used |
|---|---|---|
| URL (LinkedIn / blog / Substack / personal site) | **URL mode** | web-fetch |
| Bare name (`"Alice Walker"`) | **Name-only mode** | web-search |

Zero network code in the package — the host agent performs the fetch /
search; this command is procedural only. Schema:
[`ghostwriter-schema`](../../../docs/contracts/ghostwriter-schema.md).

## Steps

### 1. Parse input + resolve slug

Argument shape: `/ghostwriter:fetch <input> [--force-refresh]`.

- Looks like a URL (`https?://`) → URL mode. Derive slug from the
  page's primary author / persona name (kebab-case).
- Otherwise → name-only mode. Slug = full name kebab-case
  (`alice-walker`). If a slug already exists with a different role,
  ask the user for a discriminator suffix (`alice-walker-novelist`).

Existing `agents/reference/ghostwriter/<slug>.md`?

| State | Action |
|---|---|
| Missing | Proceed to fresh-fetch flow |
| Exists, no `--force-refresh` | Diff-and-accept flow (Step 6) |
| Exists, `--force-refresh` | Back up to `<slug>.md.bak`, rebuild from scratch |

### 2. Public-figure attestation gate (BLOCKING)

Print verbatim, one question per turn, **all four** required before any
write. Mirrors the deterministic gate in
[`ghostwriter-schema § public-figure gate`](../../../docs/contracts/ghostwriter-schema.md).

1. *"Is the target a documented public figure with a public-facing role
   (author / executive / academic / politician / journalist /
   public-speaker / public-artist / deceased-historical)? Which category?"*
2. *"Are all sources you intend to use public — not paywalled,
   login-walled, leaked, or retracted?"*
3. *"Do you accept the right-of-publicity and defamation surface? The
   package documents the gate but the legal call is yours."*
4. *"Do you understand the disclosure footer on every `/ghostwriter:write`
   output is non-removable?"*

Any "no" / silence / decline → abort. Do not write the file.
Record the UTC ISO timestamp of the fourth "yes" into
`identity.attestation_recorded_at`.

### 3a. URL mode — host-agent fetch

Instruct the host agent: *"Fetch the URL `<input>` and any linked
author archive / post index. Return public posts (target: last 100;
floor: 3 distinct items). Exclude paywalled / login-walled / private
content."*

| Result | Action |
|---|---|
| Host has web-fetch + ≥ 3 distinct items returned | `source_provenance.verification: fetched`; proceed to Step 4 |
| Host has web-fetch but < 3 items | Abort; report the floor; suggest name-only mode for broader sources |
| Host cannot fetch | Emit paste-prompt (Step 3c) |

### 3b. Name-only mode — host-agent search

Instruct the host agent: *"Search authoritative public sources for
`<name>`: Wikipedia, official site, verified social, archived
interviews, published books (for deceased figures). Return ≥ 3
distinct authoritative items."*

| Result | Action |
|---|---|
| ≥ 3 distinct authoritative items | `verification: fetched`; proceed to Step 4 |
| < 3 items | Abort; report the floor; ask the user to supply URLs |
| Host cannot search | Emit paste-prompt (Step 3c) |

### 3c. Paste-prompt fallback

Print: *"Host agent cannot fetch / search. Paste ≥ 3 public-source
excerpts with their URLs; one excerpt per code block, max ~200 words
each. Type `done` when finished."*

Collected material → `source_provenance.verification: user-asserted`.
`/ghostwriter:show` will surface a `⚠️ user-asserted` warning on this
profile.

### 4. Derive frontmatter

From the gathered material, populate the locked frontmatter per
[`ghostwriter-schema § locked frontmatter (v1)`](../../../docs/contracts/ghostwriter-schema.md):

- `identity.*` — name, role, category (from Step 2), source URLs,
  `fetched_at` (today, ISO date), `attestation_recorded_at` (Step 2).
- `style.fingerprint.*` — derive `sentence_length_avg`, `vocab_register`,
  opener / closer patterns, hashtag / emoji rules, paragraph cadence
  from the gathered excerpts.
- `style.free_form_notes` — short prose summary.
- `voice_samples` — pick up to 3 public excerpts, ≤ 200 words each,
  source-attributed.
- `taboos` — what the figure demonstrably never does in public writing.
- `source_provenance.{count, last_fetched_at, types, verification}`.
- `confidence` — derived deterministically:

  | Sources × types | Confidence |
  |---|---|
  | 3 sources, same platform | `low` |
  | 3+ sources, 2+ platforms | `med` |
  | 5+ sources, 3+ platforms, ≥ 1 canonical | `high` |

- `fictional: false` (always, for consumer-side files).
- `last_updated` — today, ISO date.

Body: a single `# Notes` section, empty for fresh fetches.
**Hard cap: 200 lines total.**

### 5. Propose + confirm (fresh-fetch path)

Print the proposed file content as a fenced markdown block. Ask:

> 1. write — save to `agents/reference/ghostwriter/<slug>.md`
> 2. edit — open in IDE first (per `file-editor` skill), save after
> 3. cancel — discard

Only on choice 1 or 2 (after save) write the file. Print the
post-write summary:

```
✅  agents/reference/ghostwriter/<slug>.md written.
    confidence: <low|med|high>  ·  sources: <n>  ·  verification: <fetched|user-asserted>
```

### 6. Diff-and-accept (re-fetch path, no `--force-refresh`)

Re-run Steps 2–4 against the existing file. Show a **field-by-field
diff** (frontmatter keys + voice samples). Ask the user to accept
per-field changes (numbered options). Bump `last_updated` and
`source_provenance.last_fetched_at` on accept. Mirrors
[`/agents:user:accept`](../agents/user/accept.md).

### 7. Stale-warning surface (always)

After any write (or no-op accept), if any other profile under
`agents/reference/ghostwriter/*.md` has `source_provenance.last_fetched_at` >
90 days old, print one line per stale profile:

```
⚠️  ghostwriter/<other-slug>.md last fetched YYYY-MM-DD (>90 days). Run /ghostwriter:fetch <other-slug> --force-refresh.
```

Non-blocking.

## Rules

- **Do NOT commit, push, or open a PR.** The user owns the git surface.
- **Do NOT write the file before the attestation gate completes** with
  four explicit "yes" answers.
- **Do NOT bypass the < 3 distinct sources floor** under any flag.
- **Do NOT introduce network code in the package** — the host agent
  performs every fetch / search; this command only orchestrates.
- **Do NOT accept private / paywalled / leaked / retracted material**
  even when the user pastes it (Step 3c).

## See also

- [`ghostwriter-schema`](../../../docs/contracts/ghostwriter-schema.md) — locked v1 frontmatter, verification levels, confidence derivation.
- [`/ghostwriter`](../ghostwriter.md) — parent cluster.
- [`/ghostwriter:write`](write.md) — consume side; appends the mandatory disclosure footer.
- [`/agents:user:accept`](../agents/user/accept.md) — the diff-and-accept flow this command mirrors on re-fetch.
