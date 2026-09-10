# Compact-instructions template — lose less when you compact anyway

Fallback lane of `road-to-token-economy-recycling` Phase 3.3. The recycle
envelope is the primary path — validated state, no summarizer — and since
2026-09-10 it is written for you: the `session-eol` concern publishes the
continuity record at session end by default (`continuity.auto_record`), so
`/clear` resumes from it with no command to remember.
`agent-config session:recycle` still exists as an explicit affordance for the
cases the automatic writer does not cover (a session that claimed no roadmap, or
a record that should carry the `git status` anchors). This template is for the
user who compacts instead: Claude Code honours a `# Compact instructions` section in the
project's `CLAUDE.md` when it summarizes (see the "Manage context
proactively" section of the host's cost docs), and `/compact <instructions>`
accepts the same guidance ad hoc.

**Adopt:** paste the section below into your project's `CLAUDE.md` (root),
or pass the body to `/compact` directly. One committed file, no hook —
verified against the host docs 2026-08-10.

---

```markdown
# Compact instructions

When compacting this conversation, preserve in full:

- every DECISION made, each with its one-line rationale
- binding CONSTRAINTS (things I was told not to do, scope fences,
  permission grants and their exact wording)
- the current task, its acceptance criteria, and the precise list of
  remaining steps
- VERIFY state: which checks/tests ran, their exact outcomes, and which
  claims are still unverified
- file paths and `file:line` references that later steps depend on

Drop aggressively:

- raw tool output (test logs, diffs, file bodies) — keep only the one-line
  conclusion each produced and the path to re-read
- exploratory dead ends, superseded plans, and repeated content
- pleasantries and process narration

Never convert an unverified claim into a fact while summarizing — keep its
epistemic state (verified / assumed / gap) attached.
```
