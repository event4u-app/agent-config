---
model_tier: inherit
name: post-as-me
pack: gtm-marketing
tier: 2
visibility: internal
cluster: post-as
sub: me
skills: [post-as]
description: Draft a copyable markdown post in the maintainer's own voice (style source = .agent-user.md.voice_sample). No disclosure footer — the user is the author.
suggestion:
  eligible: true
  trigger_description: "write as me, draft in my own voice, post as myself, draft from .agent-user.md"
  trigger_context: "user wants a copyable draft in their own captured voice from .agent-user.md; no third-party voice, no disclosure footer"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /post-as:me

Generate a copyable markdown draft in the **maintainer's own voice**.
Style source is the project-root `.agent-user.md` file. Implements
the [`write-engine`](../../../docs/contracts/write-engine.md)
contract — **the disclosure footer is omitted** because the user is
the author.

> Writing in a **public figure's** voice? Use
> [`/post-as:ghostwriter`](ghostwriter.md) or
> [`/ghostwriter:write`](../ghostwriter/write.md) — both append the
> mandatory disclosure footer.

## Steps

### 1. Locate `.agent-user.md`

Look in the project root.

| State | Action |
|---|---|
| File missing | **Abort.** Print: *"`.agent-user.md` is missing. Run `/agents:user:init` to capture your voice."* |
| File exists but empty / no `voice_sample` | **Abort.** Print: *"`.agent-user.md.voice_sample` is empty. Run `/agents:user:update` to add a voice sample."* |
| File exists with `voice_sample` | Proceed |

Schema reference:
[`agent-user-schema`](../../../docs/contracts/agent-user-schema.md).

### 2. Load the style source

Read the frontmatter:

- `identity.name` / `identity.nickname` — used only for address-form
  decisions (default-to-nickname when set), **not** appended to the
  output.
- `language` — language of the draft.
- `style.pace` — mapped into the engine's fingerprint slot. Register is
  always `casual` (the agent addresses the user informally — "Du" — and
  formality is not configurable):

  | `.agent-user.md` field | Engine fingerprint slot |
  |---|---|
  | (always) | `vocab_register: casual` |
  | `style.pace: rapid` | `sentence_length_avg: 12` |
  | `style.pace: pragmatic` | `sentence_length_avg: 18` |
  | `style.pace: thorough` | `sentence_length_avg: 28` |

- `voice_sample` — the single paste used as the cadence / register
  anchor. Engine matches its tone within ±25 % sentence length.

The body `# Notes` section is **ignored** for drafting — it is
operator notes, not voice signal.

### 3. Collect topic + modifiers

Per [`write-engine § 2`](../../../docs/contracts/write-engine.md).
Flag form: `--tone=<formal|casual|neutral>`,
`--length=<words>`, `--channel=<linkedin-post|tweet|blog|freeform>`,
`--audience=<text>`. Missing flags → interactive prompt, **one
question per turn**, in the order Topic → Tone → Length → Channel →
Audience. Defaults inherit from the engine's per-channel table and
the pace mapping above.

### 4. Negative-constraint pass (skipped)

`.agent-user.md` v1 has no `taboos` field. Skip per
[`write-engine § 3`](../../../docs/contracts/write-engine.md).

### 5. Draft

Generate the body as a single fenced markdown block per
[`write-engine § 4`](../../../docs/contracts/write-engine.md). Honour
the loaded fingerprint (sentence-length ±25 %, pace),
±15 % length tolerance, write in `language`.

### 6. Disclosure footer (omitted — user is the author)

**Do not append a footer.** `/post-as:me` is the self-author path;
the disclosure footer is reserved for third-party voices
(`/ghostwriter:write`, `/post-as:ghostwriter`). The engine
contract's footer step (§ 5) is deliberately skipped here.

### 7. Print

Print the body inside one fenced markdown block. No file writes, no
commit, no save. The user copies the output manually.

## Rules

- **Do NOT commit, push, or open a PR.** The user owns the git surface.
- **Do NOT append a disclosure footer.** This command is the self-author
  path; appending the ghostwriter footer here is wrong by design.
- **Do NOT consume `personas/*.md` or `agents/reference/ghostwriter/*.md`** —
  those are separate primitives.
- **Do NOT write the draft to disk.** This command prints only.
- **Do NOT proceed when `.agent-user.md` is missing or
  `voice_sample` is empty.** Point the user at `/agents:user:init`
  or `/agents:user:update` and abort.
- **Do NOT bypass the language field.** Draft in
  `.agent-user.md.language` even when the topic prompt is in another
  language (the user will re-prompt if they want a different
  language).

## See also

- [`write-engine`](../../../docs/contracts/write-engine.md) — shared procedural contract.
- [`agent-user-schema`](../../../docs/contracts/agent-user-schema.md) — `.agent-user.md` source schema.
- [`/post-as`](../post-as.md) — parent cluster.
- [`/post-as:ghostwriter`](ghostwriter.md) — sibling consumer, public-figure voice, mandatory footer.
- [`/agents:user:init`](../agents/user/init.md) — bootstrap `.agent-user.md`.
- [`/agents:user:update`](../agents/user/update.md) — refresh `voice_sample`.
