---
stability: beta
keep-beta-until: 2026-08-13
---

# `ghostwriter/<slug>.md` schema (v1)

> **Status:** beta — locked for the `/ghostwriter` cluster roadmap.
> Re-evaluate fields after the cluster has shipped + been in use
> for ≥ 1 week.

A **ghostwriter profile** is a single Markdown file that captures the
public writing voice of a documented public figure so the `/ghostwriter:write`
and `/post-as:ghostwriter` commands can emit copyable drafts in that
voice. Ghostwriter is the third voice primitive in the package, peer
to `personas/*.md` (review-lens, internal) and `.agent-user.md` (the
maintainer themselves).

The file is owned by the user. The agent never edits it without an
explicit `accept` step on `/ghostwriter:fetch` re-runs.

## Storage model (dual)

- **Consumer projects** — `agents/reference/ghostwriter/<slug>.md`. Real-person
  profiles live here. **Gitignored by default** via the package-managed
  `.gitignore` block. A `--shared` opt-in to commit profiles is
  deferred to v2; only the doc note lands in v1.
- **Package source** — `.agent-src.uncompressed/ghostwriter/` ships
  the README, this schema doc, and `fictional: true` fixtures only.
  **Zero real-person profiles ever ship with the OSS package.** A CI
  lint (`task lint-ghostwriter-source`) enforces this rule by failing
  on any non-allowlisted file or any file lacking the `fictional: true`
  frontmatter key.

Slug = full-name kebab-case (`alice-walker`). Optional `-<discriminator>`
suffix for disambiguation (`alice-walker-novelist` vs `alice-walker-cyclist`).
Namespace conflict resolution is consumer-owned — the package does not
deduplicate across consumers.

## Locked frontmatter (v1)

```yaml
---
version: 1
fictional: false             # required — true for package-side fixtures, false for real-person consumer profiles
identity:
  name: "Alice Walker"       # required — public name
  role_or_title: "novelist"  # required — short role label
  era: "1944–"               # optional — birth–death range; "1944–" if living
  public_figure_category: "public_artist"  # required — enum below
  source_urls:               # required — public sources only, ≥ 3 distinct items
    - "https://example.org/walker/interview-1"
    - "https://example.org/walker/essay-collection"
    - "https://example.org/walker/lecture-2018"
  fetched_at: "2026-05-15"   # required — ISO date of last fetch
  confidence: "med"          # required — low | med | high (see § Confidence)
  attestation_recorded_at: "2026-05-15T10:00:00Z"  # required — when the user attested (NOT consent, see § Ethics floor)
aliases:                     # optional, consumer-only — alternative names that resolve to this slug
  - "Hawking"                # case-insensitive match, case-preserving storage
  - "Prof. Hawking"          # min 2 chars, no homoglyphs (see § Aliases)
style:
  fingerprint:
    sentence_length_avg: 18  # avg words per sentence across samples
    vocab_register: "literary"  # casual | conversational | professional | literary | academic
    opener_patterns: ["personal anecdote", "rhetorical question"]
    closer_patterns: ["call to reflection", "quoted aphorism"]
    hashtag_rules: "never"   # always | sometimes | never
    emoji_rules: "never"     # always | sometimes | never
    paragraph_cadence: "long-form, 4–6 sentence paragraphs"
  free_form_notes: |
    Tends to weave personal narrative with broader social observation.
    Rarely uses imperatives; prefers invitations.
voice_samples:               # required — max 3 items, each ≤ 200 words, source-attributed
  - source_url: "https://example.org/walker/interview-1"
    length_words: 142
    text: |
      [actual public excerpt, max 200 words]
taboos:                      # required — what the target never does in public writing
  - "political endorsements"
  - "profanity"
  - "hashtag-driven posts"
source_provenance:           # required
  count: 3                   # number of distinct source URLs
  last_fetched_at: "2026-05-15"
  types: ["interview", "essay", "lecture"]  # platforms/formats represented
  verification: "fetched"    # required — fetched | user-asserted (see § Verification)
last_updated: "2026-05-15"   # YYYY-MM-DD — bumped on every accepted change
---
```

After the frontmatter, the body is a single freeform **`# Notes`**
section for the user's own observations on the profile. Hard cap:
**200 lines** total file size (frontmatter + body + Notes).

## Field reference

| Field | Required | Purpose |
|---|---|---|
| `version` | yes | Schema version. v1 is the only valid value today. |
| `fictional` | yes | `true` for package fixtures, `false` for real-person consumer profiles. Drives `task lint-ghostwriter-source`. |
| `identity.name` | yes | Public name of the figure. |
| `identity.role_or_title` | yes | Short role label (novelist, executive, …). |
| `identity.era` | no | Birth–death range. Trailing `–` for living figures. |
| `identity.public_figure_category` | yes | Enum: `author` \| `executive` \| `academic` \| `politician` \| `journalist` \| `public_speaker` \| `public_artist` \| `deceased_historical`. |
| `identity.source_urls` | yes | ≥ 3 public source URLs. Drives `confidence`. |
| `identity.fetched_at` | yes | ISO date of the most recent fetch. |
| `identity.confidence` | yes | `low` \| `med` \| `high` — derived from source count/diversity. |
| `identity.attestation_recorded_at` | yes | ISO timestamp the user attested the public-figure gate. |
| `aliases` | no | Consumer-only list of alternative names that resolve to this profile's slug. See [§ Aliases](#aliases). Banned on `fictional: true` fixtures. |
| `style.fingerprint.*` | yes | Structured shape of the voice. All sub-fields required. |
| `style.free_form_notes` | yes | Free-form supplement to the structured fingerprint. |
| `voice_samples` | yes | Max 3 items; each `≤ 200 words`; each source-attributed. |
| `taboos` | yes | What the target never does — feeds the write engine's negative-constraint pass. |
| `source_provenance.count` | yes | Distinct source URLs. |
| `source_provenance.last_fetched_at` | yes | ISO date — drives the 90-day stale warning. |
| `source_provenance.types` | yes | Platforms/formats (interview, essay, post, book, …). |
| `source_provenance.verification` | yes | `fetched` (host agent retrieved) \| `user-asserted` (user pasted; not verifiable). |
| `last_updated` | yes | ISO date, bumped on every accept. |

## Confidence

Derived deterministically from `source_provenance.count` and `types`:

| Sources × types | Confidence |
|---|---|
| 3 sources, same platform | `low` |
| 3+ sources, 2+ platforms | `med` |
| 5+ sources, 3+ platforms, ≥ 1 canonical (Wikipedia / official site / published book) | `high` |

`/ghostwriter:fetch` refuses to write a profile with fewer than 3 distinct
authoritative sources.


## Aliases

`aliases` is an **optional, consumer-only** field listing alternative
names that resolve to this profile's slug. It is a portability win
over per-user shell aliases — team-shared profiles become immediately
usable without per-developer config.

The list is read by `/ghostwriter:write --as=<value>` (and the
`/post-as:ghostwriter` thin alias) when resolving the style source:

1. Exact slug match (case-insensitive on filename stem).
2. **If no slug match**, scan every consumer profile's `aliases` list
   for a case-insensitive equality match against `<value>`.
3. If neither matches, fall through to the interactive numbered menu.

### Storage rules

- **Case-insensitive match, case-preserving storage** — the resolver
  treats `--as=hawking` and `--as=Hawking` as identical, but the YAML
  preserves the author's chosen casing.
- **Minimum length: 2 characters** — single-character aliases are
  collision magnets and are rejected by the consumer-side lint.
- **No homoglyphs** — aliases must use Latin script (ASCII letters,
  digits, common punctuation, common Latin diacritics). Cyrillic,
  Greek, or other confusable scripts are rejected. Prevents spoofing
  like `Stephеn` (Cyrillic `е`) shadowing `Stephen`.
- **Case-insensitive uniqueness within a profile** — a single profile
  cannot list both `"Hawking"` and `"hawking"`.
- **Case-insensitive uniqueness across consumer profiles** — two
  different profiles in the same consumer tree cannot share an alias
  (including alias-vs-slug collisions). Conflicts fail the consumer-side
  lint (Option B — lint-time rejection, never a runtime disambiguation
  menu). Determinism contract trumps UX convenience.

### Footer integrity (canonical name only)

The mandatory [disclosure footer](#mandatory-disclosure-footer-deterministic)
**always** uses `identity.name`, never the alias that triggered the
command. A user invoking `/ghostwriter:write --as=Hawking` against a
profile with `identity.name: "Stephen Hawking"` produces a footer
reading *"Written in the style of Stephen Hawking, not by them."* —
not *"…of Hawking, not by them."* This makes aliases UX-only; identity
attribution stays deterministic.

### Package-source ban

`aliases:` is **forbidden** on any file with `fictional: true`. Package
fixtures are schema examples for a single canonical name; aliases are a
consumer-only deployment feature. The package-source lint
(`task lint-ghostwriter-source`) fails on `aliases:` in
`.agent-src.uncompressed/ghostwriter/`.

### Settings toggle (consumer-only)

The consumer enables alias resolution via `.agent-project-settings.yml`:

```yaml
ghostwriter:
  aliases: true   # default: true — set to false to disable resolver
```

Toggling `aliases: false` makes `/ghostwriter:write --as=<value>` resolve
against slug names only; any `aliases:` entries in profiles are ignored
at resolve time (but the lint still validates them on commit).

## Verification

`source_provenance.verification` distinguishes two acquisition paths:

- `fetched` — the host agent retrieved the source URLs via its built-in
  web-fetch / web-search capability. Default for `/ghostwriter:fetch`.
- `user-asserted` — the host agent could not fetch and the user pasted
  the material manually. The package cannot independently verify these
  sources. `/ghostwriter:show` surfaces user-asserted profiles with a
  visible `⚠️ user-asserted sources — not independently verified` line.

This split exists because the package contains zero network code (see
[§ Determinism floor](#determinism-floor)); the agent cannot otherwise
distinguish first-party fetch from paste-and-trust.

## Ethics floor

### Public-figure-only gate (advisory)

Before `/ghostwriter:fetch` writes any file, the user must explicitly
attest that:

1. The target is a documented public figure with a public-facing role
   matching `public_figure_category`.
2. The source URLs are public, not paywalled, not login-walled, not
   leaked, not retracted.
3. The user accepts the right-of-publicity and defamation surface — the
   user owns the legal call, not the package.
4. The user understands the disclosure footer on every `/ghostwriter:write`
   output is non-removable.

The attestation timestamp is recorded in `identity.attestation_recorded_at`.

**The gate is advisory by design.** The package has no network code and
cannot verify the target's public-figure status against Wikidata or any
external source. The user's attestation is a documented user-asserted
checkpoint, not legal consent on the figure's behalf — for living
figures, no consent path exists short of direct opt-in (deferred to v2).

### Mandatory disclosure footer (deterministic)

Every `/ghostwriter:write` and `/post-as:ghostwriter` output ends with
this literal footer:

```
Written in the style of <identity.name>, not by them.
```

The footer is appended by the command's procedural output template as
a literal string — **not** generated by the model. There is no
`--no-disclosure` flag. The acceptance criteria grep-verify the absence
of any opt-out flag in the command source.

### Banned content (always)

Even for documented public figures, `/ghostwriter:fetch` refuses:

- Leaked drafts or material marked private / draft / internal.
- Paywalled or login-walled content.
- Private DMs, private email leaks, retracted posts.
- Medical, financial, or legal data attributed to the figure.
- Opinions the figure has not publicly stated.

### Excluded targets

Private individuals (a random LinkedIn user who is not a public figure)
remain out of scope. This carve-out only widens the persona-roadmap's
"no third-party PII" floor for documented public figures, never for
anyone else.

## Determinism floor (inherited)

The `agent-config` package contains **zero network code**. `/ghostwriter:fetch`
is a procedural document that delegates the fetch or search to the host
agent's built-in capability. The package only reads the returned data
and proposes a diff for user acceptance.

## Staleness

When `source_provenance.last_fetched_at` is older than 90 days, any
`/ghostwriter:*` command surfaces a one-line warning (non-blocking):

```
⚠️  ghostwriter/<slug>.md was last fetched YYYY-MM-DD (>90 days ago). Run /ghostwriter:fetch <slug> --force-refresh.
```

## Re-fetch flow

`/ghostwriter:fetch` on an existing slug routes through a diff-and-accept
flow mirroring `/agents user accept` — the user reviews the proposed
diff before any write. `--force-refresh` rebuilds the profile from scratch
instead of merging.

## Lint enforcement (`task lint-ghostwriter-source`)

The lint runs in `task ci` and fails on:

1. Any file under `.agent-src.uncompressed/ghostwriter/` whose stem is
   **not** on the fixture allowlist (`scripts/ghostwriter_fixture_allowlist.txt`).
2. Any allowlisted file missing `fictional: true` in frontmatter.
3. Any package-source file (`fictional: true`) carrying an `aliases:`
   field (aliases are a consumer-only feature; see [§ Aliases](#aliases)).
4. Any consumer-side file under `agents/reference/ghostwriter/` with `fictional: true`
   (fictional profiles belong in the package source, not consumer trees).
5. Any consumer-side `aliases:` entry that violates the storage rules:
   shorter than 2 characters, non-Latin scripts (homoglyph protection),
   duplicate within a profile (case-insensitive), or colliding across
   profiles (case-insensitive — alias-vs-alias or alias-vs-slug).

New package-side fixtures require updating the allowlist + reviewer
sign-off.

## Commands

| Command | Role |
|---|---|
| `/ghostwriter:fetch` | Creates or refreshes a profile from URL or name input. Runs the public-figure gate. |
| `/ghostwriter:write` | Generates a draft in the chosen voice. Appends the mandatory disclosure footer. |
| `/ghostwriter:list` | Numbered listing of available profiles. |
| `/ghostwriter:show` | Read-only render of one profile. |
| `/ghostwriter:delete` | Two-step confirmation, hard-deletes the file. |
| `/post-as:me` | Separate top-level command. Reads `.agent-user.md`; shares the write engine. |
| `/post-as:ghostwriter` | Thin alias to `/ghostwriter:write`. |

See [`command-clusters.md`](command-clusters.md) for the locked
cluster registration.

## Gitignore

`agents/reference/ghostwriter/*.md` (except `README.md`) is added to the
package-managed `.gitignore` block ([`config/gitignore-block.txt`](../../config/gitignore-block.txt))
and ignored by default. A `--shared` opt-in to commit profiles is
deferred to v2.

## See also

- [`agent-user-schema`](agent-user-schema.md) — the maintainer-self primitive that `/post-as:me` consumes.
- [`persona-schema`](persona-schema.md) — the review-lens primitive, distinct from ghostwriter.
- [`command-clusters`](command-clusters.md) — the canonical cluster registry.
