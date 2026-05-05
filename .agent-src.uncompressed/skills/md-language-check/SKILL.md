---
name: md-language-check
description: "Use BEFORE saving any .md under .augment/, .agent-src*/, or agents/ — scans umlauts, German function words, and quoted German phrases outside DE:/EN: anchor blocks. Hard gate per language-and-tone."
source: package
execution:
  type: assisted
  handler: shell
  timeout_seconds: 30
  allowed_tools: []
  command:
    - python3
    - scripts/check_md_language.py
---

# md-language-check

## When to use

Fire this skill **before** writing or saving any `.md` file under:

- `.agent-src.uncompressed/` (source of truth — skills, rules, commands, guidelines, templates, contexts)
- `.agent-src/` (compressed projection)
- `.augment/` (local agent projection)
- `agents/` (project-specific roadmaps, contexts, sessions)

Per [`language-and-tone`](../../rules/language-and-tone.md) § "`.md` files
are ALWAYS English" and § Detection heuristic, every `.md` file in those
trees must be English. Bilingual content lives only in labeled
`DE: … · EN: …` anchor blocks.

Do NOT use when:

- Editing project content outside the trees listed above (READMEs of
  consumer projects, application docs that follow a different policy)
- Reviewing chat history files (`agents/.agent-chat-history` is JSONL, not `.md`)
- Inspecting non-`.md` files — the checker rejects them with a warning

## Procedure

### 1. Identify the file(s) about to be saved

Collect the absolute or repo-relative path of every `.md` file the
agent is about to create or modify in this turn. Multiple files in
one turn → pass them all to a single invocation.

### 2. Run the checker

```bash
python3 scripts/check_md_language.py <path> [<path> …] [--format json]
```

Exit codes:

- `0` → no German content detected, save proceeds
- `1` → violations found, save is **blocked** until they are resolved
  or explicitly suppressed
- `3` → internal error (unreadable file, decode failure)

### 3. Resolve findings

For every violation:

| Kind | Likely cause | Fix |
|---|---|---|
| `umlaut` | German prose leaked into body text | Translate the sentence to English |
| `de_word` | German function word in unquoted prose | Translate; or move into a `DE: … · EN: …` block if intentional bilingual anchor |

If the line is meta-documentation that **must** quote German tokens
(e.g. the detection heuristic in `language-and-tone.md` itself),
append `<!-- md-language-check: ignore -->` at the end of that single
line — never as a wholesale silencer.

### 4. Re-run and confirm

After every fix, re-run the checker on the same paths. Save only
proceeds on exit `0`.

## Allowed escape hatches

- **Labeled anchor block** — lines starting with `DE:` / `- DE:` /
  `* DE:` (and the same for `EN:`) are skipped automatically. Use this
  for intent-based opt-in / opt-out anchors.
- **Fenced code blocks** — `\`\`\` … \`\`\`` content is exempt, so
  shell snippets, JSON fixtures, and quoted user input in code
  blocks pass through untouched.
- **Inline code** — backtick spans are stripped before scanning;
  identifiers like `für_test` inside backticks do not flag.
- **Per-line marker** — append `<!-- md-language-check: ignore -->`
  to a line that genuinely needs to quote a German token in body
  prose (rare; reserved for the rules that document the heuristic).

## Output format

1. One-line summary: `clean` or `N violation(s) found`
2. Per violation: `file:line — kind \`match\`` plus the offending line
3. Next action: translate, move into a `DE:`/`EN:` block, add the
   per-line ignore marker, or revert the change

## Gotchas

- The checker scans `.md` files only; passing a non-`.md` path emits a
  warning and skips it
- The detection word list is intentionally short and conservative —
  a clean run is **necessary but not sufficient**; the agent still
  owns the final language judgement
- Frontmatter (`--- … ---` at file head) is exempt; descriptions and
  YAML keys can use international characters where the schema allows

## Do NOT

- Do NOT silence the checker by deleting trigger words from
  `scripts/check_md_language.py`; extend the allow-list (anchor
  blocks, ignore marker) instead
- Do NOT add the ignore marker to body prose just to push a save
  through; the marker is for meta-documentation that quotes tokens,
  not a generic mute
- Do NOT skip the gate "because the file is small" — `language-and-tone`
  § Detection heuristic applies to every save under the four trees

## Cloud Behavior

On cloud surfaces (Claude.ai Web, Skills API) the checker script is
not shipped, so this skill is **inert** — the agent applies the
heuristic from [`language-and-tone`](../../rules/language-and-tone.md)
manually before emitting the file.
