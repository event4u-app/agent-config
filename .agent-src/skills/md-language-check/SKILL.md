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

Fire **before** saving any `.md` file under:

- `.agent-src.uncompressed/` (source of truth)
- `.agent-src/` (compressed projection)
- `.augment/` (local agent projection)
- `agents/` (project roadmaps, contexts, sessions)

Per [`language-and-tone`](../../rules/language-and-tone.md) § "`.md`
files are ALWAYS English" + § Detection heuristic, every `.md` in
those trees must be English. Bilingual content lives only in labeled
`DE: … · EN: …` anchor blocks.

Do NOT use when:

- Editing project content outside the trees above
- Reviewing non-`.md` files (checker rejects them)

## Procedure

### 1. Identify the file(s) about to be saved

Collect every `.md` path the agent is about to create or modify this
turn. Multiple files → one invocation.

### 2. Run the checker

```bash
python3 scripts/check_md_language.py <path> [<path> …] [--format json]
```

Exit codes: `0` clean, `1` violations (save **blocked** until fixed
or suppressed), `3` internal error.

### 3. Resolve findings

| Kind | Cause | Fix |
|---|---|---|
| `umlaut` | German prose in body | Translate to English |
| `de_word` | German function word in unquoted prose | Translate; or move into `DE: … · EN: …` block |

Meta-doc that **must** quote German tokens (e.g. the heuristic in
`language-and-tone.md` itself) → append
`<!-- md-language-check: ignore -->` to that single line. Never as a
wholesale silencer.

### 4. Re-run and confirm

After every fix re-run on the same paths. Save proceeds only on `0`.

## Allowed escape hatches

- **Labeled anchor** — lines starting with `DE:` / `- DE:` / `* DE:`
  (and the same for `EN:`) auto-skipped.
- **Fenced code blocks** — exempt; shell snippets, JSON fixtures,
  quoted user input pass through.
- **Inline code** — backtick spans stripped before scanning.
- **Per-line marker** — `<!-- md-language-check: ignore -->` on lines
  that genuinely quote German tokens (rare).

## Output format

1. One-line summary: `clean` or `N violation(s) found`
2. Per violation: `file:line — kind \`match\`` plus the offending line
3. Next action: translate, move into a `DE:`/`EN:` block, add the
   per-line ignore marker, or revert

## Gotchas

- `.md` files only; non-`.md` paths emit a warning and skip
- Word list is short and conservative — clean run is **necessary
  but not sufficient**; agent owns the final language judgement
- Frontmatter (`--- … ---`) is exempt

## Do NOT

- Do NOT silence by deleting trigger words from
  `scripts/check_md_language.py`; extend the allow-list instead
- Do NOT use the ignore marker as a generic mute
- Do NOT skip the gate "because the file is small"

## Cloud Behavior

Cloud surfaces (Claude.ai Web, Skills API) ship without the script,
so this skill is **inert** there — apply the heuristic from
[`language-and-tone`](../../rules/language-and-tone.md) manually.
