---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
depends: [road-to-a-hook-carrier-that-is-never-silent]
estate_offset_exempt: "Round inbox-2026-10-n asks whether the package can install a minimal skill set, bring others in per need and drop them again. Verified at d760ecbde: a default install writes 229 of 300 authored skills, the package's own metadata occupies the host's reserved `context` key on 6 skills so no skill can run forked, and Codex CLI receives no native skills. road-to-skill-menu-economy owns only the listing axis and is parked on a condition this file does not meet; un-parking it to carry a lifecycle it never owned would re-open its four parked conditions, and no other file owns this axis."
estate_growth_exempt: "+2 open_blockers: `which-completeness-skills-owe`, a product question the round raises against the public statement that an install writes the active pack only, and `listing-override-write-is-owner-owned`, the fourth arrival of the question road-to-skill-menu-economy already poses. Neither closes a box or changes behaviour."
relates:
  - slug: road-to-a-search-answer-a-model-can-choose-from
    relation: extends
    note: "Archived, every step closed (was Active). Owns the search answer and the shell search path that falls back to the installed payload (its 2.1), and observes the host's listing override (its 0.1). Phase 2 here reads both; nothing here re-plans them."
  - slug: road-to-a-hook-carrier-that-is-never-silent
    relation: depends
    note: "Added in the same change. Phase 4 sources materialised skills from its staged payload (1.1), never from a package-manager cache."
  - slug: road-to-skill-menu-economy
    relation: extends
    note: "Later. Owns the listing axis and the posed owner question on the host's listing override; this file adds the lifecycle axis — when a skill is present, how long it stays, whether its body leaves residue — and step 4.7 carried the owner's answer to that question, option (a), on 2026-10-14."
  - slug: road-to-a-setup-that-decides-itself
    relation: extends
    note: "Added in the same change. Its step 4.7 removes `projection.mode` only after this file's completeness blocker is answered."
  - slug: road-to-skill-tiering-live-arm
    relation: extends
    note: "Stub. Step 6.1 records on it that the host now documents hot pickup and a name-only listing state."
---
# Road to skills that arrive when called

> **Source:** `agents/tmp.old/inbox-2026-10-n/` — a round of five supplied plans
> and one transcript. The owner asked whether the package can install a minimal
> set, bring any other skill in when needed and drop it afterwards — or keep
> skills per session so every new session starts minimal. Verified against
> `main` @ `d760ecbde` on 2026-10-12.

## Goal

Every skill the package authors is reachable in the session that needs it, with
the semantics its frontmatter declares; a skill whose job ends in a report can
run without leaving its body in the main conversation; and on every host with
native skills the standing listing is a resident set, not the whole catalogue —
with presence on disk decided per host by what that host actually does.

The owner's question splits three ways against the host contracts, and each part
gets its own answer:

1. **"Every new session starts minimal"** is already the host's behaviour for
   skill bodies: a body enters the conversation only on invocation and is not
   carried into a new session. What crosses sessions is the listing and the rules;
   the rules are `road-to-a-setup-that-decides-itself`.
2. **"Drop it when the task is done"** cannot be had by deleting a file: the host
   keeps an invoked body until compaction, and a deleted file only leaves the
   listing. The mechanism that leaves no residue is forked execution, blocked today
   by D2.
3. **"Install it when it is needed"** pays off where a host drops skills it cannot
   fit, and where a skill is not installed at all (D1, D4).

## Context

Verified 2026-10-12 at `d760ecbde`:

- A `--global --ai claude-code` install into an empty `HOME` writes **244**
  entries under `~/.claude/skills` — 229 of the 300 authored skills plus 15
  command wrappers; the public surface says
  an install "writes the active pack only" (`README.md:59`).
- Skill invocation here is deterministic, not model-guessed: ADR-263 records
  skills as explicitly invoked reference material, and the activation census
  counted zero model invocations over 30 sessions
  (`agents/evidence/metrics/skill-activation-census.json`). Entry points are
  commands, flows, search and an explicit name.
- `src/scripts/_lib/skill_catalogue.ts:88`, `:98`, `:150-157` reads the authored
  tree, the project projection and `~/.claude/skills`. The `missing-skill-recovery`
  rule names only the MCP search tool and otherwise says to proceed without a
  skill (`src/rules/missing-skill-recovery.md:51-73`); the MCP read path carries 4
  of 38 declared properties (`agents/evidence/analysis/semantic-parity-census.md`).
- `src/scripts/_lib/session_register.ts` keeps one record per session with an
  in-record heartbeat and TTL, pruned during the `session_start` read — a lease
  needs a second root, not new machinery.

The defects:

- **D1 — Skills outside the install are reachable only as degraded text, or not
  at all.** 71 authored skills are not installed; without the MCP server they do
  not exist for `missing-skill-recovery`.
- **D2 — Package metadata sits on a host-reserved key.** `context` is a package
  enum with the single value `large`, "metadata only"
  (`src/scripts/schemas/skill.schema.json:220-225`), written by
  `src/scripts/backfill_model_tier.ts:156`, carried by 6 skills —
  deep-reading-analyst, project-analysis-hypothesis-driven, project-analyzer,
  project-analysis-core, repomix-packer, universal-project-analysis — and
  projected verbatim. The host defines `context: fork`. 0 of 300 skills declare
  `fork` or `agent:`.
- **D3 — One host with native skills receives none, and that host drops what does
  not fit.** `src/scripts/_lib/tool_adapter_registry.ts:55` gives Codex CLI
  `agents-md` with no roots; `README.md:349` shows "—" for its skills. That host
  scans `.agents/skills`, lists skills within a budget, shortens descriptions and
  then omits skills with a warning. The full listing of all 300 is about 59,000
  characters.
- **D4 — Long bodies lose their tail after compaction.** The first host
  re-attaches the first 5,000 tokens of each invoked skill, 25,000 in total. Six
  SKILL.md files are ≥ 20,193 characters (four by body alone), and their ceilings
  in `src/config/skill-body-budget.json` (20,372–24,902) permit that size.
- **D5 — No ruling on which completeness skills owe.** ADR-267 states
  completeness for rules; for skills the public surface says the active pack only.
  The supplied plans cite an owner directive of 2026-08-30 against a silent subset;
  no record of it exists in `agents/` or `docs/`.

## Phase 0 — Probe the host contracts before building on them

Every row is recorded in the shape of `src/config/host-injection-effect.json`
(host, version, transcript pointer, date, state) with an expiry; `observed-true`
needs a transcript.

- [x] **0.1 Skill census.** Per host and install path: entries installed,
  listing characters with descriptions and names-only, omitted set. One
  deterministic report.
  Done 2026-10-17: `./scripts-run src/scripts/report_skill_host_census` prints
  one row per host whose global deploy writes `dist/agent-src/skills` (15) and
  per install path (`default` = the installer's scoped projection, `full`).
  At this commit: 229 / 300 installed on the default path; listing 44,004
  characters with descriptions and 3,813 names-only (57,917 / 5,040 on full).
  claude-code is modelled to keep 45 descriptions and list 184 names only on
  the default path — the same 184 step 4.7's install wrote. codex exceeds its
  documented 8,000-character budget on both paths, and its written root
  `~/.codex/skills` is not the `$HOME/.agents/skills` its page names, so the row
  reads `root_read: no`; which entries it omits stays unobserved (0.3). Every
  other host is `unobserved`. Wrapped commands are not counted.
  `tests/scripts/report_skill_host_census.test.ts` checks byte-equal runs and
  that every row sums to the authored count.
  verify: two runs at one commit are byte-equal; totals equal
  `ls src/skills/*/SKILL.md | wc -l`.
- [ ] **0.2 First-host probes:** (a) a skill written into the watched user
  directory during a turn is invocable in that turn, as copy and as symlink;
  (b) a removed skill under a second live session — listing, invocation, already
  loaded body; (c) a `session_start` concern returning the documented skill-reload
  flag, with and without it; (d) what the host does with `context: large`;
  (e) `skillOverrides: name-only` — read from the search roadmap's 0.1 evidence
  file, not re-probed.
  verify: one row per item.
- [ ] **0.3 Second-host probes:** live pickup delay under `.agents/skills`,
  omission order and the verbatim warning, whether an implicit-disabled skill
  counts against the budget, and double listing on hosts that read both
  `.claude/skills` and `.agents/skills`.
  verify: rows per item; untested hosts stay `unobserved`.

## Phase 1 — Give the host its key back

- [x] **1.1 Rename the package key.** `context: large` → `context_window: large`
  across the schema, the writer, the six skills and every reader.
  Done 2026-10-16: both the skill and the command schema carry `context_window`;
  `backfill_model_tier.ts` writes it; the six skills, `model-recommendations.md`
  and the projection-fidelity contract say it; a schema test rejects the retired
  `context: large` (seen red before the rename). No reader consumed the old key.
  verify: the schema test is green, and `! grep -rq '^context: large' src/skills` -> 0
- [x] **1.2 Guard the host's keys.** A lint row: no package-owned skill
  frontmatter key may equal a key the host documents for skills; the host key
  list is data with its documentation URL, read date and expiry.
  Done 2026-10-16: `src/config/host-skill-frontmatter-keys.json` holds the host
  page's 20 keys and the Agent Skills spec's 6, both read 2026-10-16 and expiring
  2027-01-14, plus a `passthrough` list of keys the package uses with the host's
  meaning. `validate_frontmatter` checks the skill and command schemas against
  it; an expired list warns. Re-adding `context` to the skill schema made the
  corpus run fail with `host-key-collision`; restored, it passes.
  verify: a colliding fixture fails; the corpus passes.
- [x] **1.3 Snapshot the projection per host.** Projected SKILL.md for the first
  host, the second host and one unaffected host, so a host key is never rewritten
  silently.
  Done 2026-10-17: `tests/install/host_skill_projection_snapshot.test.ts` copies
  the six skills from `dist/agent-src/skills` through the installer's own
  `_copy_dir_dereferencing_symlinks` into a scratch home for claude-code (plus
  the `model_tier` → `model` render), codex (`~/.codex/skills`, the Claude
  bundle) and augment, and pins the landed key order. It also asserts no
  host-documented key is added, dropped or rewritten in deploy except the one
  deliberate `model` write. With `dist/.../deep-reading-analyst/SKILL.md` set
  back to `context: large` it failed 4 cases; restored, 37 pass.
  verify: snapshot test; the six skills' projected frontmatter carries
  `context_window`.

## Phase 2 — Reach every skill, and say how

- [x] **2.1 A recovery path without the MCP server.** Once the search roadmap's
  2.1 lands, `missing-skill-recovery` names that shell search path as the fallback
  when the MCP tool is not registered.
  Done 2026-10-16: the rule already named `route:explain --skills` (the search
  roadmap's 2.2), but on a default install the host root resolves, so the
  package projection was never ranked and an uninstalled skill stayed
  unreachable. The report now also ranks the projection and lists, under
  `not_installed`, rows whose name no resolved root carries, each labelled
  `not-installed`; a projection-only answer labels every row so.
  `tests/install/skill_reach_not_installed_real_install.test.ts` runs a hermetic
  `--global --tools=claude-code` install into a scratch `HOME`, picks the first
  skill it did not write and finds it labelled `not-installed`; with the field
  forced empty the test failed.
  verify: scratch-`HOME` default install with MCP disabled — a query for an
  uninstalled skill returns it, labelled `not-installed`.
- [ ] **2.2 Declare reach.** `doctor` prints installed / described / name-only /
  reachable-not-installed / degraded counts; they sum to the authored count.
  verify: snapshot test; the sum equals the authored count.
- [ ] **2.3 Degraded is never called reach.** A skill reachable only through a
  text read that drops declared properties is counted `degraded`, never
  `reachable`.
  verify: fixture skill with a command and a flow read through MCP is counted
  `degraded`.

## Phase 3 — Fork what ends in a report

- [ ] **3.1 Classify by output shape.** Per skill: *report* (runs, returns a
  result, needs no later turn) vs *standing* (guidance for the rest of the task).
  Only report skills are fork candidates.
  verify: deterministic classification, every skill in exactly one class; the
  six D2 skills classified first.
- [ ] **3.2 Pilot, first host only.** `context: fork` on at most five report
  skills, projected for the first host only; every other host gets the body.
  Pre-register: main-conversation tokens per invocation, outcome on host-graded
  cases, a harm guard (a fork that needed context it could not see), re-entry
  after compaction, background execution and artifacts returned.
  verify: pre-registration hashed before the first run; the result carries the
  claims gate's honesty label; null and harm are valid closes.
- [ ] **3.3 Widening is posed, not taken.** Extending the fork set is put to the
  owner on 3.2's record.
  verify: the question is recorded with `asked:` beside 3.2's result.
- [x] **3.4 Compaction tail to the body budget.** Record in
  `src/config/skill-body-budget.json`'s comment the 5,000-token re-attach limit
  and name the six D4 skills as shrink candidates. No new gate.
  Done 2026-10-16: the `_comment` names the 5,000 / 25,000-token re-attach limit
  and the six SKILL.md files at or above 20,193 characters that day —
  existing-ui-audit, ai-council, memory-consolidation, roadmap-writing,
  git-workflow, conventional-commits-writing. Same change: six `raised` entries
  of +7 bytes each for the 1.1 key rename, which the body gate refused unraised.
  verify: the comment names the limit and the six skills.

## Phase 4 — Materialise on demand, only where a host drops or lacks a skill

Gated on 0.2 (a)–(b) and 0.3 being `observed-true` for the host in question.

- [ ] **4.1 A resident set for the second host**, under its user skills root,
  sized to its budget; implicit invocation stays enabled for the resident set
  only. Its `agents-md` projection stays exactly as today.
  verify: projected listing characters ≤ the modelled budget; a fresh session
  shows no omission warning; the host's AGENTS.md projection is byte-equal to
  before.
- [ ] **4.2 Triggers are the package's own.** A skill is materialised when a
  command or flow naming it is expanded (edge data from
  `report_skill_menu_census`), when search returns it and it is read, or when it
  is called by name — never on a model guess.
  verify: one test per trigger kind.
- [ ] **4.3 From the staged payload, checked.** Source is the carrier roadmap's
  staged payload of the running version, never the network. Each entry is
  recorded in a sorted, timestamp-free lock with a content hash of the projected
  folder; staging writes then moves; a mismatch, a path escaping the root, a
  symlink pointing outside it or a half-written entry refuses and reports.
  verify: tamper, traversal, symlink-escape and interrupted-write fixtures each
  refuse; the lock is byte-stable across two runs.
- [ ] **4.4 Lifetime is a lease, not a task.** An entry stays while one live
  session holds a lease; leases reuse the session register's record, heartbeat
  and TTL under a root keyed by host config root, so two profiles never share one;
  collection runs in the `session_start` read; nothing is removed on `stop`.
  verify: two-session fixture — no removal under a live lease, expired leases
  collected; two config roots keep separate locks.
- [ ] **4.5 Only its own entries.** Never touches an entry it did not write,
  never writes into a project tree, never shadows a host built-in.
  verify: a foreign entry survives a full collect.
- [ ] <!-- blocked-by: which-completeness-skills-owe | asked: yes — 2026-10-12, inbox-2026-10-n reply --> **4.6 The first host waits.** It gets materialisation only if the
  completeness answer makes presence optional and Phase 5 reads no harm; until
  then it keeps the full install.
  verify: decision test for each completeness answer.
- [x] **4.7 Computed visibility on the first host.** The resident set keeps
  descriptions; the rest go `name-only`, still listed and invocable — computed,
  never a key; only for skills the package owns; never over a user value; removed
  exactly on uninstall.
  Done 2026-10-14 under the owner's option (a). `src/scripts/_lib/skill_listing_overrides.ts`:
  the resident set is `modelListingBudget` over the skills the global deploy
  inventory records for `claude-code` and that survived every prune, so the
  installer calls it after the scoped / tiered prune, not inside the deploy loop.
  Ownership is a value, not a signature, so it is recorded in
  `~/.event4u/agent-config/skill-overrides.json`; an entry stays ours only while
  the file holds exactly the recorded value. The phase gate's 0.2 (a)–(b) probes
  materialisation and does not bear on this step; the `name-only` behaviour it
  relies on is the four-of-five-column reading recorded under the search
  roadmap's 0.1. A hermetic global install into a scratch `HOME` wrote 184
  `name-only` entries, a re-run left the file byte-identical, and uninstall
  removed all 184 and kept a foreign `skillOverrides` key.
  verify: merge fixture with a pre-existing user value; uninstall removes exactly
  what was written.
  verify: `npx vitest run tests/install/skill_listing_overrides.test.ts` -> 0

## Phase 5 — Read the effect once

- [ ] **5.1 Pre-register.** Arms per host: today vs Phase 4 on the second host;
  today vs 3.2 on the first. Primary: skills reached with declared semantics per
  positive host-graded case. Guards: skill-not-found at invocation; any removal
  under a live lease (target 0); omission warnings on the second host (target 0).
  verify: pre-registration hashed before the first run.
- [ ] **5.2 Run under the existing spend and independence rules.**
  verify: the result is labelled for the claims gate.

## Phase 6 — Small items to existing carriers

- [x] **6.1 One arrival for the live-arm stub.** Record on
  `stubs/road-to-skill-tiering-live-arm.md` that the host now documents hot pickup
  and a name-only listing state.
  Done 2026-10-16: the stub's arrivals line counts `inbox-2026-10-n` and quotes
  both from the host's skills page as read that day.
  verify: the stub carries the line with this round's codename.
- [x] **6.2 Watch the second host's skills page** in the host-docs digest watch
  the search roadmap's 0.2 adds for the first host.
  Done 2026-10-17: `src/scripts/hooks/host_docs_pages.yaml` carries
  `codex-skills` beside `claude-code-skills`, at the redirect target
  `learn.chatgpt.com/docs/build-skills.md` (the old Codex URL answers 308),
  digest taken that day. The page read surfaced one thing this file did not
  know: Codex's user root is `$HOME/.agents/skills`, while a `--global` install
  for `codex` deploys the Claude bundle to `~/.codex/skills`
  (`GLOBAL_DEPLOY_SOURCES` + `USER_SCOPE_PATHS`), so D3's "receives none" holds
  in effect even though files are written. Changing that root is a frozen
  install-ABI change and stays with Phase 4.
  verify: the digest list names both pages.
- [ ] **6.3 Close the declared-dependency hole the default projection opens.**
  Round `inbox-2026-10-t` reproduced it offline against
  `_lib/scoped_projection`: **28** `skills:` declarations across `src/skills`
  and `src/domains` name a skill that exists in the package and that the
  default projection prunes — `/implement-ticket` alone declares
  `refine-ticket` and `feature-planning`, and `src/skills/refine-ticket/SKILL.md`
  carries no `packs:` key at all. Add `tests/install/default-projection-closure.test.ts`
  importing `load_packs_registry`, `compute_active_pack_ids` and
  `is_pruned_under_scoped` — offline, no install — asserting zero
  declared-but-pruned, with the two header cases pinned by name. Then make
  `_prune_scoped_modules` (`src/install/install.ts:3302`) keep every skill a
  surviving artefact declares. Additive only: delivery grows, never shrinks.
  verify: `./scripts-run src/scripts/count_scoped_projection --json` -> 0
- [x] **6.4 One field, one type.** A linter rejects a RULE name in a `skills:`
  list. Measured population in the source tree at `5fa963cec`: **2**
  (`reviewer-awareness`, `security-sensitive-stop`) over 265 entries — small
  enough to fix in the same change. The round's source claimed 26; that
  figure was taken over the INSTALLED tree and did not reproduce here, so the
  installed-tree count is re-measured before it is quoted anywhere.
  Done 2026-10-17: the row lives in the existing `check_skill_requires` gate
  (already run in CI), not a new gate. It reads every `skills:` list on a
  SKILL.md or command.md and refuses a name that is a rule and not a skill. The
  same two entries were still present — `/threat-model` and `/review:routing` —
  and both are dropped from their `skills:` lists, which also removes them from
  the generated `meta` pack manifest. The installed-tree figure was not
  re-measured and is quoted nowhere. Three tests were red before the row
  existed; the tree test stayed red until the two entries left.
  verify: a seeded rule-name entry makes the linter exit non-zero, and a
  seeded skill name does not. Both directions.

## Blockers

### blocker: which-completeness-skills-owe

- **Status:** open — owner-reserved (council 2026-10-16, 2/2 ESCALATE, both recommending (b)); re-checked 2026-10-18, still unmet: no ADR under `docs/decisions/` names this blocker, and `README.md:59` still reads "Pack-scoped install — writes the active pack only". Raised 2026-10-12 by round inbox-2026-10-n; the supplied plans cite an owner directive of 2026-08-30 against a silent subset, which no file in `agents/` or `docs/` records, and the same round asks for a minimal install
- **Owner:** owner — what a consumer is promised to receive is a public product statement (`README.md:59`)
- **Class:** 3
- **Ownership:** product-owned
- **Blocks:** step 4.6, and `road-to-a-setup-that-decides-itself` step 4.7
- **What to do:** pick exactly one — (a) presence: every skill installed on every host with native skills; (b) reach: every skill reachable in one deterministic step with its declared semantics, presence decided per host; or (c) today's pack-scoped install, recorded as the promise.
- **Resolved when:** an ADR records the answer and `README.md:59` and ADR-267 § 5 cite it or are amended.
- **Recommendation:** (b). It makes the minimal setup legal while keeping "no silent subset" as an invariant `doctor` can check (2.2), and it turns D1 into a defect under every reading rather than only under (a).

  **Seconded by an AI council, 2026-10-16 — and the council confirmed the
  escalation rather than lifting it.** Both seats (`anthropic`, `openai`, prompt
  mode, two rounds, 2/2 concluded, no split) returned **ESCALATE** on the
  routing test: choosing which reading becomes the binding promise *creates a
  public commitment*, which is owner-reserved. Both then recommended **(b)**.
  Record: `agents/evidence/council/owner-blocker-routing-20261016.md`.

  **A drafted sentence for `README.md:59`**, so the resolution clause has
  something to cite rather than a word (`openai`):

  > Every skill included in this package is available with its documented
  > behavior through one deterministic retrieval step on supported hosts; each
  > host may decide which skills are installed locally.

  **What (b) costs, and both seats were explicit that the word alone is not the
  decision.** `anthropic`: (b) makes the query mechanism **a capability
  requirement rather than optional infrastructure** — a host that cannot supply
  it is *unsupported*, not broken, and that has to be written down before the
  promise ships. `openai`: the owner ratifies an **operational definition** —
  the authoritative skill set, which hosts are supported, what "one step" means,
  version selection, failure behaviour, offline expectations, and what counts as
  preserved semantics. Ratifying the word "reach" without those replaces one
  ambiguous promise with an unverifiable one.

  Both treated the measured host truncation as settling (a) against itself: a
  default install on which the host stripped every description and dropped
  hundreds of entries makes universal presence a promise this package cannot
  keep, whatever it writes down.
- **If you do nothing:** Phases 0–3, 2.x and the second host proceed; the first host keeps its full install indefinitely and `projection.mode` stays the last setting the setup roadmap cannot remove.

### blocker: listing-override-write-is-owner-owned

- **Status:** resolved — owner decision 2026-10-14 (chat answer "1"), option (a): the package writes the listing override for skills it owns into the user-global host settings, never over a user value, removes it on uninstall, with no settings key. The owner lowered the recorded never-write commitment for this one exception, because the advisory route hands the user exactly the configuration the 2026-10-12 directive removes. The never-write statements now name it (`src/scripts/_lib/mcp_bridge.ts` § tierBAdvisory, `docs/mcp-server.md` § When the host lists a skill without its description); the same answer is recorded at the owner question in `road-to-skill-menu-economy`; step 4.7 is done. First raised as the fourth arrival of the question `road-to-skill-menu-economy` already poses, 2026-10-12, round inbox-2026-10-n
- **Owner:** owner — `src/scripts/_lib/mcp_bridge.ts:348-351` and `docs/mcp-server.md:184-187` state the package never writes a consumer's host settings, a recorded commitment only the owner may lower
- **Class:** 3
- **Ownership:** product-owned
- **Blocks:** step 4.7
- **What to do:** pick exactly one — (a) write: the package writes the listing override for skills it owns into the user-global host settings, never over a user value, removed on uninstall, with no settings key, and amends the never-write statement to name this exception; (b) advisory: `doctor` prints the override block and the user applies it through the host; or (c) neither: the first host's listing stays the host's own fill order.
- **Resolved when:** the owner question in `road-to-skill-menu-economy` and this blocker carry the same answer, and step 4.7 is either unblocked or cancelled.
- **Recommendation:** (a). The menu file recommended (b) before the 2026-10-12 directive; (b) hands the user exactly the configuration the directive removes, and the installer already writes hook entries into the same host settings file, so the lock is narrower in practice than its wording.
- **If you do nothing:** the first host keeps full descriptions for every installed skill and the host decides which to keep within its budget; nothing else in this file waits on it.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | The replacement key is `context_window: large` | It says what it means and cannot collide with the host's `context` | the host documents a `context_window` key |
| D2 | reversible-technical | agent | Only report skills may fork | A forked run sees no conversation and leaves nothing for later turns | the 3.2 pilot shows a standing skill losing nothing when forked |
| D3 | reversible-technical | agent | Materialisation runs on the second host first | That host omits skills over budget; on the first host the listing override does the same job with no file churn | 0.2 shows the first host cannot pick up a written skill at all |
| D4 | product-owned | owner | Land as a new file rather than un-park `road-to-skill-menu-economy` | Operator instruction of 2026-10-12 to land this round's roadmaps; the menu file stays parked on its own condition | the menu file's condition (iii) closes |
| D5 | product-owned | owner | Option (a) on `listing-override-write-is-owner-owned`: write `skillOverrides` for package-owned skills into the user-global host settings, never over a user value, removed on uninstall, no settings key — an owner lowering of the recorded never-write commitment | Owner chat answer "1", 2026-10-14; the advisory option hands the user the configuration the 2026-10-12 directive removes | a host build changes what `name-only` does, or a consumer reports a value of theirs touched |

## Kill register

- **K1 — Remove a skill when its task ends, to save tokens.** The body stays until
  compaction; the listing saving is at most a name; the host has no task-end signal.
- **K2 — Reset materialised skills at session start.** The skill directory is
  machine-wide; a reset pulls skills out from under live sessions.
- **K3 — Teardown on `stop`.** It fires every turn.
- **K4 — Network or third-party fetch on the common path.** Local staged payload
  only; third-party skills stay in the governed scouting line with a human adopt.
  Public issue reports against an external skills CLI describe removal of
  unmanaged directories and stale lock entries — the failure shapes 4.3–4.5 exist
  to refuse.
- **K5 — Handing a skill over as launch-prompt text.** It strips the same
  properties the MCP read path strips.
- **K6 — New verbs for use / release / inspect.** ADR-041; the triggers in 4.2 are
  existing entry points, and `route:explain` and `doctor` exist.
- **K7 — A new content-addressed store, manifest schema or lifecycle vocabulary.**
  The staged payload is the store, the install log's `sha256` the lock, the
  activation ladder the vocabulary.
- **K8 — Writing materialised skills into a project tree.** ADR-020.
- **K9 — A watcher daemon for leases.** The `session_start` read collects.
- **K10 — Session isolation by launch flags as a default.** Scoping skills to one
  process through the host's launch flags needs the package to own the launch;
  documentable as an option, never a default.

**Parked, not rejected:** transactional activation of a group of skills, and
pooling skill payloads across subagent spawns — neither was argued by any plan
beyond its name.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-16 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A materialised skill arrives one turn late | product | The host may not pick up a written skill in the same turn. | 0.2 (a) decides same-turn pickup; 4.2 materialises at the earliest deterministic point; 5.1 counts misses. | Phase 4 — Materialise on demand, only where a host drops or lacks a skill |
| 2 | Two sessions, one directory | implementation | A removal in one session pulls a skill from another. | 4.4 leases; never remove under a live lease; 0.2 (b) measures first. | Phase 4 — Materialise on demand, only where a host drops or lacks a skill |
| 3 | A fork hides context a skill needed | product | A forked run sees no conversation. | Only report skills (3.1); harm guard in 3.2. | Phase 3 — Fork what ends in a report |
| 4 | Host contracts move | implementation | A host version changes pickup, budget or key semantics. | Expiring rows (Phase 0); digest watch (6.2); 1.2's key list expires. | Phase 0 — Probe the host contracts before building on them |
| 5 | Closing the dependency hole grows the install this file is thinning | product | 6.3 keeps every skill a surviving artefact declares, so the default projection gets larger — the opposite direction from the sibling thinning roadmap. | The growth is bounded by the declarations themselves and measured, not estimated: 6.3's verify prints the new projected count and it is published rather than assumed. A declared dependency that is pruned is a broken install either way; the honest trade is a larger install over a silently incomplete one, and 23 of the 28 sit in one pack, so per-pack pruning of the declaring COMMAND is the cheaper lever if the number lands badly. | Phase 6 — Small items to existing carriers |
| 6 | The rule-name linter is built against the wrong population | implementation | 6.4's figure of 2 was measured on the SOURCE tree; the round's source claimed 26 from the installed tree. A linter sized for 2 may meet a much larger set where it actually runs. | 6.4 requires the installed-tree count to be re-measured before it is quoted, and the linter is a seeded-fixture check in both directions rather than a one-off cleanup — a larger population changes the effort, not the correctness. | Phase 6 — Small items to existing carriers |

## Acceptance Criteria

- [ ] AC-1 — Every skill is reachable on every host with native skills; `doctor`'s
  installed / described / name-only / reachable-not-installed / degraded counts sum
  to the authored count.
- [ ] AC-2 — No package-owned skill frontmatter key equals a host-documented key.
- [ ] AC-3 — The fork pilot has a pre-registered, labelled result.
- [ ] AC-4 — On the second host a fresh session shows no omission warning and every
  non-resident skill is reachable by 4.2's triggers.
- [ ] AC-5 — No removal is observed under a live lease in the 5.1 run.
