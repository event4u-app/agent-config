# Docs-that-sell rulings (Phase 0, 2026-11)

> Recorded 2026-11-01 as the Phase 0 decision note of the `road-to-docs-that-sell`
> roadmap (referenced by slug only, per `no-roadmap-references`). Seven rulings,
> 0.2 to 0.8, that every later phase of that plan copies rather than re-decides.
> Ruling 0.1 (re-render `info-image.png` without numbers, mock code or advice
> text; embed it as the "how it fits together" visual, never as the hero) was
> taken by the owner on 2026-11-01 and is recorded in the roadmap itself.
>
> Every fact below was re-derived from the tree on 2026-11-01 at branch
> `roadmap/docs-that-sell-20261101`; line numbers are as of that day. No fact
> is taken from roadmap prose.

## How to read a ruling

Each section carries: the question, the facts with `file:line` evidence, the
options, the ruling, who ruled, and a `revisit-if`.

**Who ruled** uses three labels and nothing else:

- **Owner** — the owner decided.
- **Conservative default, pending owner** — an owner-reserved question the
  owner was not asked mid-run; the most reversible option was applied under the
  `/roadmap:process-full` grant and stays open for the owner to overturn.
- **Host verdict on council input** — a council-decidable question; the AI
  council ran once on a neutral bundle (prompt reproduced at the end) and the
  host agent ruled on its findings. Where the host decided without council
  input, the section says so.

---

## 0.2 — `info-banner.png`

**Question.** The banner is the hero image on README, landing page and
Introduction. Does it carry false statements, and if so is it re-rendered or
kept with a caption that states the truth?

**Facts.**

- The banner was viewed on 2026-11-01 (`.github/assets/info-banner.png`). Its
  body text reads, verbatim: "Plan, build, review, and evolve software with
  graphs, memory, skills, and councils. Built for **Claude, Codex** & local
  agents. Stored in your repo." Both suspected lines are present.
- "Stored in your repo" contradicts ADR-020 Decision
  (`docs/decisions/ADR-020-global-only-consumer-scope.md:56-64`): consumer
  installs write distributed content only under the user's home directory;
  the 2026-07-13 amendment narrows the single project-local surface to
  `agents/overrides/` (same file, `:158`). The installer refuses project scope for consumers
  (`src/scripts/install.ts:1826-1834`, `_enforce_consumer_global_only`).
- "Built for Claude, Codex & local agents" understates coverage: the backed
  claim `host-agent-count` (`docs/CLAIMS.md:486-491`, status `backed`, evidence
  `exec:vitest run tests/install/toolDetection.test.ts -> 0`) states that 20
  host tools receive a written configuration surface and 3 more are
  export-only.
- README already embeds the banner as line 1 (`README.md:1`) without a caption.

**Options.** (a) Re-render the banner without the two lines. (b) Keep it as the
hero and give every embed a one-line caption stating the truth.

**Ruling — (b), conservative default applied under the `/roadmap:process-full`
grant, pending owner; reversible.** The banner stays the hero. Every embed
(README, landing page, Introduction, Open Graph derivative) carries this
caption directly below it, byte-identical, with the claim marker:

> Installs once into your user-level AI tool configuration, not into your
> repository, and works with 20 AI coding tools<!-- claim:host-agent-count -->
> — not only Claude and Codex.

Amended 2026-11-01: the first wording said "writes configuration for 20 AI
coding tools". `init` writes configuration for the 18 projection hosts only;
Copilot gets a discovery plugin and Claude Desktop a bundle the user uploads,
so "works with" is the true verb for the count of 20.

A re-render (option a) supersedes the caption without any other change; the
caption is removed in the same change that replaces the image.

**Who ruled.** Conservative default, pending owner.

**revisit-if.** The owner chooses a re-render; or the `host-agent-count` claim
changes its figure or status (the caption number then follows the claim, never
the other way round); or ADR-020 is superseded.

---

## 0.3 — The one-liner

**Question.** Which H1 tail becomes byte-identical in the README H1, the
`package.json` description and the `.github/about.yml` description?

**Facts.**

- Current H1: `# Agent Config — every claim machine-checked, including the
  artifact counts in these badges` (`README.md:3`). The tail after the dash is
  the canonical anchor `lint_positioning` extracts
  (`src/scripts/lint_positioning.ts:60-62`) and requires, case-insensitively,
  inside both descriptions (`src/scripts/lint_positioning.ts:200-206`); each
  description is capped at 200 characters (`:38`, `:207-212`).
- Current descriptions: `package.json:5` and `.github/about.yml:13` both carry
  the current tail.
- Words limited to three hits in the first 120 README lines:
  `src/scripts/lint_readme_jargon.ts:29-41` (kernel, contract, iron law,
  projection, manifest, lint, ADR, soak, drift, gate, harness).
- Stock phrases rejected by `src/scripts/readme_linter.ts:75-86`.
- README prose uses no serial comma (`src/scripts/lint_readme_serial_comma.ts:6`).
- Turn-end blocking exists on Claude Code only; elsewhere the rules are
  advisory. The recorded measurement is the `conformance-advisory-vs-blocking`
  claim cited at `README.md:163`.

**Options.** The five candidates in the roadmap's Appendix A, the current tail,
or a variant within the constraints.

**Council input (2026-11-01, anthropic/claude-sonnet-4-5 and
openai/codex-default, quorum 2/2).** Neither member picked a candidate. Both
converged that the tail must be bounded to what the evidence supports and must
respect the blocking-versus-advisory split: one member flagged that candidate 1
("make your AI coding agents check …") implies reliable checking while advisory
hosts may ignore the rules, that candidate 4 ("keep … honest") sits badly with
the null result on a stronger model, that candidate 2's "test properly" has no
mapped proof, and that candidate 5 names three tools of 20. Both asked that
every candidate be checked against the stated constraints before choosing.

**Constraint check (host, 2026-11-01).** The ruled tail has 68 characters,
contains none of the watchlist words, none of the stock phrases and no comma.

**Ruling.** The tail is:

> teach your AI coding agents to check their work before they say done

It keeps candidate 1's subject (the shared pain, matched by the strongest
backed proof point, the `wedge-hollow-detection` claim) and replaces "make"
with "teach", which states an instruction the agent receives rather than an
outcome the package guarantees — true on blocking and advisory hosts alike.
The resulting H1 is `# Agent Config — teach your AI coding agents to check
their work before they say done`.

Input for step 7.6, not binding on its wording beyond the tail: a description
that fits both files is `Agent Config — teach your AI coding agents to check
their work before they say done. Skills, rules and commands for Claude Code,
Cursor, Copilot, Codex and more AI coding tools.` (177 characters, no number,
so no claim marker is needed in files that cannot carry one).

**Retired tail.** `every claim machine-checked, including the artifact counts
in these badges` — retired from the H1 and both descriptions when step 7.2 and
7.6 land. The claims ledger itself is unaffected; only its role as the headline
ends.

**Who ruled.** Host verdict on council input.

**revisit-if.** A measured activation or search result shows the tail failing
first-time visitors; or turn-end blocking becomes available on most written
hosts (then a stronger verb than "teach" is supportable); or
`lint_positioning` changes how the anchor is extracted.

---

## 0.4 — README order lock

**Question.** Keep the contract that the three audience headings precede
`## Quickstart`, or move Quickstart ahead?

**Facts.**

- `tests/contracts/readme_audience_order.test.ts:18-22` fixes the order "Use it
  in your project" → "Prove it" → "Contribute"; `:43-53` requires all three
  before `## Quickstart`; `:55-63` forbids council references between them.
- `docs/readme-split-plan.md:8-31` records the three audience anchors and the
  five anchors external links rely on (`#quickstart`, `#supported-tools`,
  `#what-your-agent-is-asked-to-do`, `#documentation`, `#development`).
- The install command already sits on the first screen: `## Try it in 30
  seconds` at `README.md:37` holds `npx -y @event4u/agent-config init`
  (`README.md:42`), ahead of the audience headings at `README.md:142`, `:153`,
  `:172` and Quickstart at `:184`. The lock therefore constrains where the
  Quickstart *heading* sits, not whether a newcomer sees the install command.

**Options.** (A) Keep the lock; the audience headings become short router
sections. (B) Move Quickstart ahead and change the test. (C) Another
arrangement.

**Council input (same run).** Both members found no evidence of a reader
failure that moving Quickstart would fix; one member stated that the existing
line-37 install section already defeats the argument that moving Quickstart is
needed to expose installation, and recommended changing the order test only if
the chosen structure requires it.

**Ruling — (A).** The lock stays and the test is not changed. The three
audience headings become router sections of one paragraph and one link each;
the first screen carries the install command through the earlier "Try it"
section as step 7.2 specifies. The five promised anchors stay resolvable. No
linter or test change ships with 7.2 on account of this ruling.

**Who ruled.** Host verdict on council input.

**revisit-if.** A newcomer walkthrough (step 11.1) or an independent read
(step 11.2) records that a reader missed the install path or the Quickstart
because of the order; or the README word budget of step 7.1 cannot be met with
router sections in place.

---

## 0.5 — Install-scope sentence

**Question.** One canonical sentence stating what is written globally, what
lands in a repository, and whether `init --project` is a user command.

**Facts.**

- ADR-020 Decision (`docs/decisions/ADR-020-global-only-consumer-scope.md:56-64`)
  and its amendments: distributed content (skills, rules, commands, hooks,
  adapters) is never written into a consumer repository; the only
  project-local agent surface is `agents/overrides/`, plus managed `.gitignore`
  entries; the project bridge marker was retired on 2026-07-13.
- ADR-293 decides the *form* of the rule layer, not its location: no settings
  key selects it and the consumer brake is `install --full`
  (`docs/decisions/ADR-293-the-package-decides-its-own-rule-layer-form.md:82-104`).
  It adds no project write and nothing for the sentence to state.
- `src/scripts/install.ts:1692-1717` marks every host `global` except Copilot
  (`both`); `:1796` sets the global root `~/.event4u/agent-config`; `:1826-1834`
  refuses `--scope=project` for consumers unless `AGENT_CONFIG_DEV_MODE=1`.
- What still lands in a repository on a consumer install: the `agents/overrides/`
  scaffold (`src/scripts/install.ts:3886-3905`), the managed `.gitignore` block
  (`:4843-4845`), the install-mode marker `agents/.agent-state/install-mode.txt`
  (`:3842-3852`), and gitignored pointer files for Windsurf, Cline and Gemini CLI
  only (`:2475-2479`, header text at `:2508-2516`).
- `init --project` is a working user command: `src/cli/main.ts:525-543` routes it
  to the `refresh --project` writer, which refreshes only the overrides scaffold
  and the `.gitignore` block and writes no distributed content
  (`src/scripts/_cli/cmd_refresh.ts:18-23`). It is not the maintainer-only
  project scope (`--scope=project`).
- The surfaces that contradict this today: `README.md:151` ("a repo with an
  `.agent-settings.yml` installs project-local"), `README.md:202` ("`--project`
  is maintainer-only"), `docs/installation.md:239` ("Project-installed mode
  (recommended for teams)").

**Ruling — the canonical sentence, copied verbatim by every later phase:**

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files; `agent-config init --project`
> creates just that folder in a repository and nothing else.

The sentence carries no number and no claim marker. "A few gitignored
bookkeeping files" is the user-facing name for the `.gitignore` block, the
install-mode marker and the three per-tool pointer files; installation
reference pages may list them, but may not restate the sentence.

**Who ruled.** Host verdict without council input (decided from the tree, as
the plan scoped).

**revisit-if.** ADR-020 is amended or superseded; the installer starts or stops
writing any file into a consumer repository; `init --project` is re-routed away
from the `refresh --project` writer.

---

## 0.6 — Entry-command story

**Question.** Which command do the docs teach first, and what do `install`,
`setup`, `first-run`, `global`, `refresh` and `config` become in user copy?
Step 4.1 implements the help grouping from this list.

**Facts.**

- `init` (`src/cli/registry.ts:23`): opens the browser install wizard when a
  display is usable (`src/cli/main.ts:545-550`, wizard mode `install`, step 0,
  `src/cli/initRouting.ts:136-142`) and otherwise runs the same installer
  non-interactively. CI, `AGENT_CONFIG_NO_UI`, a non-TTY, or any of `--yes`,
  `--tools`, `--ai`, `--no-ui`, `--dry-run` select the non-interactive path
  (`src/cli/initRouting.ts:15-20`, `:99-107`). It is the only Tier-0 install
  command (`src/scripts/_dispatch.bash:51-54`).
- `install` (`src/cli/registry.ts:53`, `src/cli/main.ts:311-331`): opens the
  same install wizard (`wizardMode: 'install'`). **It is not a
  non-interactive installer**, so the plan's default reading
  ("non-interactive installer for CI/scripts") is contradicted by the code.
- `setup` (`src/cli/registry.ts:54`, `src/cli/main.ts:351-380`): opens the
  onboarding wizard on the Identity step (`wizardMode: 'setup'`).
- `config` (`src/cli/registry.ts:51`): opens the configuration GUI; `settings`
  is its alias (`src/scripts/_dispatch.bash:72`).
- `first-run` (`src/cli/registry.ts:109`, `src/scripts/_dispatch.bash:955-959`):
  guided first-run script; listed in Tier 1 (`src/scripts/_dispatch.bash:174`).
- `global` (`src/cli/registry.ts:32`, `src/scripts/_dispatch.bash:1470-1474`):
  the bash installer with `--global`; Tier 1 (`:127`). Since every consumer
  install is global (0.5), it duplicates `init --no-ui`.
- `refresh` (`src/cli/registry.ts:30`, `src/scripts/_cli/cmd_refresh.ts:15-23`):
  idempotent re-install with `--global`, or the project surface with
  `--project`; bare `refresh` errors. Tier 1 (`src/scripts/_dispatch.bash:121`).

**Ruling — fates, one per command:**

| Command | Fate in user copy | What user copy says | Help group (step 4.1) |
|---|---|---|---|
| `init` | **taught first** | The one install command. Opens the wizard on a desktop; with `--yes` or `--tools=<ids>` (or in CI) installs without it. | Get started |
| `install` | **alias** | "Same wizard as `init`." Never taught as the CI or non-interactive path; that path is `init --yes` / `init --tools=<ids>`. | Get started (alias line) |
| `setup` | **Configure** | Reopens the onboarding wizard to change identity, profile and tools after installing. | Configure |
| `config` (and `settings`) | **Configure** | Opens the settings screen; `settings` is listed as its alias. | Configure |
| `refresh` | **advanced (maintenance)** | Reference only: `refresh --global` re-applies the installed version; `refresh --project` recreates the repository folder of 0.5. | Maintain |
| `global` | **hidden from user copy** | Not mentioned outside the CLI reference; it duplicates `init --no-ui`. Stays callable. | `help --tier=all` only |
| `first-run` | **hidden from user copy** | Not mentioned outside the CLI reference; `setup` covers the guided path. Stays callable. | `help --tier=all` only |

"Hidden" means absent from default help and from every user page except the
generated CLI reference; no command is removed by this ruling.

**Who ruled.** Host verdict without council input, evidence-cited; it departs
from the plan's default reading only for `install`, because the code shows it
opens the wizard.

**revisit-if.** `install` gains a non-interactive mode or `init` loses one; a
command in the table is removed or renamed; the step 11.1 walkthrough shows a
newcomer reaching for `install` or `setup` before `init`.

---

## 0.7 — Canonical-page map for `docs/`

**Question.** For each of the ten duplicate clusters, one canonical page and a
fate for every other member.

**Facts.**

- Generated files, never hand-edited (writer in brackets): `llms.txt` and
  `docs/skills-catalog.md` (`src/scripts/generate_catalog.ts:3`),
  `docs/catalog.md` (`src/scripts/generate_index.ts:3`, `:47`),
  `docs/proof.md` (`src/scripts/build_proof.ts`), `docs/benchmark.md`
  (`src/scripts/render_benchmark_md.ts`, `render_benchmark_composite.ts`),
  `docs/value.md` (`src/scripts/render_value_md.ts`),
  `docs/capability-matrix.md` (`src/scripts/generate_capability_matrix.ts`),
  `docs/command-flows.md` (`src/scripts/generate_command_flows.ts`),
  `docs/cookbook.md` (`src/scripts/generate_cookbook.ts`),
  `docs/role-experiences.md` (`src/scripts/generate_role_experiences_catalog.ts`),
  `docs/settings-reference.md` (`src/scripts/generate_settings_reference.ts`).
  `docs/end-to-end-walkthroughs.md` is hand-written; it cites generated golden
  transcripts (`docs/end-to-end-walkthroughs.md:4-8`).
- Paths read by checks, so a move updates the check in the same change (step
  1.5 inventory): `docs/SKILL_CENSUS.md` (`check_routing_coverage.ts`),
  `docs/featured-skills.md` (`lint_featured_skills.ts`, `update_counts.ts`,
  `check_supervision_claim_atomicity.ts`), `docs/featured-commands.md` and
  `docs/governance-advantage.md` (`check_artefact_count_messaging.ts`,
  `update_counts.ts`), `docs/governance.md` (`build_discovery_manifest.ts`),
  `docs/mcp-server.md` (`check_mcp_doc_drift.ts`), `docs/CLAIMS.md`
  (several), root `MIGRATION.md` (`lint_scheduled_deprecations.ts` and the npm
  `files` list, `package.json:39-60`).
- `docs/skills-taxonomy.md:3` still states "227 skills" against the badge count
  of 301 (`README.md:8`).
- `docs/migration/` holds internal TS-migration records (`node-floor.md:2`,
  `yaml-roundtrip-spike.md:2`, `consumer-template-consumption-model.md:2` each
  open as a roadmap step record; `divergences/` is a per-script ledger) next to
  one consumer guide (`v1-to-v2.md`).

**Council input (same run).** Both members cautioned that a shared subject does
not prove duplication, proposed that a canonical *entry* page may route to
several authoritative task pages instead of absorbing them, asked that every
consumer (anchors, checks, npm `files`) be inventoried before a move, and that
the installation-scope contradiction be resolved before `installation.md`
becomes a merge target.

**Ruling — hub model.** Each cluster has one canonical entry page; task pages
with a distinct reader question stay and are linked from it; only true
overlaps merge (into a one-paragraph pointer stub so inbound links survive);
internal records leave the user path. A "merge" below is executed in Phase 8
only after a side-by-side content check confirms the overlap; if the check
finds distinct content, the fate falls back to "keep, linked from the hub".

| # | Cluster | Canonical (entry) | Other members → fate |
|---|---|---|---|
| 1 | Getting started | `docs/getting-started.md` | `installation.md` → keep as install reference (scope fixed to 0.5 in step 2.2 first) · `wizard.md` → keep, linked from Install · `getting-started-laravel.md` → keep, linked · `getting-started-local-stdio.md` → keep, linked (MCP task page) · `getting-started-by-role.md` → merge into `profiles.md`, pointer stub |
| 2 | Profiles | `docs/profiles.md` | `getting-started-by-role.md` → merge, pointer stub (as above) · `role-experiences.md` → keep generated, linked |
| 3 | Flows | `docs/flows.md` | `command-flows.md` → keep generated · `cookbook.md` → keep generated · `end-to-end-walkthroughs.md` → keep, linked as depth · `showcase.md` → keep, linked from the proof hub (cluster 7) |
| 4 | Catalogs | `docs/catalog.md` (generated) | `skills-catalog.md` → keep generated · `capability-matrix.md` → keep generated · `llms.txt` → keep generated · `featured-skills.md`, `featured-commands.md` → keep, linked as "start here" lists (checks read them) · `skills-taxonomy.md` → move to maintainers (stale count, hand-maintained; a generator-owned taxonomy is a discovery item, not approved here) |
| 5 | Benchmark | `docs/benchmark.md` (generated; step 6.7 adds a hand-written explainer above it on the site) | `value.md` → keep generated, linked · `benchmarks.md` (cadence policy) → move to maintainers · `benchmark.pinned.yml` → keep (data) |
| 6 | MCP | `docs/mcp-server.md` | `mcp.md` (repo `mcp.json` generation) → keep, linked as a separate task · `mcp-client-compat.md` → keep, linked · `setup/mcp-client-config.md`, `setup/mcp-cloud-setup.md`, `setup/mcp-cloud-endpoints.md`, `setup/mcp-server-docker.md` → keep, linked · `mcp-registries.md` → keep, linked as reference · `setup/mcp-r2-bootstrap.md`, `setup/mcp-cloud-registry-listing.md` → move to maintainers (operator and submission material) |
| 7 | Proof | `docs/proof.md` (generated) | `evaluator.md` → keep, linked · `CLAIMS.md` → keep (ledger, read by checks) · `known-weaknesses.md` → keep, linked · `us-vs-the-category.md` → keep, linked (after step 2.4) · `showcase.md` → keep, linked · `positioning-evidence.md` → move to maintainers (decision record) |
| 8 | Migration | `docs/MIGRATION.md` | root `MIGRATION.md` → keep as is (shipped in npm `files`, read by checks; already a pointer for 9.8+; final form in step 8.3) · `BREAKING_CHANGES.md` → keep, linked · `migration/v1-to-v2.md` → keep, linked · `migrations/commands-1.15.0.md` → merge into `docs/MIGRATION.md`, pointer stub · `migration/node-floor.md`, `migration/yaml-roundtrip-spike.md`, `migration/consumer-template-consumption-model.md`, `migration/divergences/` → move to maintainers |
| 9 | Censuses | none — the cluster leaves the user path | `SKILL_CENSUS.md`, `artefact-census.md`, `skill-duplication-findings.md`, `command-naming-audit.md`, `install-friction-report.md` → move to maintainers (each move updates its check, e.g. `check_routing_coverage.ts`) |
| 10 | Governance | `docs/safety.md` (the user-facing data-governance page) | `governance.md` → move to maintainers (internal ownership process; update `build_discovery_manifest.ts`) · `quality.md` → move to maintainers (contributor CI) · `self-review-gate.md` → move to maintainers · `anti-reskin-gate.md` → keep, linked (written for people who run a skills repository) · `governance-advantage.md` → keep as is, linked only from the proof hub (public positioning page read by `check_supervision_claim_atomicity.ts` and `update_counts.ts`) |

**Who ruled.** Host verdict on council input.

**revisit-if.** A Phase 8 content check finds that a "merge" pair carries
distinct content (that pair falls back to "keep, linked"); a generator changes
which file it writes; a check gains or loses a hard-coded path from this table;
the docs site sidebar of step 6.3 cannot place a canonical page.

---

## 0.8 — Feature entry points versus the reach freeze

**Question.** May the Review and Security feature pages link the per-skill
Claude.ai ZIPs for `code-review` and `security-audit` as named entry points, or
do the ZIPs stay in the installation reference only?

**Facts.**

- `./scripts-run src/scripts/adr_cite_check ADR-133` (2026-11-01): status
  accepted, trigger state **indeterminate** — "LIVE, TRIGGER INDETERMINATE —
  the reopen condition is semantic and this tool cannot decide it. Not an
  unqualified lock."
- `./scripts-run src/scripts/adr_cite_check ADR-134` (2026-11-01, unpinned
  wall-clock run): status accepted, trigger state **fired** — its expiry of
  2026-09-15 has passed with neither a posting nor a superseding deferral; "The
  record still binds until someone acts on it." The lapse is an open compliance
  finding for the owner, not a release of the freeze.
- Feature pages on the docs site are allowed by the plan (step 6.6); the open
  point is only the named ZIP links.

**Options.** (a) Link the ZIPs from the Review and Security pages. (b) Keep the
ZIPs in the installation reference only, with no named entry-point links.

**Ruling — (b), conservative default applied under the `/roadmap:process-full`
grant, pending owner; reversible.** Feature pages are written; they do not link
per-skill ZIPs as entry points. The ZIPs stay listed in the installation
reference only. Step 10.2 runs its cloud-compatibility audit but ends at "the
installation reference keeps them" until the owner rules otherwise. ADR-133 is
cited as live with an indeterminate trigger and ADR-134 as live with a fired
trigger, never as an unqualified lock.

**Who ruled.** Conservative default, pending owner.

**revisit-if.** The owner rules on the ADR-134 lapse (a posting or a superseding
deferral); ADR-133's unblock conditions are re-evaluated as met; the owner
chooses option (a).

---

## Council prompt (verbatim, as sent on 2026-11-01)

One run, `prompt` input mode, `analysis` prompt mode, members
anthropic/claude-sonnet-4-5 and openai/codex-default, quorum 2/2 concluded.
Both seats were subscription-authenticated: estimated and billed cost $0.00.
The prompt below is the complete question bundle; nothing else was sent.

~~~markdown
# Three documentation decisions for an npm package

Context: `@event4u/agent-config` is an npm package that installs skills, rules,
slash commands and hooks into the user-level configuration of AI coding tools
(Claude Code, Cursor, Copilot, Windsurf, Cline, Gemini CLI, Codex and others).
Its README, GitHub "about" text and npm description are being rewritten for
first-time visitors who decide within one screen whether to read on. Every
public claim in this repository must be backed by a recorded, checkable entry;
unmeasured numbers are not allowed on public surfaces.

Answer each question independently. For each, state your choice, the main
reason, the strongest argument against your choice, and one condition under
which the choice should be revisited.

## Q1 — The one-line tagline

The README H1 has the form `# Agent Config — <tail>`. The tail must also appear
byte-identical inside the npm `package.json` description and the GitHub
`.github/about.yml` description. Hard constraints checked by tooling: the
description is at most 200 characters; README prose uses no serial (Oxford)
comma; the first 120 README lines may contain at most three hits of these
words: kernel, contract, iron law, projection, manifest, lint, ADR, soak,
drift, gate, harness; the README may not contain stock phrases such as
"cutting-edge", "next-gen", "seamless integration", "blazing fast".

Facts relevant to wording:
- On Claude Code, hooks can block the agent from ending a turn without
  evidence; on the other hosts the same rules are advisory text the model may
  ignore. One recorded session measured advisory injection reducing one
  violation class strongly but not to zero, while blocking guards reached zero.
- The strongest recorded proof point: a validator subagent answers NOT READY
  with file and line when the agent claims "done" on a stub implementation.
- 20 host tools receive a written configuration; 3 more are export-only.
- A benchmark measured a discipline lift on a weaker model and a null result
  on a stronger model; the package does not make a model smarter.

Current tail (to be retired or kept):
"every claim machine-checked, including the artifact counts in these badges"

Candidate tails (you may also propose your own within the constraints):
1. make your AI coding agents check their work before they say done
2. AI coding agents that plan first, test properly and verify before they finish
3. your engineering habits installed into every AI coding tool you use
4. skills, rules and workflows that keep AI coding agents honest in any tool
5. one install that teaches Claude Code, Cursor and Copilot to plan, test and verify

Question: which tail should the H1, npm description and GitHub description
share?

## Q2 — README section order

A contract test currently enforces that three `##` audience headings appear in
the order "Use it in your project" → "Prove it" → "Contribute", all before the
`## Quickstart` heading. A planning document promises that the anchors
`#quickstart`, `#supported-tools`, `#what-your-agent-is-asked-to-do`,
`#documentation` and `#development` keep resolving because external sites link
to them. The current README already has a `## Try it in 30 seconds` section
containing the one-command install, placed before all three audience headings
(line 37 of 576); the audience headings sit at lines 142, 153, 172 and
Quickstart at 184. The rewrite targets a README of at most about 4,400 words,
with a first screen of banner, H1, one badge row, one value sentence, the
install command and one line saying what happens next.

Options:
A. Keep the lock: audience headings stay as short router sections (a paragraph
   and a link each) before Quickstart; the install command stays on the first
   screen via the earlier "Try it" section.
B. Move Quickstart ahead of the audience headings; change the contract test
   accordingly while keeping the `#quickstart` anchor.
C. Another arrangement you specify.

Question: which option, and should the contract test change?

## Q3 — One canonical page per duplicate cluster in `docs/`

The `docs/` directory has about 93 top-level files. Ten groups cover the same
subject several times. Files marked (generated) are written by a script and
are never hand-edited; they can only be kept, linked or have their generator
changed. A "pointer stub" is a one-paragraph file that links to the canonical
page so inbound links survive. "Maintainers" means moving under
`docs/maintainers/`, which is outside the user reading path.

1. Getting started: getting-started.md, getting-started-by-role.md,
   getting-started-laravel.md, getting-started-local-stdio.md,
   installation.md (about 1,070 lines, contradicts itself on install scope),
   wizard.md
2. Profiles: profiles.md ("Six entry paths — by profile.id"),
   role-experiences.md (generated), getting-started-by-role.md
3. Flows: flows.md (journey definitions), command-flows.md (generated),
   cookbook.md (generated), end-to-end-walkthroughs.md (hand-written, cites
   generated transcripts), showcase.md (behaviour demos)
4. Catalogs: catalog.md (generated), skills-catalog.md (generated),
   capability-matrix.md (generated), skills-taxonomy.md (hand-written, cites a
   stale skill count), featured-skills.md, featured-commands.md, llms.txt at
   the repository root (generated)
5. Benchmark: benchmark.md (generated), benchmarks.md (benchmark cadence
   policy), value.md (generated cost/value dashboard)
6. MCP: mcp.md (repo-level mcp.json generation), mcp-server.md (the package's
   own read-only MCP server), mcp-registries.md, mcp-client-compat.md,
   setup/mcp-*.md (six setup pages)
7. Proof: proof.md (generated), evaluator.md ("re-run every claim yourself"),
   positioning-evidence.md, us-vs-the-category.md, known-weaknesses.md,
   CLAIMS.md (the claims ledger, read by tooling)
8. Migration: MIGRATION.md at the repository root (covers up to version 9.8,
   shipped in the npm package), docs/MIGRATION.md (later versions),
   docs/migration/ (five files), docs/migrations/ (one file),
   BREAKING_CHANGES.md at the root
9. Censuses: SKILL_CENSUS.md, artefact-census.md,
   skill-duplication-findings.md, command-naming-audit.md,
   install-friction-report.md
10. Governance: governance.md (internal ownership process), governance-advantage.md
    (positioning essay), safety.md, quality.md, self-review-gate.md,
    anti-reskin-gate.md

Several of these paths are read by build checks, so a move must update the
check in the same change.

Question: for each group, which file is the canonical user page (or "none —
the group belongs outside the user path"), and what is the fate of every other
member: merge into canonical and leave a pointer stub, move to maintainers,
keep as generated, or keep as is?
~~~

Two corrections were made to the bundle before it was sent and are reflected
above: the MCP setup page count (six, not seven) and the `installation.md`
length (about 1,070 lines). The members' answers were not committed in full:
the council response store is gitignored and pruned by retention, so the
convergent findings that informed each ruling are summarised in the "Council
input" paragraph of 0.3, 0.4 and 0.7, attributed to both members unless a
single member is named.
