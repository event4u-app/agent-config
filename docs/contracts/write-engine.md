---
stability: beta
keep-beta-until: 2026-08-13
---

# Write-engine contract (v1)

> **Status:** beta — shared procedural contract consumed by
> `/ghostwriter:write`, `/post-as:ghostwriter` (alias), and
> `/post-as:me`. Locked alongside the ghostwriter cluster roadmap.

The **write engine** is the deterministic procedure that produces a
copyable markdown draft in a captured voice. It deliberately has no
implementation file — the engine is a sequence of steps the host
agent follows verbatim. The same steps are referenced by every
consumer command; the **only** axis of variation is:

1. **Style source** — which file the engine reads to load the voice.
2. **Disclosure footer** — appended when the style source is *external*
   (a ghostwriter profile), omitted when the style source is *self*
   (`.agent-user.md`).

## Style sources

| Consumer command | Style source | Footer |
|---|---|---|
| `/ghostwriter:write` | `agents/reference/ghostwriter/<slug>.md` (selected) | **Mandatory** |
| `/post-as:ghostwriter` | Same as above (thin alias) | **Mandatory** |
| `/post-as:me` | `.agent-user.md` (project root) | **Omitted** — user is the author |

No other style source is permitted in v1. Consuming `personas/*.md`
voices is explicitly out of scope — personas are review lenses, not
author voices.

## Procedure (followed verbatim by every consumer)

### 1. Resolve the style source

Each consumer command resolves a single style source before invoking
the engine. The engine receives a fully populated style object with:

- `identity.name` (for the footer when applicable)
- `style.fingerprint.*` (sentence length, register, opener / closer
  patterns, hashtag / emoji rules, paragraph cadence)
- `style.free_form_notes` (or `voice_sample` for `/post-as:me`)
- `taboos` (ghostwriter only — empty list for `/post-as:me`)

Missing style source → consumer command aborts with a pointer at the
appropriate setup command (`/ghostwriter:fetch` or `/agents user init`).

### 2. Collect the topic + modifiers

One question per turn, in this order:

1. **Topic** — required. Plain prose, no quoting.
2. **Tone** — optional. Enum: `formal | casual | neutral`. Default
   inherits `style.fingerprint.vocab_register` mapped per the table
   below.
3. **Length** — optional. Integer word count. Default: see the
   per-channel defaults table.
4. **Channel** — optional. Enum: `linkedin-post | tweet | blog | freeform`.
   Default: `freeform`.
5. **Audience** — optional. Free-form one-line descriptor.

Modifiers may be supplied via flags (`--tone=casual --length=200
--channel=linkedin-post --audience="early-stage founders"`) to skip
the interactive interview. `--as=<slug>` selects the ghostwriter
non-interactively for `/ghostwriter:write` and the alias. `--raw`
skips the step-4b humanize audit for this run (see § 4b).

#### Per-channel defaults

| Channel | Length default | Cadence guidance |
|---|---|---|
| `tweet` | 50 words | One paragraph, no lists. |
| `linkedin-post` | 180 words | 2–4 short paragraphs. Hashtags only if `style.fingerprint.hashtag_rules` allows. |
| `blog` | 600 words | Inherits `style.fingerprint.paragraph_cadence`. |
| `freeform` | 250 words | Inherits `style.fingerprint.paragraph_cadence`. |

#### Vocab-register → tone mapping (default inheritance)

| `vocab_register` | Default `tone` |
|---|---|
| `casual` / `conversational` | `casual` |
| `professional` / `literary` | `neutral` |
| `academic` | `formal` |

### 3. Apply negative-constraint pass (ghostwriter only)

Before drafting, the engine surfaces the loaded `taboos` list and
explicitly excludes those moves from the draft (no political
endorsements, no profanity, no hashtag-driven posts, etc.). For
`/post-as:me`, the negative-constraint pass is skipped (the user does
not pre-declare taboos in v1).

### 4. Draft

Emit the body as a single fenced markdown block. The body MUST:

- Match `style.fingerprint.sentence_length_avg` within ±25%.
- Honour `style.fingerprint.opener_patterns` for the first sentence.
- Honour `style.fingerprint.closer_patterns` for the last sentence.
- Respect `style.fingerprint.hashtag_rules` and `emoji_rules`.
- Stay within ±15% of the requested length.

### 4b. Humanize audit (default-on, `--raw` opts out)

After drafting and before the footer, run the AI-tell audit from the
[`humanizer`](../../src/skills/humanizer/SKILL.md) skill against the
draft body:

1. Ask: "What makes this draft read AI-generated?" — audit against the
   pattern catalog (`src/skills/humanizer/data/patterns.md`), counting
   clusters, never isolated hits.
2. Revise the draft to clear the audit findings while preserving the
   step-4 fingerprint constraints and full coverage.
3. Where a runtime is available, verify the final body with
   `npx tsx src/scripts/detect_ai_tells.ts --stdin --fail` under the
   thresholds from the consumer's `humanizer:` block in
   `.agent-project-settings.yml` (defaults: hard 0, cluster score 3 per
   500 words, dash density 2 per 500 words). No runtime → the prose
   audit in (1) is the pass; do not skip it.

Precedence and scope rules (binding, not judgment calls):

- **Fingerprint wins.** When the profile's captured voice legitimately
  uses a watched pattern (a figure who genuinely writes in em dashes,
  `emoji_rules: allowed`, hashtag rules), the step-4 fingerprint
  constraint is authoritative and the corresponding tell is suppressed
  for that run.
- **The disclosure footer (§ 5) is exempt.** It is a literal template
  string appended after this step — the audit never inspects, rewords,
  or removes it.
- **Technical/reference output is excluded.** When the requested
  artifact is reference or technical documentation, skip step 4b and
  say so — neutral, plain prose is the correct register there.
- **`--raw` opts out per run.** The flag skips step 4b entirely (for
  deliberate neutral-register output); it never touches the footer
  rules. Default is on for every engine consumer
  (`humanizer.write_engine: on`).

### 5. Append the disclosure footer (ghostwriter only)

For ghostwriter consumers, append on its own line, separated by a
blank line:

```
Written in the style of <identity.name>, not by them.
```

The footer is appended **by the command's output template** as a
literal string — it is not generated by the model and has no opt-out
flag. For `/post-as:me` the footer is omitted entirely (the user is
the author).

### 6. Print the draft

Print the fenced markdown block. No commit, no save, no file write.
The user copies the output manually. The engine performs no side
effects on disk.

## Rules

- **No `--no-disclosure` flag.** For any ghostwriter consumer, the
  footer is mandatory and deterministic. `task lint-skills` greps the
  ghostwriter command sources for the literal string `no-disclosure`
  and fails CI on a hit.
- **No multi-voice draft in v1.** One style source per invocation;
  blending voices is deferred.
- **No file writes.** The engine prints; the user copies. Saving the
  output to `agents/` or anywhere else is a future feature.
- **Quote floor applies.** Any draft citing an external source follows
  [`content-quoting-floor`](../../src/rules/content-quoting-floor.md) —
  ≤15 words per quote, one quote per source, paraphrase by default.

## See also

- [`ghostwriter-schema`](ghostwriter-schema.md) — the source schema
  for `/ghostwriter:write`.
- [`agent-user-schema`](agent-user-schema.md) — the source schema
  for `/post-as:me`.
- [`command-clusters`](command-clusters.md) — cluster registration.
