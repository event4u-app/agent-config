---
model_tier: inherit
name: humanize
pack: gtm-marketing
tier: 2
visibility: visible
description: Remove AI-writing tells from pasted text or a file — runs the humanizer skill's draft→audit→final loop and prints the rewrite plus a detector summary.
cluster: humanize
skills: [humanizer]
suggestion:
  eligible: true
  trigger_description: "humanize this text, make this sound less like AI, remove AI-isms, de-slop this draft, reads like ChatGPT"
  trigger_context: "user has drafted deliverable prose (post, article, release note) that reads AI-generated and wants it rewritten to read human-written"
workspaces:
  - gtm
packs:
  - gtm-marketing
---

# /humanize

Run the [`humanizer`](../../../src/skills/humanizer/SKILL.md) skill's
full draft→audit→final loop on a piece of deliverable prose. On-demand
counterpart to the write-engine's built-in step 4b audit.

> Drafting **new** text in a captured voice? Use
> [`/ghostwriter:write`](../ghostwriter/write/command.md) or
> [`/post-as:me`](../post-as/me/command.md) — their step 4b already
> runs this audit.

## Input shapes

- `/humanize` followed by pasted text in the same message.
- `/humanize <path>` — read the file at `<path>` (read-only).
- `/humanize --voice=<ghostwriter-slug|me>` — optionally resolve a voice
  via the write-engine's style-source resolution (§ 1 of the
  [`write-engine`](../docs/contracts/write-engine.md) contract):
  a ghostwriter slug loads `agents/reference/ghostwriter/<slug>.md`, `me`
  loads `.agent-user.md`. The resolved fingerprint takes precedence over
  humanizer defaults (a voice that legitimately uses em dashes wins). No
  new voice mechanism — this reuses the engine's resolution verbatim.
- `--language=en|de|auto` — pattern language for the detector (default
  `auto`).

## Steps

### 1. Scope check

Refuse (with the reason) when the input is: a chat reply, repo
documentation under `docs/` / `agents/` / `src/`, technical/reference
prose (neutral register is correct there), or content for a context
requiring AI-authorship disclosure (academic, legal). This mirrors the
skill's Do-NOT list — the command never widens it.

### 2. Run the humanizer loop

Follow [`humanizer § Procedure`](../../../src/skills/humanizer/SKILL.md):
load `data/patterns.md`, draft the rewrite (full coverage, voice
precedence: fingerprint > brand voice > defaults), audit ("what still
reads AI-generated?"), final rewrite.

### 3. Verify mechanically (when a runtime is available)

```bash
npx tsx src/scripts/detect_ai_tells.ts --stdin --fail --language auto
```

Feed the final rewrite via stdin. Over threshold → revise once and
re-run; still over → surface the remaining hits honestly instead of
looping (N=3 budget applies). No runtime → the prose audit is the pass.

### 4. Print

No file writes — print only (engine rule):

1. The final rewrite as a fenced markdown block.
2. Audit notes: tells found → tells remaining (one line per group).
3. Detector summary line when it ran (hard / cluster / dash counts).

Any disclosure footer present in the input is reproduced verbatim —
never reworded, never dropped.

## Output

1. Fenced markdown block with the final rewrite (same coverage and
   register as the input).
2. One-line audit summary + detector counts when available.

## See also

- [`humanizer`](../../../src/skills/humanizer/SKILL.md) — the skill this
  command wraps.
- [`write-engine § 4b`](../docs/contracts/write-engine.md) — the
  built-in audit for ghostwriter/post-as drafts.
- [`content-quoting-floor`](../../../src/rules/content-quoting-floor.md)
  — quoted text is never rewritten.
