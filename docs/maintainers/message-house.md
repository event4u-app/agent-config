# Message house

> Maintainer reference for user-facing copy: README, docs site landing page,
> Introduction, `package.json` and `.github/about.yml`. Every capability
> sentence below carries a `<!-- claim:ID -->` marker that resolves to a
> `status: backed` entry in [`docs/CLAIMS.md`](../CLAIMS.md), or a link to the
> exact section of [`docs/benchmark.md`](../benchmark.md) it is read from.
> Statuses were re-checked against the ledger on 2026-11-01.
>
> Word choice and sentence rules live in [`docs-voice.md`](docs-voice.md).
> The one-liner and the install-scope sentence are copied from
> [`docs/decisions/docs-that-sell-rulings-2026-11.md`](../decisions/docs-that-sell-rulings-2026-11.md)
> (rulings 0.3 and 0.5) and are never paraphrased here or anywhere else.

## The one-liner

> **Agent Config — teach your AI coding agents to check their work before they say done**

The tail after the dash is byte-identical in the README H1, the
`package.json` description and the `.github/about.yml` description
(`src/scripts/lint_positioning.ts` enforces it). "Teach" is deliberate: it
states an instruction the agent receives, which is true on every tool, rather
than an outcome the package guarantees, which is only true where it can block
(ruling 0.3).

**Sub-line** (when a second line is needed): "Install once. Your AI coding
tools are told to plan, test and verify before they say done; on Claude Code a
turn that changed files without checking them can be stopped."

## Who we write for

| Persona | What they hire Agent Config for | The fear that stops the install | What answers the fear |
|---|---|---|---|
| **Solo developer** on Claude Code or Cursor, owns their own setup | An agent that stops saying "done" on code it never ran, without retyping the same instructions every session. | "It floods my context, costs me tokens and scatters files over my machine that I cannot get rid of." | The cost table below, stated up front. Uninstall removes only its own entries. <!-- claim:surgical-uninstall --> |
| **Tech lead of a small team** on mixed tools (Claude Code, Cursor, Copilot and others) | One set of engineering habits — commits, reviews, planning — in every tool the team happens to use. | "Another opinionated framework that locks us to one vendor and fights the config we already have." | It writes each tool's own format. <!-- claim:host-agent-count --> Nothing is written into the repository except a folder for your own changes (install-scope sentence below). |
| **Non-engineer profile user** (founder, content, agency, finance, ops) | A focused set of workflows for their role instead of a developer toolkit. | "A huge developer catalog I cannot navigate, and a terminal-heavy setup." | `init` opens a browser wizard whose first question is the role ([`docs/profiles.md`](../profiles.md)). |

## Three pillars

### 1. It checks its work

The message: the package changes behavior, not model intelligence. The agent
is taught to analyse before editing, to test, and to verify by running
something before it claims done.

- A read-only checker, `production-validator`, answered NOT READY with the
  exact file and line on a planted hollow implementation and READY with no
  spurious findings on a clean one. Two planted cases on Claude Code, not a
  hit rate. <!-- claim:wedge-hollow-detection -->
- Re-measured on 2026-11-04 after the scorer repair: the installed package's
  discipline gain on Claude Haiku was not significant (p=0.181) and Claude
  Sonnet showed none; the earlier significant Haiku gain is a pre-repair
  figure. [Post-repair rerun](../benchmark.md#post-repair).
  <!-- claim:discipline-lift-weak-host -->
- Where the tool lets the package block, blocking removed the measured
  violation classes; instructions alone reduced them but did not remove them.
  Blocking is available on Claude Code only.
  <!-- claim:conformance-advisory-vs-blocking -->

### 2. Every tool you use

The message: one install, written into each tool's own format; no lock-in to
a model or a vendor.

- 23 tools are detected; 20 get a written configuration; Aider, Zed and
  JetBrains are export-only. <!-- claim:host-agent-count -->

### 3. Focused, and leaves cleanly

The message: you get the part that fits your role, and removing it leaves the
rest of your setup untouched.

- On tools without a listing switch, a new install ships a reduced,
  role-scoped skill set instead of the whole catalog; Claude Code and Codex
  get every skill and show them by visibility instead.
  <!-- claim:default-install-context-cost -->
- Uninstall removes only its own keys from a shared tool config and leaves a
  neighbour's entries byte-identical. <!-- claim:surgical-uninstall -->
- `uninstall --global --purge` deletes only the files the package recorded
  writing, never the tool's folder itself.
  <!-- claim:uninstall-purge-inventory-bounded -->

### Roof: we publish our nulls

- Measured nulls are published and features are retired or constrained when
  the evidence does not support them; every published null links its run.
  <!-- claim:positioning-honest-nulls -->

## Honest trade-offs

These sit next to the install, never in a footnote.

- **It costs more tokens.** The extra tokens are mostly the verification
  turns themselves. Measured on Claude Haiku, two scope tasks, 2026-11-04: the
  install as shipped costs 7.8× a run with no rules; the core rules alone
  (kernel plus `downstream-changes`) cost 2.9× and carry the only significant
  gain. See [post-repair rerun](../benchmark.md#post-repair-weak).
  <!-- claim:essential-tier-cost-factor --> Do not generalise past Haiku:
  the strong-host run was a null and the non-Claude replication failed.
- **Blocking only on Claude Code.** Everywhere else the rules are
  instructions the model is asked to follow; they reduce violations but do not
  remove them. <!-- claim:conformance-advisory-vs-blocking --> The per-tool
  picture is [`docs/enforcement-by-host.md`](../enforcement-by-host.md).
- **Other honest lines.** Node 22.6 or newer (`package.json` `engines`). A
  daily update check against the npm registry is on by default and is
  suppressed in CI, without a terminal, or with `AGENT_CONFIG_NO_UPDATE_CHECK=1`
  (`src/config/agent-settings.template.yml`, `update_check`). Telemetry is off
  unless an org pack configures it ([`SECURITY.md`](../../SECURITY.md)). No
  external adoption evidence exists yet: never imply users we cannot name.

## Install scope — the canonical sentence

Copied verbatim from ruling 0.5; never paraphrase it.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files and a block each in
> `.gitignore` and `.gitattributes`; `agent-config init --project` creates just
> those in a repository and nothing else.

## The before and after — canonical, reuse verbatim

Used unchanged on the README, the docs landing page and the Introduction. It
is a narrated scenario, never invented terminal output. Copy everything
between the two rules, the claim marker included.

---

**Before.** You ask your agent to add a CSV export. It writes a handler that
returns a hard-coded placeholder, the existing tests stay green and it replies
"Done — export implemented." Nothing ever ran the new code.

**After.** In Claude Code you ask `@production-validator` whether the branch is
really done. It reads the code that would ship, finds the placeholder and
answers **NOT READY** with the exact file and line. On a branch that is really
finished it answers **READY** and reports nothing. We tested this on two cases:
one with a placeholder left in, one finished. <!-- claim:wedge-hollow-detection -->

On Claude Code the package can also refuse to let a turn end on "done" when the
agent changed files and ran nothing to check them. On every other tool that is
an instruction the agent is asked to follow, not a block.
<!-- claim:conformance-advisory-vs-blocking -->

---

Why it is safe to paste: no number, no comma before "and" or "or", none of the
README watchlist words, and both capability lines are bound to backed claims.
The turn-end refusal is the `turn-end-gate` concern
(`src/scripts/hook_manifest.yaml`, `severity: blocking`), honoured as a refusal
only on Claude Code; no separate measured claim exists for it, which is why the
block states it as a mechanism and binds it to the blocking-versus-advisory
measurement rather than to a success rate.

## Day-one commands

Verified against the frontmatter `visibility:` key
([`docs/contracts/command-surface-tiers.md`](../contracts/command-surface-tiers.md):
`visible` = Tier 0, `advanced` = Tier 1, `internal` = Tier 2) and the CLI help
tiers in `src/scripts/_dispatch.bash`.

| Command | Visibility | What it does for you |
|---|---|---|
| `/work "<what you want>"` | `visible` | Takes a free-form request through refine, plan, implement, test and verify, and reports back; it never commits for you. |
| `/implement-ticket <ticket>` | `visible` | The same loop for a ticket: it refines the ticket first and stops to ask when something is ambiguous. |
| `/review:changes` | `internal` (child of the `advanced` `/review` orchestrator) | Reviews your local diff before the PR with seven focused reviewers (bugs, security, tests, quality, architecture, spec, overbuild) and merges their verdicts. |
| `/commit` | `visible` | Stages your changes and commits them as logical Conventional Commits, after showing you the split. |
| `agent-config doctor` | CLI Tier 1 (`--help --tier=1`) | Checks the install and reports anything missing or changed on disk, with the next command to fix it. |

Names as installed: the review command is the file
`dist/agent-src/commands/review/changes.md`, invoked as `/review:changes`;
`review-changes` is only its frontmatter `name:`. `/commit` is the file
`commit.md` (frontmatter `name: git-commit`). User copy writes `/review:changes`
and `/commit`. Note for the owner: `/review:changes` is Tier 2 by the
orchestrator-child rule, so a day-one list that teaches it is ahead of the
registry; either keep it as the one named exception or promote it through the
contract's ADR gate.

## The two honest answers

### Why not a short CLAUDE.md?

Partly, you could — and we measured how far that gets you. On Claude Haiku,
nine always-on rules plus one more rule (`downstream-changes`), pasted into the
system prompt as plain text, kept a significant discipline gain (+0.458 against
+0.542 for the full package) at 3.3× the tokens of a run with no rules,
against 11.7× for the full package; the remaining gap was not significant.
([cost-factor sweep](../benchmark.md#cost-factor-sweep-claude-haiku-4-5--lift-per-loaded-context-cost))

Two findings from the same sweep matter for anyone writing their own file:

- **Content beats length.** A larger rule set that left out the one rule
  carrying the gain produced no gain at all. A short file helps only if it is
  the right short file.
- **The cost is behavior.** The smaller rule set cost slightly more per run
  than the larger null one, because checking its work is what spends the tokens.

What the package adds beyond a static file:

- **Rules that load when they apply.** A router loads the narrower rules when a
  task triggers them, so they do not sit in every prompt.
- **Refusal where the tool allows it.** On Claude Code a few hooks can block an
  action or a premature "done"; a static file can only ask.
  <!-- claim:conformance-advisory-vs-blocking -->
- **Workflows, not only rules.** `/work`, `/implement-ticket`,
  `/review:changes` and `/commit` carry the procedure, not just the reminder.
- **The same setup in every tool.** <!-- claim:host-agent-count -->
- **A clean way out.** <!-- claim:surgical-uninstall -->

### What does it cost?

The token cost follows the discipline setting, which the install `--profile`
sets (`minimal`, `balanced` — the default — or `full`). The role profile you
pick in the wizard changes which skills and workflows you get, not this
setting, and has no separate measurement.

| Install profile | Discipline setting | Measured cost (Claude Haiku) |
|---|---|---|
| `minimal` | `off` — the nine always-on rules only | Not measured as its own arm. |
| `balanced` (default) | `auto` — the lift-carrying cut on Claude models without a measured null; `off` on Claude Sonnet 4.6 (measured null) and on non-Claude models | The core set as text: 2.9× ([post-repair](../benchmark.md#post-repair-weak)). On Claude the setting does not change what loads, so an install costs 7.8× (`agents/roadmaps/stubs/road-to-a-discipline-profile-that-loads.md`) <!-- claim:essential-tier-cost-factor --> |
| `full` | `full` — every rule tier; experimental, opt-in only | 7.1× as text ([post-repair](../benchmark.md#post-repair-weak)) |

Scope caveat, always printed with the table: every figure is from Claude Haiku
on two scope tasks, with rules pasted as text except the 7.8× install figure;
on Claude Sonnet the installed package showed no gain
([post-repair](../benchmark.md#post-repair))
and the non-Claude replication failed
([second host](../benchmark.md#p2-gate--non-claude-weak-host-gpt-5-mini-via-codex--replication-failed)).
<!-- claim:essential-tier-cost-factor -->

## Questions newcomers ask

1. **What is it?** Skills, rules and slash-command workflows installed into
   the AI coding tools you already use. Your tool still runs the agent; the
   package changes what the agent is told to do.
2. **Which tools?** 23 are detected; 20 get a written configuration; Aider,
   Zed and JetBrains are export-only. <!-- claim:host-agent-count --> The
   per-tool list is the README `## Supported tools` table.
3. **How do I install it?** `npx -y @event4u/agent-config init`. On a desktop
   it opens a browser wizard; with `--yes`, `--tools=<ids>` or in CI it
   installs without one. `install` is the same wizard under another name
   (ruling 0.6).
4. **Where does it write?** The install-scope sentence above, verbatim.
5. **Does it cost more tokens?** Yes. On Claude Haiku the install costs 7.8×
   a run with no rules on two scope tasks; the core rules alone cost 2.9×. <!-- claim:essential-tier-cost-factor --> Table and
   caveat: § What does it cost?
6. **Does it make my model smarter?** No. After the 2026-11 scorer repair,
   only the core rule set gave Claude Haiku a significant discipline gain; the
   full install did not reach significance, and Claude Sonnet showed none.
   <!-- claim:discipline-lift-weak-host -->
7. **Is it enforced or just prompts?** Blocking on Claude Code only; on every
   other tool the rules are instructions the model is asked to follow.
   <!-- claim:conformance-advisory-vs-blocking -->
8. **How do I remove it?** `agent-config uninstall --global`. It removes only
   its own entries and leaves other tools' config byte-identical.
   <!-- claim:surgical-uninstall --> `--purge` also deletes the files it
   recorded writing, and nothing else.
   <!-- claim:uninstall-purge-inventory-bounded -->
9. **What does it send over the network?** A daily update check against the
   npm registry (on by default; off in CI, without a terminal, or with
   `AGENT_CONFIG_NO_UPDATE_CHECK=1`). Telemetry is off unless an org pack
   configures it ([`SECURITY.md`](../../SECURITY.md)). Features that call other
   services — a second-opinion review by other AI models, dependency advisory
   lookups — run only when you invoke or configure them.
10. **I am not a developer — is it for me?** Five of the six role profiles —
    founder, content creator, agency, finance, ops — are not engineering roles;
    each installs a focused set ([`docs/profiles.md`](../profiles.md)). Setup is
    a browser wizard, but you still start it from a terminal.
