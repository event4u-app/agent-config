---
name: ghostwriter:write
tier: 2
cluster: ghostwriter
sub: write
description: Draft a markdown post in the voice of a captured public-figure ghostwriter profile; appends the mandatory non-removable disclosure footer.
suggestion:
  eligible: true
  trigger_description: "draft post in style of public figure, write in someone's voice, ghostwriter draft, LinkedIn post in style of X"
  trigger_context: "user wants to generate a copyable draft in a previously captured public-figure voice with the mandatory disclosure footer"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /ghostwriter:write

Generate a copyable markdown draft in the voice of a captured
ghostwriter profile under `agents/reference/ghostwriter/<slug>.md`. Implements
the [`write-engine`](../../../docs/contracts/write-engine.md) contract
with **mandatory disclosure footer** appended by this command's output
template (not by the model, no opt-out).

> Writing in your **own** voice? Use [`/post-as:me`](../post-as/me.md)
> — reads `.agent-user.md`, no disclosure footer.

## Steps

### 1. Select the ghostwriter (style source)

Argument shapes:

- `/ghostwriter:write` → interactive numbered menu (see below).
- `/ghostwriter:write --as=<value> [...modifiers]` → non-interactive.
- `/ghostwriter:write <value> [...modifiers]` → positional shorthand.

`<value>` resolves against **slugs** and (when
`ghostwriter.aliases: true` in `.agent-project-settings.yml` — default
on) the `aliases:` list of every consumer profile. See
[`ghostwriter-schema § Aliases`](../../../docs/contracts/ghostwriter-schema.md#aliases).

Scan `agents/reference/ghostwriter/*.md`, excluding `README.md` and any file
with `fictional: true` (fixtures are not consumable from this
command — they live in the package source as schema examples).

Resolution order for `--as=<value>` / positional `<value>`:

1. **Slug match** — case-insensitive equality against filename stem.
2. **Alias match** (skip when `ghostwriter.aliases: false`) —
   case-insensitive equality against every profile's `aliases:` entry.
   Conflicts are impossible at runtime — the consumer-side lint
   rejects cross-profile alias collisions at commit time, so an alias
   resolves to exactly one profile or zero.
3. **No match** → abort with: *"No profile matches `<value>` (tried
   slug + aliases). Run `/ghostwriter:list` to see available profiles."*

| State | Action |
|---|---|
| Zero non-fixture profiles | **Abort.** Print: *"No ghostwriter profiles exist. Run `/ghostwriter:fetch <url-or-name>` first."* |
| One or more profiles, interactive | Numbered menu: `1. <slug> — <identity.name> · <confidence> · <last_updated>` |
| `--as=<value>` / positional | Resolve via the order above; abort on no match |

User picks by number or value. No default — explicit choice required.

### 2. Load the style source

Read the selected file's frontmatter. Required keys (per
[`ghostwriter-schema`](../../../docs/contracts/ghostwriter-schema.md)):
`identity.name`, `style.fingerprint.*`, `style.free_form_notes`,
`voice_samples`, `taboos`, `source_provenance.verification`.

`verification: user-asserted` → print a one-line warning before
proceeding: *"⚠️ Profile is user-asserted (not host-fetched).
Style fidelity may be lower."* Non-blocking.

### 3. Collect topic + modifiers

Per [`write-engine § 2`](../../../docs/contracts/write-engine.md).
Flag form: `--tone=<formal|casual|neutral>`,
`--length=<words>`, `--channel=<linkedin-post|tweet|blog|freeform>`,
`--audience=<text>`. Missing flags → interactive prompt, **one
question per turn**, in the order Topic → Tone → Length → Channel →
Audience. Tone / length defaults derive from the per-channel table
and the vocab-register → tone mapping in the engine contract.

### 4. Negative-constraint pass

Apply the loaded `taboos` list as exclusions before drafting (per
[`write-engine § 3`](../../../docs/contracts/write-engine.md)). Print
a one-line acknowledgement: *"Excluding N taboos from this profile."*

### 5. Draft

Generate the body as a single fenced markdown block per
[`write-engine § 4`](../../../docs/contracts/write-engine.md). Honour
fingerprint constraints: sentence-length ±25 %, opener / closer
patterns, hashtag / emoji rules, ±15 % length tolerance.

### 6. Append the disclosure footer (literal, deterministic)

After the body, emit a blank line, then the literal string (rendered
in the user's language; English template below):

```
*Written in the style of <identity.name>, not by them.*
```

This footer is appended **by this command's output template** as a
fixed string. It is not produced by the model. No `--no-disclosure`
flag, no `--internal` flag, no opt-out. The absence of any such flag
is the acceptance criterion (locked in
[`ghostwriter-schema`](../../../docs/contracts/ghostwriter-schema.md)
§ Mandatory disclosure footer).

**The footer always uses `identity.name`, never the alias that
triggered the command.** Invoking `--as=Hawking` against a profile
with `identity.name: "Stephen Hawking"` produces *"Written in the
style of Stephen Hawking, not by them."* — never *"…of Hawking…"*.
Aliases are UX-only; identity attribution stays deterministic.

### 7. Print

Print the complete block (body + blank line + footer) inside one
fenced markdown region. No file writes, no commit, no save. The user
copies the output manually.

### 8. Stale-warning surface

If the selected profile's `source_provenance.last_fetched_at` is
> 90 days old, print one line **after** the fenced block:

```
⚠️  agents/reference/ghostwriter/<slug>.md last fetched YYYY-MM-DD (>90 days). Run /ghostwriter:fetch <slug> --force-refresh.
```

Non-blocking.

## Rules

- **Do NOT commit, push, or open a PR.** The user owns the git surface.
- **Do NOT omit the disclosure footer.** It is mandatory on every
  invocation. Any flag that would suppress it is forbidden by design
  and rejected by the package skill linter (`scripts/lint_skills.py`).
- **Do NOT write the draft to disk.** This command prints only.
- **Do NOT blend multiple ghostwriter voices.** One style source per
  invocation in v1.
- **Do NOT consume `personas/*.md` or `.agent-user.md`** — those are
  separate primitives. Personas are review lenses; `.agent-user.md`
  is `/post-as:me`.
- **Do NOT proceed without an explicit `--as=<slug>` or interactive
  selection.** No default ghostwriter.
- **Do NOT bypass the negative-constraint pass** even when the user
  asks for off-profile content. Surface the taboo and abort.

## See also

- [`write-engine`](../../../docs/contracts/write-engine.md) — shared procedural contract.
- [`ghostwriter-schema`](../../../docs/contracts/ghostwriter-schema.md) — locked v1 frontmatter.
- [`/ghostwriter`](../ghostwriter.md) — parent cluster.
- [`/ghostwriter:fetch`](fetch.md) — the producer side.
- [`/post-as:ghostwriter`](../post-as/ghostwriter.md) — thin alias for this command.
- [`/post-as:me`](../post-as/me.md) — sibling consumer, user-self voice, no footer.
