# Working across linked sibling projects

When two repositories change together — an API and its frontend, a service and
a shared library — a change in one can silently break the other. The agent can
already read and write a sibling repo, but it won't **proactively consider** one
unless it knows the sibling is relevant. This feature closes that gap: it
detects the sibling your IDE already attached and, after a one-time opt-in,
makes the agent flag cross-repo impact by default.

> **Scope — passive awareness (Option A).** The agent gains *awareness*: it
> warns about cross-repo impact on relevant changes and can read/edit the
> sibling on demand. It does **not** bulk-load the sibling's files into context
> (that would blow up token cost). See
> [ADR-032](../decisions/ADR-032-linked-projects-scope.md). Unrelated to
> [ADR-029](../decisions/ADR-029-multi-workspace-deferred.md) (package root
> layout).

## Auto-detection (Claude Code — verified)

If you attach a sibling repo in your IDE, the agent detects it from on-disk
config and prompts **once** to opt it in:

- **PhpStorm / IntelliJ** — a sibling attached via `.idea/modules.xml` /
  `.idea/vcs.xml` (e.g. `../galawork-web`).
- **VS Code** — folders in a `*.code-workspace`.

On the first turn (and on a new attachment) the agent asks per detected sibling:
include / decline / always / never-ask. Your choice is stored **local-only** in
`.agent-settings.local.yml` (gitignored, per-machine — see below). A declined
sibling is never prompted again.

Once a sibling is in scope, the agent proactively checks it for impact when a
change here may affect it (API contract, shared types) and warns you — without
loading its files wholesale. Large siblings (a real frontend easily exceeds
20 000 files) are flagged `large` and surfaced as awareness only, never skipped.

## Manual setup (other agents / any editor)

Auto-detection is verified for Claude Code only. For Cursor, Augment, Copilot,
or any editor without IDE attachment, add the sibling by hand to
`.agent-settings.local.yml`:

~~~yaml
linked_projects:
  - path: /abs/path/to/web   # or a path relative to the project
    include: true
~~~

Or, if your agent reads a rules file, drop a short note there:

~~~markdown
## Linked sibling project: ../web

`../web` changes alongside this repo. When an API/contract or shared-type
change here may affect it, check `../web` for impact and warn. Don't load its
files wholesale; access specific files on demand.
~~~

## Keep it local, never committed

`.agent-settings.local.yml` is **gitignored on purpose** — sibling paths are
per-developer and per-machine. The installer does **not** touch your
`.gitignore` (decision D2 — you own your ignore file), so if your project does
not already ignore it, add:

~~~gitignore
.agent-settings.local.yml
~~~

## Validate it works

Ask the agent:

> Read `package.json` (or `composer.json`) from the linked sibling and tell me the project name.

If it reports the name, cross-repo access works. An out-of-root edit will prompt
for confirmation, then succeed — that is expected (the agent's permission gate
still applies).

## Tell us what works

Auto-detection is verified for Claude Code only. If you use Cursor, Augment, or
Copilot, please report whether the rule note alone worked, you needed to add the
folder to the IDE workspace, or neither — that evidence is the trigger to extend
verified auto-detection to your agent. See
[ADR-032](../decisions/ADR-032-linked-projects-scope.md).
