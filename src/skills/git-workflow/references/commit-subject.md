# The ticket, the commit subject and the branch name

Detail for [`git-workflow`](../SKILL.md) and
[`conventional-commits-writing`](../../conventional-commits-writing/SKILL.md).
The one place that says how a ticket is read out of a branch name, where it goes
in a commit subject, which convention is in force, and how a branch name is
rendered. `/commit`, `/commit:in-chunks`, `/fix:commit-messages`,
`/create-pr:description-only`, `/worktree:create` and the `jira-integration`
skill defer here.

The rules are code: `agent-config git:convention` runs them, and the commands
call it. This page is what a command reads **when the verb cannot run** — no
`agent-config` on `PATH`, or exit `2`. Then apply the generated block below by
reading, say once that the verb was unavailable, and never invent a grammar the
block does not show.

## Reading the ticket

`agent-config git:convention ticket [BRANCH] [--keys "<line>"]` — the current
branch when `BRANCH` is omitted. It prints `ticket <ID>` or `ticket none`, then
every candidate with its status:

- **Every match counts**, in order, wherever it sits (`feat/DEV-1234/...`,
  `DEV-1234-device-export`, `fix/DEV-1234-quantity` → `DEV-1234`). The match
  never depends on `git.branch_pattern`, so a branch named before the pattern was
  set still yields its ticket. The first candidate with status `ticket` wins.
- **`standard-name`** — a key in the denylist (`UTF-8`, `ISO-8601`, `SHA-256`,
  `CVE-2026-12345`, `CWE-79`) is never a ticket, with or without a card:
  `fix/CVE-2026-12345-patch` yields none.
- **`unknown-key`** — `--keys` takes the `ticket_keys` line of the approved
  convention card (`agents/memory/curated/conventions/approved/commit-subject.md`,
  see the [`conventional-commits-writing`](../../conventional-commits-writing/SKILL.md)
  skill § 7), as the caller reads it. A candidate whose key is not on it is
  asked about by `/commit` — a yes adds the key to the card — and omitted by
  `/commit:in-chunks`. Without a card the grammar and the denylist decide alone.
- **`proposal`** — without `--keys`, a commitlint config's `issuePrefixes` are
  printed as a proposed `ticket_keys` line. Offer it; the verb writes nothing.

## Placing the ticket

| `git.commit_format` | With a ticket | Without a ticket |
|---|---|---|
| `ticket-scope` (default) | `feat(DEV-1234): add export filter` | `feat: add export filter` — never `feat(): …` |
| `ticket-conventional` | `DEV-1234 feat(exporter): add export filter` | `feat(exporter): add export filter` |

Under `ticket-conventional` **a ticket is never in the scope** — not as the
scope, not inside a compound one (`feat(api,DEV-1234)` fails). The scope names
the system area (`api/audio`, `ci`), only where it adds clarity.

**Area scope under `/commit:in-chunks`.** Several commits on one branch carry the
same ticket in front of each; the scope is chosen per commit from the area that
commit touches, and dropped where no single area fits. A chunk never inherits
another chunk's scope.

## Which convention is in force

`agent-config git:convention subject` reads subjects on stdin, one per line, and
resolves the convention in this order — the first that applies decides:

1. **A `commit-msg` hook** (`.git/hooks`, `core.hooksPath`, husky) — the commit is
   the validator; the verb validates nothing and exits `0`.
2. **A commitlint config without a hook** — it outranks `git.commit_format`; the
   verb prints the one command that runs it and exits `3`. Where that config
   extends the conventional preset and the committed `.git-convention.yml`
   declares `ticket-conventional`, the two disagree: both are printed, neither
   is adopted, exit `3`.
3. **A declaration** — `git.commit_format` in `.git-convention.yml` (either
   value; ADR-282), or a developer settings file value other than the template
   default. The rule is one for both values: `settings:sync` writes the
   template default into every project file, so a default there cannot be told
   apart from an insert and never outranks an approved card, whichever value
   the default is; today that makes `ticket-conventional` the only developer
   value that counts.
4. **An approved measurement** — the card's `dominant_family`.
5. **The default** — Conventional Commits (`ticket-scope`).

A format that cannot be read (`malformed`, `invalid`, `discarded`) exits `1`
with the line `git:convention show` prints; it is never read as the default.
Exit `1` also lists each failing subject with the rule it broke. Exit `2` is a
usage error. How a family is measured and approved is the
[`conventional-commits-writing`](../../conventional-commits-writing/SKILL.md)
skill's procedure; this page only consumes its card.

## A title that becomes a commit

Where the forge squash-merges — the method `/pr:merge` § 9 reads — the pull
request title becomes the commit subject on the base, so `/create-pr:description-only`
§ 3 builds it as a subject in the convention in force and checks it through
`git:convention subject`, for `ticket-scope` as well as for `ticket-conventional`.
Under any other merge method the title stays `DEV-1234: summary`.

## Rendering a branch name

`agent-config git:convention branch --slug <slug> [--type <type>] [--ticket <ID>]`
renders `git.branch_pattern` (default `{type}/{slug}`) and prints the name:

- an empty placeholder drops with the separator after it, or the one before it
  when it is last (`{ticket}-{slug}` without a ticket → `<slug>`);
- a ticket the pattern has no slot for prefixes the slug
  (`{type}/{slug}` → `feat/DEV-1234-export`);
- a literal character of the pattern is never rewritten, and a value outside
  `[A-Za-z0-9._-]` is refused (exit `1`), not repaired.

A guideline that shows another shape, such as `{type}/{ticket-id}/{short-description}`,
describes a team habit; the name the agent creates follows the declared pattern.

## The grammar

<!-- BEGIN GENERATED: git-convention-grammar -->
<!-- Written by `./scripts-run src/scripts/generate_git_convention_grammar` from `src/scripts/_lib/git_convention_grammar.ts`; edit the module, never this block. -->

```
ticket                      [A-Z][A-Z0-9]+-[0-9]+
standard names              UTF ISO SHA RFC CVE CWE GHSA
format ticket-scope         ^(feat|fix|chore|docs|refactor|test|perf|style|build|ci|revert)(\([^)]+\))?!?: .+
format ticket-conventional  ^([A-Z][A-Z0-9]+-[0-9]+ )?(feat|fix|chore|docs|refactor|test|perf|style|build|ci|revert)(\([^)]+\))?!?: .+
family conventional         ^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([^)]+\))?!?: 
family ticket-conventional  ^[A-Z][A-Z0-9]+-[0-9]+ (build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([^)]+\))?!?: 
family ticket-prefix        ^\[[A-Z][A-Z0-9]+-[0-9]+\][: ]|^[A-Z][A-Z0-9]+-[0-9]+[: ]
family gitmoji              ^:[a-z0-9_+-]+:[[:space:]]|^[^ -~[:cntrl:][:space:]]
family imperative-plain     ^[A-Z][a-z]+[[:space:]].*[^.]$
```

Formats are JavaScript / PCRE syntax; families are POSIX extended, matched in
order, first hit wins. Under `format ticket-conventional` and `family
ticket-conventional` a ticket anywhere inside the scope fails, and a standard
name in the ticket position fails.
<!-- END GENERATED: git-convention-grammar -->

## Patterns that are not this grammar

- **Suggester metadata.** The `trigger_context:` frontmatter of
  `src/domains/engineering-base/implement-ticket/command.md` and
  `src/domains/product-basic/estimate-ticket/command.md`, and the same literal in
  `src/scripts/migrate_command_suggestions.ts`, match a bare-key ticket in a
  prompt to decide when a command is suggested. They keep their own pattern:
  changing it changes when a command is offered.
- **The suggester's matcher.** `src/scripts/command_suggester/match.ts` carries
  the ticket grammar above; a test pins the two equal.
- **A project key in a ticket body.** `src/scripts/refine_ticket_detect.ts` reads
  a project key out of ticket text, not a branch, and is intentionally
  independent.
