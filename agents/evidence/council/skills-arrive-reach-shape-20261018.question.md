<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# Three routing and design questions on one roadmap

Repository: `event4u/agent-config`, a governed skill/rule/command suite installed into AI coding hosts (Claude Code, Codex CLI, Cursor, ...). An autonomous drain lane is executing the roadmap `road-to-skills-that-arrive-when-called` under an owner delegation (ADR-237) that covers everything machine-executable for delivering a pull request. The owner merges nothing in this lane; an orchestrator merges after CI is green.

Routing test you must apply: a transition is **owner-reserved** if it changes the project's purpose, lowers a safety/privacy floor, is irreversible, spends above a delegated threshold, creates/removes/weakens a public or compatibility commitment, amends governance, or cannot be bounded from evidence. Otherwise it is **council-decidable**. Answer each question separately. For each: a verdict (DECIDE with your answer, or ESCALATE with the reason), and one paragraph of reasoning.

## Question 1 — Is step 6.3 council-decidable, or owner-reserved?

Step text (accepted roadmap, status `ready`):

> **6.3 Close the declared-dependency hole the default projection opens.** 28 `skills:` declarations name a skill that exists in the package and that the default projection prunes — `/implement-ticket` alone declares `refine-ticket` and `feature-planning`. Add an offline test asserting zero declared-but-pruned. Then make the installer's scoped prune keep every skill a surviving artefact declares. Additive only: delivery grows, never shrinks.

Measured today: 28 edges, 13 distinct skills (voice-and-tone-design, estimate-ticket, feature-planning, image-analyser, image-creator, character-consistency, refine-ticket, scene-expander, video-director, pixar-storyteller, motion-choreographer, song-to-script, prompt-validator). The declaring artefacts are commands that survive the prune because they carry no `packs:` tag (e.g. `/video:from-script`, `/implement-ticket`, `/image:create`). So a default install today ships commands whose declared skills are absent. The fix would grow the default install from 229 to about 242 of 300 skills.

Relevant public statements and open questions:

- `README.md:59`: "Pack-scoped install — writes the active pack only".
- `docs/CLAIMS.md` publishes the default-install count (currently 229 of 300), regenerated mechanically from the same predicate the installer uses.
- An open owner-reserved blocker `which-completeness-skills-owe` asks the owner to choose (a) presence: every skill installed everywhere, (b) reach: every skill reachable in one deterministic step, presence per host, or (c) today's pack-scoped install recorded as the promise. The blocker lists as blocked only step 4.6 (materialise-on-demand on the first host) and a sibling roadmap's removal of `projection.mode`. It does NOT list 6.3.
- A previous lane left 6.3 open, reasoning "the fix changes what a default install delivers (owner-reserved)".
- The roadmap's risk register offers an alternative lever: prune the declaring COMMAND instead of keeping its skill (23 of 28 edges sit in one pack).

Sub-question if you DECIDE: keep the declared skills (grow), or prune the declaring commands (shrink), or keep skills only for `skills:` (not `requires_skills:`)?

## Question 2 — Bucket definitions for a `doctor` reach report (steps 2.2 and 2.3)

Step text:

> **2.2 Declare reach.** `doctor` prints installed / described / name-only / reachable-not-installed / degraded counts; they sum to the authored count.
> **2.3 Degraded is never called reach.** A skill reachable only through a text read that drops declared properties is counted `degraded`, never `reachable`. verify: fixture skill with a command and a flow read through MCP is counted `degraded`.

Facts:

- 300 authored skills; a default Claude Code install writes 229. The host lists installed skills within a character budget; the package writes a listing override so 45 keep descriptions and 184 are listed name-only (modelled, `report_skill_host_census`).
- Not-installed skills are reachable from a shell search path (`agent-config route:explain --skills`), which ranks the package projection and labels them `not-installed`; the agent then reads the projected SKILL.md file as text, frontmatter included. Through that read the host does not apply host-honoured keys (`allowed-tools`, `model`, `context`, `agent`, `disable-model-invocation`, ...).
- Through the MCP server read path, 4 of 38 declared properties are carried; every skill declares at least one dropped property, so every skill read via MCP alone is degraded by that census.
- `doctor` (`cmd_doctor.ts`) is 3,560 lines under a ratchet that forbids any source file above 1,500 lines from growing; new logic must live in a new module and the doctor file must stay net-zero lines.
- A host key list exists: `src/config/host-skill-frontmatter-keys.json` (20 Claude Code keys, 6 Agent Skills spec keys, a passthrough list).

Proposed partition, five mutually exclusive buckets per host, summing to authored:
1. `described` — installed, listed with description.
2. `name-only` — installed, listed by name only.
3. `omitted` — installed, dropped by the host's listing budget (modelled).
4. `reachable-not-installed` — not installed, found by the shell search path, and declares no host-honoured key a text read cannot apply.
5. `degraded` — not installed, and either declares a host-honoured key or is reachable only through MCP.
`installed` is printed as the subtotal of 1–3, not as a sixth bucket.

Is this partition correct? If not, give the one you would ship. Also: is it acceptable to ship it as a new `doctor` section (additive output), or does it need its own subcommand?

## Question 3 — The classification criterion for step 3.1

Step text:

> **3.1 Classify by output shape.** Per skill: *report* (runs, returns a result, needs no later turn) vs *standing* (guidance for the rest of the task). Only report skills are fork candidates. verify: deterministic classification, every skill in exactly one class; the six D2 skills classified first.

The six D2 skills: deep-reading-analyst, project-analysis-hypothesis-driven, project-analyzer, project-analysis-core, repomix-packer, universal-project-analysis. Every one of the 301 skills has an `## Output` section; 54 declare an `execution:` block (30 `assisted`, 24 `manual`). There is no existing field that states output shape. Step 3.2 (later) pilots `context: fork` on at most five report skills on the first host only.

Options the lane sees:
- (A) A committed data file listing each skill's class, authored once, with a lint that every skill appears exactly once; deterministic because it is data.
- (B) A new frontmatter key `output_shape: report | standing` on every skill; costs the skill byte budgets and touches 300 files.
- (C) A heuristic over the `## Output` section (names a file or verdict as its terminal product) with a pinned override list.
- (D) Classify only the D2 six plus enough candidates for 3.2, mark everything else `standing` by default (fork-safe default), and record it as data.

Which do you choose, and what is the default class for a skill nobody classified?
