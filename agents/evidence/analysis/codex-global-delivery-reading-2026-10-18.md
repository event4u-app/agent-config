<!-- evidence-type: analysis -->
# What Codex reads of the global delivery

Step 4.1 of `road-to-an-installed-layer-that-is-thinned`. Measured 2026-10-18
against **`codex-cli 0.148.0`** (Homebrew build, macOS), on the branch that adds
this file, based on `origin/main` @ `6194e2769`.

The install writes `rules/`, `skills/`, `commands/` and `personas/` under
`~/.codex/` (`GLOBAL_DEPLOY_SOURCES.codex = CLAUDE_SKILL_BUNDLE`,
`src/install/wizard-plan.ts`) and no `~/.codex/AGENTS.md`. The question was
whether Codex reads any of those markdown files as instructions.

## Method

`codex debug prompt-input "hello"` renders the model-visible prompt input as
JSON. It makes no model call and needs no credentials, so the probe ran with
`HOME` and `CODEX_HOME` both pointed at a scratch directory, never at the real
`~/`. Each delivered subtree got one canary file carrying a unique token, and
the rendered prompt was grepped for the tokens.

| Case | Scratch layout | Tokens in the rendered prompt |
|---|---|---|
| A — install shape | `rules/canary-rule.md` (with `type: always` frontmatter), `commands/canary-cmd.md`, `personas/canary-persona.md`, `skills/canary-skill/SKILL.md` | the skill's **description** only |
| B — A plus a global `AGENTS.md` | A, and `~/.codex/AGENTS.md` | the skill description, and the `AGENTS.md` body inside an `# AGENTS.md instructions` block |
| D — project scope | a project directory with `AGENTS.md` and `.codex/agent-config.md` (the bridge marker the project install writes) | the project `AGENTS.md` body; **not** the bridge marker |

The skill appears in the skills list as name, description and file path; its
body (a separate canary) is not in the prompt, which is the usual on-demand
skill shape.

## Finding

On this build:

1. **`~/.codex/skills/` is read** — every delivered skill is discoverable.
2. **`~/.codex/rules/*.md`, `~/.codex/commands/*.md` and
   `~/.codex/personas/*.md` are not read as instructions.** They are delivered
   and inert. `codex execpolicy check --rules <file>` parses a Starlark
   `prefix_rule(...)` file, which is the format Codex's own `rules/` namespace
   uses; a markdown file is not that format. The probe does not establish
   whether Codex loads `~/.codex/rules/` for execution policy at all — a
   malformed `.rules` file there produced no error from `prompt-input`, which is
   inconclusive rather than negative.
3. **`~/.codex/AGENTS.md` is read when present, and the install writes none.**
4. **At project scope, `AGENTS.md` is read and `.codex/agent-config.md` is
   not.** The README's project-scope claim ("Auto-discovers `AGENTS.md`") holds.

## What this does not establish

- Any build other than `codex-cli 0.148.0`. Host load semantics change between
  versions; this is a reading of one build, not a standing fact about the host.
- Any host other than Codex. The same bundle goes to several hosts
  (`CLAUDE_SKILL_BUNDLE`); none of them was probed here.
- Whether a skill is actually invoked in a live session — only that it is
  listed to the model.

## Reproduce

Build a scratch directory with `home/.codex/{rules,commands,personas,skills/canary-skill}`
holding one canary file each and a `proj/` directory, then from `proj/`:

```bash
HOME="$S/home" CODEX_HOME="$S/home/.codex" codex debug prompt-input "hello" > out.json
grep -o 'CANARY-[A-Z0-9-]*' out.json | sort -u
```
