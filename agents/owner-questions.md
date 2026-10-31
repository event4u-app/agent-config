# Owner questions

One list of every open decision that only the owner can take. Runs do not open a
pull request whose only content is a question; they add a row here and take the
next step (`agents/evidence/owner-directives/2026-10-24-throughput-over-ceremony.md`).
An answered question moves to `## Answered` with its date and the answer verbatim,
and the run that applies it links its PR.

## Open

### OQ-36 — Where a logging-route answer lives

- **Context:** round `inbox-2026-10-bl`, your turn: the agent may ask at the start
  or on certain errors where logs should go, "und das merken wir uns auch". The
  answer has to live somewhere: an error-routing rule is about the project, a
  "tell me on Slack" wish is about you.
- **Options:** (a) by kind — error routing as a project/team agreement, a
  notification wish as user-owned data; (b) everything project-scoped; (c)
  everything user-scoped.
- **Recommendation:** (a) — it keeps a teammate's checkout correct and your
  personal wishes out of the repository.
- **Blocks:** `road-to-a-map-that-knows-what-happened` L.6.

### OQ-37 — When the agent asks about a logging route

- **Context:** same round. Asking at every session start is noise; never asking
  leaves an unrouted error class unrouted.
- **Options:** (a) on an unrouted error class, and at project start only when the
  graph leaves the default open; (b) only on errors; (c) only at project start.
- **Recommendation:** (a).
- **Blocks:** `road-to-a-map-that-knows-what-happened` L.6.

### OQ-38 — Stage L before Stage D

- **Context:** same round. Readers L.2–L.5 build on the measured base (Stage D,
  blocked on `b-map-remeasure-spend`). L.1, the sink catalogue, is pure data and
  runs now. Taking L.2+ earlier is an exception to "base before breadth".
- **Options:** (a) wait for Stage D, L.1 now; (b) build L.2–L.5 now on the
  unmeasured base.
- **Recommendation:** (a).
- **Blocks:** `road-to-a-map-that-knows-what-happened` L.2–L.5 ordering.

### OQ-39 — Your council instruction on ADR-303 ("graph as truth?")

- **Context:** round `inbox-2026-10-bk`, your turn: "ADR-303 - Sollten wir den
  Graphen nicht als Index, sondern als Wahrheit behandeln? Im AI-Council
  entscheiden und anwenden.", later "Denk an meine Frage und Entscheidung vorhin
  !!!". Your directive of 2026-10-26 says the graph is a source, not the truth;
  ADR-303 carries `reopen_policy: owner`, and its review trigger fires when you
  name a **class of facts** to trust without a witness check. The question names
  none, and a council round is paid, so the run did not start it on a transcript
  line.
- **Options:** (a) keep ADR-303 as is — your 2026-10-26 directive answers it;
  (b) name the class of facts (e.g. lockfile-derived package edges) and the run
  sends exactly that to the council, which may then recommend a scoped amendment
  you ratify; (c) send the open question to the council as written.
- **Recommendation:** (b) if you have a class in mind, else (a) — the trigger
  needs a named class, and a scoped amendment is reversible where a blanket
  "truth" is not.
- **Blocks:** nothing executable.

### OQ-40 — Map invariants on one external repository

- **Context:** round `inbox-2026-10-bk`: the review asks that the map invariants
  (0 dangling lane edges, per-lane confirm ≥ 0.99, no fixture findings in product
  views) hold on a representative external repository, not only on this one.
  `road-to-a-map-that-holds-on-the-real-repo` 2.8 builds this repository only.
- **Options:** (a) add step 2.9 running the 2.8 job once on one SHA-pinned subject
  of the graph-that-wins corpus (read, never edited); (b) leave it to the
  graph-that-wins measurement; (c) decline.
- **Recommendation:** (a) — it reuses a repository you already chose.
- **Blocks:** nothing executable today.

### OQ-41 — May the standing bypass merge a change to the ratification mechanism itself

- **Context:** round `inbox-2026-10-bk`: the external review asked this (J-2) and
  it stayed unanswered. A change to the ratification mechanism merged under the
  bypass is governance self-amendment, reserved to you.
- **Options:** (a) no — such a PR waits for a normal review; (b) yes, recorded
  like every other bypass.
- **Recommendation:** (a).
- **Blocks:** nothing executable; it closes a hole in the bypass directive.

## Not owner questions — waits, or already settled in the tree

- `openai-council-seat-oauth-grant-rejected` (agent-throughput-recovery): its
  `Resolved when` asks for both seats answering a real round. Councils ran 2/2 on
  2026-10-24, so it looks settled. The agent verifies and closes it.
- `default-flip-of-the-installed-layer` (installed-layer): waits on a host
  observation and states itself "not a question".
- `four-dated-re-checks-are-calendar-bound` (corpus cadence): waits on calendar dates.

## Answered

### OQ-8 — The owner-authority register sits outside this list

- **Context:** `agents/roadmaps/stubs/road-to-owner-authority-decisions.md` holds
  owner-reserved decisions 1, 4, 5, 7, 8 and 9-12 plus the open halves of 2 and
  3, under `## Unresolved decision N` headings that neither this list nor
  `/roadmap:resolve-blockers` reads. Its `review_by` lapsed on 2026-09-25, and it
  has now arrived seven times; the seventh arrival found Decision 6 answered
  (ADR-249) but recorded open, corrected on 2026-10-25.
- **Options:** (a) the agent lifts each open decision into its own OQ row here,
  one per decision, and marks the register entries as moved; (b) the owner
  answers or retires the register in one pass; (c) leave it as a parked record.
- **Recommendation:** (a) — one list of every owner decision is what this file
  says it is, and lifting rows decides nothing in the owner's name.
- **Blocks:** nothing executable; the cost is that the decisions are unseen.
- **Answered 2026-10-30:** you asked that the open questions be settled in the AI council first; it decided 2/2 on (a) — lifting rows decides nothing in your name. Applied here: every open register decision is now its own row, OQ-43 to OQ-53, and each register entry is marked moved.

### OQ-47 — May a run satisfy one-in-one-out with a self-written `estate_offset_exempt`?

- **Context:** lifted from Decision 5 (OQ-8). The party writing the exemption is
  the party gaining the slot; runs use the key routinely today.
- **Options:** (a) yes — self-certified exemptions stay legal; (b) no — an
  offset needs a named counterpart the run did not choose.
- **Answered 2026-10-30 — already decided by you, found in the tree.** The AI
  council (anthropic + openai, 2/2, one round, at your request) ruled (b) only
  *absent* an authorizing record, and said removing an expressly granted
  exemption power would be yours alone. That record exists: `ADR-287` D4 (your
  ruling, 2026-10-16) keeps `estate_offset_exempt` unbounded "deliberately,
  because bounding it was option 3 and option 3 was declined". So the answer is
  (a), dated 2026-10-16; the row was framed before that ruling. Reopens only
  through `ADR-287`'s own owner-only trigger.

### OQ-49 — Is ADR-215 § D2's reasoning behind `CAP = 2` your position?

- **Context:** lifted from Decision 8 (OQ-8). The council kept `CAP = 2` on
  2026-08-26; whether its reasoning is yours was open. The cap binds nothing today.
- **Answered 2026-10-30 by the AI council** (anthropic + openai, 2/2, one round,
  at your request): keeping the cap is preservation and council-decidable — it
  stays. The reasoning is recorded as the council's, with your attribution
  *unestablished*; both seats agreed nothing operational needs that attribution,
  so it is not put to you. **Revisit-if:** measured demand or capacity evidence,
  or you say the reasoning is or is not yours.

### OQ-50 — Does a git-authorization gate return?

- **Context:** lifted from Decision 9 (OQ-8). ADR-255 § 1 refused it for one
  round; ADR-254 stands. Two ledger items name it as their dependency.
- **Answered 2026-10-30 by the AI council** (anthropic + openai, 2/2, one round,
  at your request): not decidable as asked — there is no concrete gate to say
  yes or no to. Current state stays (ADR-254). Both seats: a typed-transition
  design within ADR-254's trigger would be a mechanism and could be council-
  decided; openai added that grant representation, matching and blocking are
  three separable parts, and the two ledger items may need only the first two.
  **Revisit-if:** a concrete design exists with bounded failure and rollback
  behaviour; it comes to you only if it weakens a reserved invariant.

### OQ-51 — Should `personal.autonomy`'s default or its `auto` semantics change?

- **Context:** lifted from Decision 10 (OQ-8). ADR-255 § 2 left both unchanged
  for one round: `auto` resolves to `off` until a standing directive.
- **Answered 2026-10-30 by the AI council** (anthropic + openai, 2/2, one round,
  at your request): (c), keep both. "Changes consumer defaults" is not by itself
  an owner-reserved transition; nothing measured shows a problem. openai: an
  agent that asks despite sufficient authorization is an implementation defect,
  fixable without touching either setting. **Revisit-if:** a concrete proposal
  names what newly happens without asking, or abandonment/adoption data.

### OQ-9 — Which tree owns "who is the user", and what "profile" and "pack" mean

- **Context:** ADR-010 gives the "who" question to one axis, `profile.id`, and
  calls duplication across axes a contract violation. Three trees answer it:
  `src/profiles/*.yaml` (command views), `src/agent-src/profiles/*.yml` (seed
  identity) — six shared ids, different `packs` vocabularies — and
  `user-types/` (seven other ids, read only to order MCP prompts). "Profile"
  also names the install scope, `discipline_profile` and session overlays;
  "pack" names `src/packs`, `src/domains/*/pack.yaml` and
  `src/agent-src/packs`. Raised by round `inbox-2026-10-an`; both of its plans
  recommended the seed tree.
- **Options:** (a) the seed tree owns the axis, `src/profiles` is generated
  from it as the command view, `user-types` folds into a seed-profile field
  with an id mapping, and the extra meanings get prefixed names with aliases
  for one release; (b) keep three trees and document the split (done in
  `road-to-a-measured-pointer-gate-and-true-records` 1.3); (c) (a) without the
  renames.
- **Recommendation:** (c) first — it removes the duplicated axis without
  touching public names; the renames can follow once the ids are single.
- **Blocks:** nothing executable; settings key `personal.user_type` and the
  profile ids are public surface, so no run changes them unasked.
- **Answered 2026-10-30:** "analysiere das uns kläre das im ai council" — the council decided 2/2 after a read of the three trees, on none of (a)-(c) as written: `profile.id` in the seed tree (`src/agent-src/profiles`) is the one identity axis; `src/profiles` stays a separate command view, linked by an explicit `default_command_view_id` and never generated from the seed (generation would lose its `label`, `immutable`, ordered `view` and `--expanded`); `personal.user_type` becomes a deprecated input that only orders recommendations, all seven values stay readable and none is mapped by guess; the extra meanings of "profile" and "pack" are renamed later in small pull requests with aliases. Carried in `later/road-to-one-identity-axis`. <!-- md-language-check: ignore -->

### OQ-10 — Measure per-skill uplift against a no-skill arm

- **Context:** `agents/roadmaps/stubs/road-to-skill-uplift-against-a-no-skill-arm.md`
  poses this and has now arrived six times, the latest in round
  `inbox-2026-10-an`. `run_skill_evals.ts` still throws from
  `_spawn_subagent` and grades every rubric `pass: null`, so no skill has a
  measured outcome delta.
- **Options:** (1) fund a pilot — one host, three skills with a deterministic
  outcome check, published either way; (2) fold a per-skill outcome column into
  the tiering live arm; (3) decline and record that per-skill uplift is not
  measured.
- **Recommendation:** (1) — the stub's own recommendation, and the only option
  that answers the question that keeps arriving.
- **Blocks:** the stub's promotion; nothing active.
- **Answered 2026-10-30:** "Ja, gestuft messen" — option (1), staged: repair the runner first, pre-register hypothesis and threshold, then one skill against a no-skill arm with repetitions, then three; published either way, and a run that fails is recorded as not measured. Carried in `later/road-to-skill-uplift-measured-in-stages`. <!-- md-language-check: ignore -->

### OQ-11 — The ADR-138 teardown review opens on 2026-10-28

- **Context:** the global user-profile layer reaches day 90 on 2026-10-28 with
  0 observations proposed (none even on the maintainer's machine; proposals come
  only from the manual `/memory mine-session`). The council's amendment of
  2026-10-25 makes that a no-adoption signal that opens the teardown review, and
  bounds the review: non-destructive, user data inventoried and preserved,
  nothing deleted without consent. `/agents user show --audit` shows the reading.
- **Options:** (a) archive-first deprecation — deprecate the commands for one
  release, keep the code and any user data in an archive; (b) redesign activation
  — e.g. offer mining at a natural moment instead of only on request, then read
  the gate again; (c) one bounded trial — fixed exposure, expiry and a minimum
  sample, decided in advance.
- **Recommendation:** (b) scoped as (c) — the layer was never offered, so its
  value is untested; one bounded trial with a fixed end answers that, and (a)
  stays the default if the trial does not reach its sample.
- **Blocks:** nothing executable; the review's outcome can deprecate a
  user-data layer, which is the owner's call
  (`road-to-a-memory-that-names-its-moment` § Decisions E12).
- **Answered 2026-10-30:** "Begrenzter Testlauf" — the recommendation, (b) scoped as (c): inventory the user data first, then offer mining at a natural moment with consent and opt-out, a fixed end and a minimum sample decided in advance; below that sample, (a) archive-first deprecation follows. Carried in `later/road-to-a-bounded-trial-of-the-user-profile-layer`. <!-- md-language-check: ignore -->

### OQ-42 — A preamble grant for the image rights floor

- **Context:** round `inbox-2026-10-bk`. The image rights rule
  (`image-likeness-and-rights`) is scoped to the `ai-image` pack, so on hosts that
  ship every skill (claude-code, codex) the six image skills arrive without the
  rights check they tell the agent to run. Adding `routes_to` for the six skills
  fixes that and was ratified 2/2 by the council, but costs ~45 tokens in every
  spawn's preamble, and `main` sits exactly at its zero-growth ceiling.
- **Options:** (a) grant ~45 tokens in `src/config/preamble-payload-exceptions.json`
  for this change; (b) name an offset elsewhere; (c) leave the floor pack-scoped.
- **Recommendation:** (a) — it closes a gap in a rights floor; 45 tokens is the
  cost of the frontmatter list alone.
- **Blocks:** `later/road-to-records-that-match-their-code` 1.2.
- **Answered 2026-10-29:** "OQ-42: a, gib die Tokens frei und setz es um" — option (a). Applied on `feat/oq-42-image-floor-grant`: `routes_to` added, grant `oq-42-image-floor-routes-to` (43 tokens, expires 2027-01-27) recorded; the ledger still needs an independent approving review on that pull request. <!-- md-language-check: ignore -->

### OQ-32 — May the self-repair loop propose a change to the user's own project?

- **Context:** round `inbox-2026-10-bi`. A convention that keeps not arriving
  ("tabs!") can only be fixed in the user's project (`.editorconfig`, a
  formatter config, `AGENTS.md`), but `self-repair-loop`'s Iron Law reads "never
  'fix' it by editing the user's project". Lowering that floor is yours.
- **Options:** (a) amend to "never edit the user's project without their
  consent" — the fix is a proposed diff the user accepts; (b) keep the law and
  route conventions to a separate proposal-only path outside self-repair;
  (c) keep it as is.
- **Recommendation:** (a) — the proposal is a diff the user sees and accepts,
  never a silent write.
- **Blocks:** `later/road-to-a-noted-that-is-a-write` Phase 3.
- **Answered 2026-10-29:** the owner sent it to the AI council first; it decided 2/2 on (b): the self-repair Iron Law stays unchanged, and a convention that keeps not arriving goes through a separate proposal-only path — a diff the user sees and accepts — outside self-repair. Both seats ruled (a) a governance self-amendment of a recorded law, which the council may not take, while (b) gives the same reviewable diff without widening self-repair's remit. Applied in `later/road-to-a-noted-that-is-a-write` Phase 3.

### OQ-33 — May agent-config read the host's own auto-memory?

- **Context:** round `inbox-2026-10-bi`. Claude Code keeps per-project memory
  under `~/.claude/projects/*/memory`; `src/config/source-registry.json` lists it
  read-only with no reader. Reading personal data outside the repo is yours to
  allow.
- **Options:** (a) a consent-gated, read-only bridge (asked once, class B);
  (b) never.
- **Recommendation:** (a) — read-only, consent asked once, no writes into host
  memory.
- **Blocks:** nothing executable; a future reader for correction recurrence.
- **Answered 2026-10-29:** "Ja, es darf lesen, auch ohne zustimmung. AC soll ja so gut wie möglich funktionieren. Aber schreiben darf es da nicht. - und ac bekommt das persönliche ja eh mit, in anderen chats." — read without a consent prompt; never write. The AI council had classed it owner-reserved and recommended (a) with consent. Applied in `later/road-to-a-noted-that-is-a-write` 1.3. <!-- md-language-check: ignore -->

### OQ-34 — Should chat history redact credentials at rest whatever the egress mode?

- **Context:** round `inbox-2026-10-bi`. `chat_history` is on by default and
  stores text in plaintext; the placeholder view exists but
  `egress.placeholders.mode` ships `off`. There is no private-section marker.
  Both options change consumer default behaviour.
- **Options:** (a) always redact on write with the existing egress rules, plus
  a private marker; (b) turn placeholders on only where chat history is
  enabled; (c) leave both to `road-to-placeholders-on-the-wire`.
- **Recommendation:** (a) — the storage risk exists today without any
  condition.
- **Blocks:** nothing executable now.
- **Answered 2026-10-29:** "Es wäre gut, wenn wir diese für eine gewisse zeit woanders speichern und sie dann in regelmäßigen abständen (z.b. nach 7 tagen) gelöscht werden. Ab da ist es dann so gut wie geschwärszt, aber bis dahin arbeitet der agent wie der nutzer es erwartet" — a fourth option: chat history stores placeholders; the original values sit in a separate local, untracked store the agent can resolve, and are purged after 7 days, after which only the placeholders remain. Applied in `later/road-to-a-fill-the-session-sees-coming` 3.1. <!-- md-language-check: ignore -->

### OQ-35 — A memory shared across providers vs. the ADR-249 floor

- **Context:** round `inbox-2026-10-bi`, your demand that subagents, councils
  and unpaid routes share one memory. ADR-249 rules out a cross-session
  persistent state store, a data-handling floor only you can lower.
- **Options:** (a) keep the floor and serve the demand through curated,
  file-first memory cut per audience (`later/road-to-a-memory-each-worker-is-handed`);
  (b) let the council prepare a reopen record limited to a scoped episodic
  journal, default off; (c) decline the demand.
- **Recommendation:** (a) — it serves the demand without a new store.
- **Blocks:** `later/road-to-a-memory-each-worker-is-handed` Phase 3.
- **Answered 2026-10-29:** "kostenlose Modell-Routen sollten ja so wenig wie möglich und nur das nötigste wissen. Also da sollten sie keinen übergreifenden speicher haben, sondern der orchestrator sagt ihnen nur das was sie brauchen. eigene oder die frontier modelle, wo die daten sicher sind (zumindest sicherer), die dürfen den gemeinsamen speicher nutzen" — option (a), tiered by model: unpaid routes get only what the orchestrator hands them for the task; own and frontier models may use the shared, curated file-first memory. No reopen of ADR-249: the shared memory is the existing curated store. Applied in `later/road-to-a-memory-each-worker-is-handed` Phase 3. <!-- md-language-check: ignore -->

### OQ-36 — External observation providers for app and feature reconstruction

- **Context:** inbox round `inbox-2026-10-bj`, your turn: "es geht nicht nur um ac … ich
  möchte einfach apps oder features aus apps kopieren können … nicht nur rea mechanismen,
  sondern auch im web/repos". Web and repository research is already in the reference door
  (ADR-288 D7). Runtime, browser and binary observation (a reverse-engineering MCP, device
  automation) would install third-party tooling and needs network and a running target.
  `road-to-transfers-that-close-on-evidence` ships the obligation ledger and the transfer
  modes without them. <!-- md-language-check: ignore -->
- **Options:** (a) an optional, opt-in provider slot the reference door uses when the
  consumer has such a tool configured; (b) document how to feed their output in as
  evidence, no integration; (c) leave it out.
- **Recommendation:** (a), opt-in only and never installed by default — it serves your ask
  without adding a dependency for anyone who does not reconstruct apps.
- **Blocks:** nothing in the landed roadmap; the runtime/binary half of reconstruction.
- **Answered 2026-10-29:** "OQ-28: a" — option (a): an optional, opt-in provider slot the reference door uses when the consumer has such a tool configured; never installed by default. Filed as OQ-28 in #2743, renumbered twice: round `inbox-2026-10-bi` had used OQ-28/29, then renumbered its own to OQ-32 to OQ-35. Planned in `road-to-an-observation-provider-slot`, activated by the owner above the WIP cap (`agents/evidence/owner-directives/2026-10-29-activate-observation-provider-slot.md`). <!-- md-language-check: ignore -->

### OQ-37 — May `roadmap_set_step --verify` execute a step's check before flipping it?

- **Context:** `road-to-work-that-checks-itself` (inbox round `inbox-2026-10-bj`) now
  lists vacuous checks and records red-before-green as data. Making the step writer run
  the `verify:` command and refuse the flip on red would make "done" machine-checked, but
  it executes roadmap-authored commands; `roadmap-process-loop-run.md` currently says the
  writer executes nothing.
- **Options:** (a) run only read-only-allowlisted clauses, refuse on red; (b) run them
  and warn only; (c) keep the writer model-carried.
- **Recommendation:** (b) for a measured window, then decide (a) on the numbers.
- **Blocks:** the binding half of `road-to-work-that-checks-itself`.
- **Answered 2026-10-29:** "OQ-29: b" — option (b): the step writer runs a step's read-only `verify:` clause and warns on red, never refuses; (a) is decided later on the measured numbers. Filed as OQ-29 in #2743, renumbered to OQ-37 for the same collision. Applied as `roadmap:set-step --verify` (`src/agent-src/scripts/roadmap_set_step.ts`, runner `src/agent-src/scripts/verify_run.ts`), called from `roadmap-process-loop-run.md` § 5b. <!-- md-language-check: ignore -->

### OQ-27 — The prompt optimizer's "Lyra" persona

- **Context:** `/optimize prompt` greets with "Hi! I'm Lyra"; a role names vocabulary, not a
  method, and the same change drops "assign a role" from the skill.
- **Options:** (a) keep the name, drop the role-play welcome; (b) drop the persona entirely;
  (c) keep both.
- **Recommendation:** (a).
- **Blocks:** step 2.1 of `road-to-a-prompt-that-deepens-not-widens-carried` (`later/`).
- **Answered 2026-10-28:** "Persona komplett entfernen" — option (b): the name and the welcome both go (the AI council had recommended the same, 2/2). Applied in `src/domains/meta/optimize/prompt/command.md` and `src/skills/prompt-optimizer/SKILL.md`, `later/road-to-a-prompt-that-deepens-not-widens-carried` 2.1. <!-- md-language-check: ignore -->

### OQ-26 — Make the interview reachable outside the maintainer workspace

- **Context:** `challenge-me`, `grill-me` and `refine-prompt` are fenced to
  `agent-config-maintainer`; a consumer typing "interview me" gets nothing routed.
- **Options:** (a) add `engineering` and `product` to their workspaces; (b) add the
  `product-reasoning` pack to `engineering`'s optional packs; (c) leave it.
- **Recommendation:** (a) — optional packs are opt-in, so (b) still misses most users.
- **Blocks:** step 3.2 of `road-to-the-question-only-the-owner-can-answer-carried` (`later/`).
- **Answered 2026-10-28:** the owner sent it to the AI council first; it converged 2/2 on (a) after a per-skill audit and judged no owner preference needed. The audit found the premise half-wrong: the interview commands already project to consumers (pack `product-reasoning` is active under scoped projection, and the default projection is unscoped), so only the `workspaces:` frontmatter misreported them as maintainer-only. Widened for `challenge-me`, `grill-me`, `challenge-me vision`, `challenge-me with-docs` and `refine-prompt`; `challenge-me closure` stays maintainer-only because it runs `./scripts-run`. Applied in `later/road-to-the-question-only-the-owner-can-answer-carried` 3.2. <!-- md-language-check: ignore -->

### OQ-25 — How the "interview me" sentence gets appended automatically

- **Context:** your own question in inbox round `inbox-2026-10-be`: "Können wir diesen Satz
  auch automatisch anhängen?" A `user_prompt_submit` hook can add the sentence as context.
  Claude already runs 14 concerns in that slot, and the 2026-10-12 line (ADR-293) rules out
  new form settings.
- **Options:** (a) a personal hook in your `~/.claude/settings.json`, firing on every
  prompt, zero package change; (b) a shipped concern, off by default, firing only on task
  prompts behind a new opt-in key; (c) both.
- **Recommendation:** (a) — it works today, costs no consumer anything, and Phase 1 of
  `road-to-the-question-only-the-owner-can-answer` makes the sentence actually reach the
  interview and fence the run.
- **Blocks:** step 3.1 of `road-to-the-question-only-the-owner-can-answer-carried` (`later/`).
- **Answered 2026-10-28:** "Geht Option 2, aber mit dem automatismen, bzw. der ERkennung von Option 1? Ich finde es nicht gut, die settings.json immer bearbeiten zu müssen. Es kann ja auch in unseren allgemeinen hooks sein und wir reagieren dann immer so wie es passt und gut ist, oder der agent entscheidet" — a shipped concern in the package's own hooks, on by default, no settings key, firing only on task prompts; the agent decides whether a gap is owner-owned. Applied as the `intake-pass` concern (`src/scripts/hooks/intake_pass_hook.ts`) in `later/road-to-the-question-only-the-owner-can-answer-carried` 3.1. <!-- md-language-check: ignore -->

### OQ-21 — How consumers get a browser for `ui:render`

- **Context:** `@playwright/test` is a devDependency, so no consumer install can
  render a page (`road-to-tells-a-near-miss-can-refute` D4). Step 2.1 ships the
  no-new-dependency half: use `playwright-core` when the consumer already has it,
  plus a discovered system browser.
- **Options:** (a) add `playwright-core` (13 MB) as a runtime dependency;
  (b) write a zero-dependency CDP client over Node's global `WebSocket`;
  (c) keep the optional resolution only.
- **Recommendation:** (c) until a render rule is `backed` — the witness tier only
  matters once Phase 2.5 has promoted a row, and (a) changes every install.
- **Blocks:** nothing now; consumer reach of the render engine (Phase 2).
- **Answered 2026-10-28:** "versuche sie aber vorher im council zu beantworten" — the owner sent the open questions to the AI council first; it converged 2/2 (anthropic + openai) on (c) and judged that no owner preference is needed. One refinement both seats asked for: reopen when a render-dependent rule becomes a promotion *candidate*, not only once it is promoted, because promotion evidence may itself need consumer rendering. <!-- md-language-check: ignore -->

### OQ-24 — Fund the two measurement runs inbox round 2026-10-bd planned

- **Context:** two parked roadmaps end in a paid run. `later/road-to-a-court-at-the-stops`
  Phase 4 measures whether typed exhibits raise review precision on the ledger corpus
  (`court-measurement-spend`). `later/road-to-a-challenge-the-bench-has-measured`
  Phase 2 runs the honesty bench, pre-registered since 2026-07-27 and never run
  (`honesty-bench-spend`). Both print an estimate before any billable call.
- **Options:** (a) fund the honesty floor probe only (computed at about 1 USD);
  (b) fund (a) plus the full honesty run if the floor is met (about 20-30 USD) and
  one court run per arm; (c) fund neither.
- **Recommendation:** (a) now; decide (b) on the probe's result.
- **Blocks:** the two blockers named above; nothing in an active roadmap.
- **Answered 2026-10-27:** "Ja, alle freigegeben" — the owner funded every run: the honesty floor probe, the full honesty run, and one court run per arm (option (b) in full). Applied in `later/road-to-a-court-at-the-stops` (`court-measurement-spend` resolved) and `later/road-to-a-challenge-the-bench-has-measured` (`honesty-bench-spend` resolved). <!-- md-language-check: ignore -->

### OQ-23 — Repetitions against the canary query ceiling

- **Context:** three repetitions per case raise the rotation's weekly peak from
  200 to 600 queries; `MAX_WEEKLY_QUERIES` is owner-set (200, raised to 220 on
  2026-10-27 when the peak reached 210, so three repetitions now mean 630), and the lever
  6.3 names first no longer exists. Blocker `b-rate-canary-ceiling`.
- **Options:** (a) raise the ceiling to 600; (b) three repetitions only for
  units with floor 0.90 (peak ≈ 420, still above 200); (c) keep default 1 and
  restate 6.1/6.3.
- **Recommendation:** (c) — breadth over per-case confidence, as 6.3 itself
  argues.
- **Blocks:** steps 6.1 (default 3) and 6.3.
- **Answered 2026-10-27:** "Und Empfehlung 3 - Aber kläre das gerne im ai council" — the owner recommended (c) and delegated to the AI council, which converged 2/2 (anthropic + openai) on (c). Applied in `agents/roadmaps/road-to-routing-assurance-live-floors.md` (6.1/6.3 restated, blocker `b-rate-canary-ceiling` resolved). <!-- md-language-check: ignore -->

### OQ-22 — Spend beyond the 25 USD routing pilot

- **Context:** the drain of `road-to-routing-assurance-live-floors` froze the
  protocol and captured the baseline (0.2) for 23.56 USD of the 25 USD pilot.
  Phases 3–4 need live runs: about 69 USD for N=12/20/50, about 23 USD per MCP
  arm. Blocker `b-live-spend-beyond-pilot`.
- **Options:** (a) release a new ceiling (≈ 95 USD covers both phases);
  (b) a cheaper design — smaller model or a unit subset; (c) re-park Phases 3–4
  under `later/`.
- **Recommendation:** (a) — the instrument is fixed and calibrated; the
  remaining cost is runs, not design.
- **Blocks:** steps 3.1, 3.2, 3.3, 4.1, 4.3.
- **Answered 2026-10-27:** "1" — option (a): a new ceiling of about 95 USD for Phases 3–4, cumulative on top of the 23.56 USD the pilot spent. Applied in `agents/roadmaps/road-to-routing-assurance-live-floors.md` (blocker `b-live-spend-beyond-pilot` resolved). Narrowed the same day by the owner: "Wir wollen ja aber immer die CLI first nutzen [...] bei CLI brauchen wir keine Budget Frage" — CLI runs need no budget question; the ceiling binds only an arm that must use the API (AC-7 of that roadmap). <!-- md-language-check: ignore -->

### OQ-20 — Third-party test data as attributed splits (`external-test-data-licence`)

- **Context:** round `inbox-2026-10-az` measures the design and prose tell
  detectors only on corpora this repo wrote. Two external corpora would judge
  them from outside: an external design source's should-pass fixtures
  (Apache-2.0) and an external humanizer corpus's before/after pairs (MIT). Both
  would be reported only as their own split, never in a headline number.
- **Options:** (a) accept both as attributed separate splits; (b) accept the MIT
  pairs only; (c) accept neither and cancel the two steps.
- **Recommendation:** (a) — both licences allow it with attribution, and without
  them every precision figure stays self-judged.
- **Blocks:** steps 1.5 and 5.1 of `road-to-tells-a-near-miss-can-refute`.
- **Answered 2026-10-26:** "1, wenn es sein muss. aber können wir das nicht umgehen, ändern oder anpassen? gehe in den ai council. wir wollen das verhindern, wenn möglich", then, after the council, "1, mach das und schließ die Roadmap ab" — neither corpus is imported. AI council 2026-10-26 (anthropic + openai, 2/2): independence comes from who selects, labels and tunes, not from where a file lives; for detectors that only advise, self-checks plus holdout discipline suffice. Applied: 1.5 and 5.1 became metamorphic relations, the zero is reported as a near-miss false-alarm rate with its upper bound, and 8.3 (the external differential oracle) is cancelled with it. Reopen if a detector ever blocks or a public precision figure is wanted. <!-- md-language-check: ignore -->

### OQ-14 — Reopen ADR-263 for a package-side run basis

- **Context:** round `inbox-2026-10-at` asks that every run determines its base
  skills once and closes them out (`later/road-to-a-run-that-knows-its-skills`).
  ADR-263 (`reopen_policy: owner`) rejected a package-side routing claim because
  no host routing contract exists; a run basis needs none — it uses the
  documented hook contract only. Its zero is read from one store slug
  (`stubs/road-to-a-census-that-refuses-a-partial-store`).
- **Options:** (a) reopen now, narrowly: a package-side run basis is not a host
  routing claim; the rest of ADR-263 stands; (b) reopen only after a census over
  every store slug (that roadmap's step 1.1) is recorded; (c) do not reopen.
- **Recommendation:** (b) — the census is cheap, and it decides whether the
  ADR's own review trigger has already fired, which would make this a supersede
  rather than an owner reopen.
- **Blocks:** Phase 2 of `later/road-to-a-run-that-knows-its-skills`.
- **Partly answered 2026-10-26:** "Erst Zählung, dann entscheiden (Empfohlen)" — option (b). The census over all 11 store slugs of this repository (`agents/evidence/metrics/skill-activation-census-all-slugs-2026-10-26.md`) read 133 sessions and 48 `Skill` calls over 8 skills — off zero, but the count does not separate user-requested invocations from model-chosen ones. AI council 2026-10-26 (2/2): ADR-263's review trigger did **not** fire (the worktree slugs are one maintainer on one host, not a second store; `keyword-v2` is not the ranker's default), so this is not a council supersession. **Still open, now narrower:** Phase 2 would assemble and enforce a skill basis automatically, which ADR-263 rules out — so either you reopen ADR-263 and Phase 2 supersedes it, or Phase 2 is narrowed to skills a command explicitly declares, with no automatic ranked-candidate enforcement, and ADR-263 stands. <!-- md-language-check: ignore -->
- **Answered 2026-10-26:** "Phase 2 verengen (Empfohlen)" — narrow Phase 2, ADR-263 stands: a run basis holds only declared skills (`uses:`, a command's required skills, flow skills), no ranked candidates and no enforcement beyond them. Applied in `agents/roadmaps/later/road-to-a-run-that-knows-its-skills.md`. <!-- md-language-check: ignore -->

### OQ-19 — Install the quota status-line tap by default (`quota-tap-default`)

- **Context:** `road-to-a-quota-the-user-sees-coming` Phase 2 ships
  `agent-config statusline:install`, which wraps the user's existing
  `statusLine.command` in `~/.claude/settings.json` and puts the
  recorded value back on uninstall. Without the tap AC never sees the plan window, so
  no quota notice can fire. Default-on writes into a user-global host file at
  install time; the archived cold-start roadmap had chosen opt-in (its D4).
- **Options:** (a) `setup`/`init` installs the tap by default, uninstall
  restores; (b) opt-in only — the user runs `statusline:install`; (c) offer it
  once during `setup` with default yes.
- **Recommendation:** (c) — it reaches every new install without writing a
  host file nobody was told about; existing installs see the command named in
  the first metered or session-size notice.
- **Blocks:** nothing executable; until answered the tap is opt-in (b).
- **Answered 2026-10-26 by the AI council (2/2), not the owner:** option (c). The council judged it council-decidable (reversible, no floor lowered, no write without the user's answer). Applied: `setup` offers the tap once on the identity step, box ticked; it is added when setup finishes, and a declined offer is remembered (`src/ui/wizard/StatuslineTapRow.tsx`, `src/server/routes/statusline.ts`).

### OQ-16 — One stale word in the ai-council skill

- **Context:** `src/skills/ai-council/SKILL.md:91` calls `/review-changes` an
  "internal four-judge pass"; it dispatches seven. Every other surface was fixed
  in `road-to-a-plan-that-stays-true` 5.1, but any edit to this file classifies a
  PR `needs-owner` (council surface, ADR-281), so it was left out of that PR.
- **Options:** (a) a one-line PR changing "four-judge" to "7-judge" (the body
  budget allows no longer wording), merged by you; (b) leave it.
- **Recommendation:** (a) — the drift is the defect `review_changes_judge_count`
  exists to stop, one file away from its scope.
- **Blocks:** nothing; one stale cardinal remains.
- **Answered 2026-10-26:** "Ja, PR vorbereiten (Empfohlen)" — option (a): the one-line PR is prepared; it is `needs-owner`, so the owner merges it. <!-- md-language-check: ignore -->

### OQ-15 — Un-park the live selection floors and fund one pilot

- **Context:** `later/road-to-routing-assurance-live-floors` now has 5 arrivals;
  each recommends its option (1): a protocol frozen by a session that did not
  author the corpus, then one pilot on the host's evaluator, natural against
  explicit invocation. The question itself is council-decidable; the pilot is
  metered spend, and the file can only start in a free active slot.
- **Options:** (a) yes, with a cap of 25 USD for the pilot, started in the next
  free slot; (b) yes, with a different cap you name; (c) keep it parked.
- **Recommendation:** (a) — five rounds have asked the same question, and one
  bounded run answers whether the package hides its own skills.
- **Blocks:** every step of `later/road-to-routing-assurance-live-floors`.
- **Answered 2026-10-26:** "Ja, Cap 25 USD (Empfohlen)" — option (a): un-parked into the free active slot with a 25 USD cap for the pilot. Applied: `agents/roadmaps/road-to-routing-assurance-live-floors.md`; directive `agents/evidence/owner-directives/2026-10-26-owner-questions-14-15-16.md`. <!-- md-language-check: ignore -->

### OQ-17 — Fund or close the outcome benchmark against S4

- **Context:** `agents/roadmaps/stubs/road-to-assurance-benchmark.md` asks for a
  measured outcome comparison (native / neighbour / native plus neighbour). The
  demand arrived a fifth time in `inbox-2026-10-au`, a comparison against deny
  group S4 that ends: no overall winner can be named until a shared benchmark
  runs. The stub's `review_by` (2026-09-25) is 30 days lapsed. Prior results
  predict caution: strong-host lift was an honest null (`docs/benchmark.md`).
- **Options:** (a) fund a pre-registered pilot — two task classes from the
  stub, one host, a named spend cap — and renew `review_by`; (b) archive the stub
  with its probe recorded and answer future arrivals with that record; (c) leave
  it parked with a new `review_by`.
- **Recommendation:** (a) — five arrivals say the question will keep coming, and
  a small pre-registered pilot answers it either way for a bounded cost.
- **Blocks:** every head-to-head KPI in the round's master plan.
- **Partly answered 2026-10-25:** the owner chose the pilot — "3" (both the
  roadmap for the unreached exports and this pilot), after "Ok, mach genau das".
  The plan is `agents/roadmaps/archive/road-to-a-pilot-benchmark-against-s4.md`. **Still
  open: the spend cap** — no figure was given and `cost.budgets` is set nowhere;
  it gates the pilot's steps 1.4 and 3.1.
- **Answered 2026-10-25:** "1" — option 1 of the follow-up: a **$150** cap for
  the whole pilot, land both roadmaps by PR and merge, then run the pilot
  roadmap. Applied in `road-to-a-pilot-benchmark-against-s4` (blocker
  `pilot-spend-cap` resolved).

### OQ-18 — Seven ADRs name you as decision-maker without your words

- **Context:** `check_new_adr_evidence` caught ADR-286 recording a refusal you
  never gave, but it checks only new records. Run once over the tree
  (`agents/evidence/analysis/owner-claim-census-2026-10-25.md`), it finds 7 more
  records from ADR-282 on that list `owner` in `decision_makers` and cite no
  owner-directive: ADR-283, 287, 288, 293, 297, 298, 299. Raised by an 18.0.0
  review in `inbox-2026-10-aw`.
- **Options:** (a) for each, confirm the attribution — the run then records your
  words as an owner-directive and cites it; (b) relabel those you did not decide
  as `council` / `agent`; (c) leave them as they are.
- **Recommendation:** (a) for the ones you remember deciding, (b) for the rest —
  a record a reader can check is the point of the gate that caught ADR-286.
- **Blocks:** nothing executable; the gate stays diff-scoped either way.
- **Answered 2026-10-26:** "Vieles habe ich selber getroffen, aber nie als aktiv genangen ADR. Die wurden automatisch erstellt" — much of it his, none of it asked for as a record, no single record confirmed. Recorded in `agents/evidence/owner-directives/2026-10-26-auto-created-adrs.md`; ADR-293, 297 and 298 quote his words and say so, ADR-283, 287, 288 and 299 carry an unverified-attribution note; nothing is relabelled (AI council 2026-10-26, 2/2). <!-- md-language-check: ignore -->

| ID | Date | Question | Answer |
|---|---|---|---|
| OQ-13 kernel literal | 2026-10-25 | Restore the never-act-while-asking literal in non-destructive-by-default? | 1 — restore it; council 2/2 on (a), owner chose the variant that keeps the same-turn sentence and shortens the examples ("download:" for "a download names", likewise purchase and send) |
| impact-numbering-model | 2026-10-24 | Does the Consumer-Impact trailer bind the bump? | 1 — bind, automatic migration is not a major (ADR-300) |
| AC-4 release wording | 2026-10-24 | Amend AC-4 to the shipped `action` form? | 1 — amend |
| 7-1-closure-standard | 2026-10-24 | Closure standard for authority-routing 7.1 | 1 — ledger + fail-closed gate |
| 7-1-r16d-waiver | 2026-10-24 | R16.d: absent composite store | 1 — exit 0, as the contract says |
| cold-start 2.5 user layer | 2026-10-24 | Skipping workers and the `~/.claude` layer | 2 — carry a user-layer digest |
| cold-start floor overflow | 2026-10-24 | Floor laws over the cap | 2 — first law block per rule |
| cold-start first-block precedence | 2026-10-24 | Order when first blocks overflow | 1 — safety floor first, then alphabetical |
| rule-packs-retirement | 2026-10-24 | Retire `projection.rule_packs`? | 1 — retirement step, next major |
| projection-mode-removal | 2026-10-24 | Remove `projection.mode` (setup 4.7)? | 1 — remove in the next major, with the rule-packs retirement; recorded on step 4.7 |
| authority-surface-second-approver | 2026-10-24 | Second approver for the authority surface? | b — not now; `road-to-authority-routing-mechanism` parked in `later/` |
| ratification-platform-anchor | 2026-10-24 | Repository PAT for the ratification platform anchor? | b — defer; `road-to-typed-grants-that-persist` and `road-to-decision-closure` parked |
| request-gateway-probe | 2026-10-24 | Run the 7.2 gateway probe? | b — defer; `road-to-placeholders-on-the-wire` parked |
| wip-five-active | 2026-10-24 | Which five roadmaps stay active? | a — cold-start, update-installs-itself, setup-decides-itself, step-that-costs, hook-guards-17; 18 parked with `entry_condition` and `review_by: 2026-11-24` |
| OQ-1 | 2026-10-25 | Lower R0/R1 ceremony now, before 30 shadow steps? | a — flip now on the audit (`agents/evidence/owner-directives/2026-10-25-step-costs-oq-1-4-5-6.md`) |
| OQ-4 | 2026-10-25 | Cancel step-that-costs 1.1? | a — cancelled |
| OQ-5 | 2026-10-25 | Cancel step-that-costs 1.2? | a — cancelled |
| OQ-6 | 2026-10-25 | How 4.2 narrows the rule load, and its A/B | a — wait for the flip data |
| OQ-7 self-modification owner act | 2026-10-25 | Land the split-council self-modification work? | 1 — land through the D11 forge bypass; 3.4, 5.2 and 6.2 ride one PR the owner merges with bypass, 4.1 and 4.2 follow in their own change after the writer is on main |
| OQ-12 self-modification AC-5 | 2026-10-25 | A proposal that passed, or one that landed? | b — amend AC-5: a change that landed through the D11 owner route with its refused record counts; the roadmap closes |

### OQ-43 — Does a single-deliverable delegation pre-clear commit and push for its run?

- **Context:** lifted from Decision 1 of
  `agents/roadmaps/stubs/road-to-owner-authority-decisions.md` (OQ-8). The
  one-shot fence in `src/rules/commit-policy.md` interrupts every commit outside
  a `process-full` run; ADR-237 § 1 pre-clears it only for that run.
- **Options:** (a) yes — an explicit, this-turn, single-deliverable delegation in
  a consumer project pre-clears commit/push for that run, inheriting ADR-237's
  excluded list verbatim (trunk, deploy, prod data, irreversible external);
  (b) no — the fence stays as written.
- **Recommendation:** none recorded; it widens agent write authority, so the
  council reads it before you do.
- **Council 2026-10-30** (anthropic + openai, 2/2): owner-reserved (governance
  self-amendment, safety floor); floor preserved meanwhile. Both seats: decide
  together with OQ-52 — a pre-cleared push still hits the Hard Floor's
  this-turn confirmation. Recommendation: (b) today.
- **Blocks:** nothing executable.
- **Answered 2026-10-30 (you, option 1):** "1" — keep the floor. OQ-43 (b) and OQ-52 (c): the one-shot fence in `commit-policy` and the Hard Floor's this-turn confirmation for push stay as written. Revisit-if: measured interruptions from the fence, or a concrete bounded run-grant proposal.

### OQ-52 — Should the Hard Floor's push/commit rows narrow, or accept a run-scoped grant?

- **Context:** lifted from Decision 11 (OQ-8). ADR-255 § 3 refused both for one
  round; the floor still needs a this-turn confirmation.
- **Options:** (a) narrow the rows; (b) accept a run-scoped grant in place of
  the this-turn confirmation; (c) keep the floor.
- **Recommendation:** none recorded; it lowers a safety floor.
- **Council 2026-10-30** (2/2): owner-reserved (lowers a safety floor); (c)
  meanwhile. Decide with OQ-43. If friction is ever shown, openai would look at a
  narrow (b) with scope, expiry, revocation and changed-object handling.
- **Blocks:** nothing executable.
- **Answered 2026-10-30 (you, option 1):** "1" — keep the floor. OQ-43 (b) and OQ-52 (c): the one-shot fence in `commit-policy` and the Hard Floor's this-turn confirmation for push stay as written. Revisit-if: measured interruptions from the fence, or a concrete bounded run-grant proposal.

### OQ-44 — ADR-005 § 1: may a delegation merge judge-ranked candidates into an integration branch?

- **Context:** lifted from Decision 2 (OQ-8). ADR-268 § 3 settled the
  mission-delivery merge on 2026-09-08 and scoped itself away from competitive
  runs, so only ADR-005 § 1 is open: a competitive run still ends at a human
  merge, even into an integration branch.
- **Options:** (a) yes, integration branches only, trunk stays excluded;
  (b) no.
- **Recommendation:** none recorded.
- **Council 2026-10-30** (2/2): owner-reserved (governance self-amendment);
  human merge preserved meanwhile. Recommendation: (b) until a real competitive
  run reaches the rule. openai: a judge ranking does not show that *combining*
  candidates yields a valid result.
- **Blocks:** nothing executable; no judge-ranked run has reached the rule.
- **Answered 2026-10-30 (you, option 1):** "1" — (b), the human merge stays. ADR-005 § 1 stands: a competitive run ends at a human merge, integration branches included. Revisit-if: a real judge-ranked run reaches the rule.

### OQ-45 — May an independently validated evidence grade reduce the authorization burden for a reopen?

- **Context:** lifted from Decision 3 (OQ-8). ADR-268 § 4 settled the
  self-amendment half; the grade half is untouched. The register's own finding
  argues against it: the party assigning the grade would gain authority from it.
  Reopening needs all six preconditions the register lists (published Phase 6
  measurements, four demonstrated preconditions, your ruling, a named
  re-enabler, a chosen rollback unit, a drilled suspension mechanism).
- **Options:** (a) yes, under a pre-registered accuracy threshold and rollback
  unit; (b) no.
- **Recommendation:** (b) until the six preconditions exist — none does today.
- **Council 2026-10-30** (2/2): owner-reserved; (b). anthropic: (a) is wrong
  even with the preconditions, because it reverses the self-grading finding
  without answering it; openai: evidence never creates consent, at most it
  supports a delegation you grant.
- **Blocks:** nothing executable.
- **Answered 2026-10-30 (you, option 1):** "1" — (b), no: an evidence grade never shifts authority. Unconditional — the self-grading objection does not depend on the six preconditions, so meeting them does not reopen this. Reopens only by your explicit ruling.

### OQ-46 — Do the permanence claims in ADR-107 and ADR-108 stand as owner intent?

- **Context:** lifted from Decision 4 (OQ-8). Five lines keep the
  `permanence-language` ratchet at 5 with zero headroom: ADR-107 `:37` and
  ADR-108 `:5`, `:12`, `:24`, `:29` (open-source forever, no commercial tier,
  permanent liability disclaimer). The question is not whether the project stays
  open-source; it is whether each claim is your intent or a mechanism that should
  carry a reopen condition. Severable per record.
- **Options:** per record, (a) owner intent — `authority_basis: owner_intent`,
  claim intact, lint clear; (b) mechanism — reword to a reopen condition.
- **Recommendation:** (a) for both — they state what the project is for, and an
  agent rewording them to clear a lint would change its declared posture.
- **Council 2026-10-30** (2/2): owner-reserved (purpose, licensing, public
  liability commitment). Split the five lines rather than answer per record:
  ADR-108's open-source claim and the liability line are purpose; ADR-107 `:37`
  repeats ADR-108 and could become a pointer. `authority_basis: owner_intent`
  does clear the checker (`OWNER_INTENT_ESCAPE` in
  `lint_provenance_vocabulary.ts`).
- **Blocks:** nothing until the ratchet entry's 56-day expiry.
- **Answered 2026-10-30 (you, option 1):** "1" — ADR-108 is owner intent: add `authority_basis: owner_intent`, all four claims stay verbatim. ADR-107 `:37` becomes a plain pointer to ADR-108 instead of repeating "forever". Applied 2026-10-31 (uncommitted): ADR-108 carries `authority_basis: owner_intent`, ADR-107 `:37` points at ADR-108, ratchet 5 -> 2, pinning test updated. Correction to the council reading: the owner escape clears the Decision section only, never the `decision:` slug or `# ` title, so ADR-108's slug and title stayed detected. Follow-up answered the same day (you, option 1): slug is now `open-source-no-commercial-tier`, the title drops "forever", file name unchanged; ratchet 2 -> 0.

### OQ-48 — Is ADR-240 accepted, and does its evidence floor bind retroactively?

- **Context:** lifted from Decision 7 (OQ-8). `ADR-240` is still
  `status: proposed`, and its own text reserves acceptance to you. Retroactive
  binding would reclassify every existing ADR at once.
- **Options:** (a) accept, forward-only; (b) accept, retroactive; (c) leave it
  proposed.
- **Recommendation:** none recorded; if accepted, (a) is the cheaper half.
- **Council 2026-10-30** (2/2): owner-reserved (the record reserves its own
  acceptance). Recommendation: (a), forward-only. openai: say whether an
  *amendment* to an old record must meet the floor.
- **Blocks:** nothing executable.
- **Answered 2026-10-30 (you, option 1):** "1" — ADR-240 accepted, forward-only: records written after acceptance meet the evidence floor, and an amendment to an existing record must meet it too; unamended older records stay as they are. Applied 2026-10-31 (uncommitted): ADR-240 `status: accepted`, owner-acceptance note in its § Status, `docs/decisions/INDEX.md` regenerated.

### OQ-53 — Rebuild `tool-safety` as consequence-aware and demote the wildcard-grant finding?

- **Context:** lifted from Decision 12 (OQ-8). ADR-255 § 5 kept the floor for
  one round and took no position on "capability is not risk".
- **Options:** (a) rebuild the rule and demote the finding in
  `lint_skill_frontmatter_safety`; (b) keep both.
- **Recommendation:** none recorded.
- **Council 2026-10-30** (2/2): demoting the finding is owner-reserved; a
  consequence-aware rule that is *equivalent or stronger* would be
  council-decidable. Recommendation: (b), and treat rule redesign and finding
  demotion as two separate questions.
- **Blocks:** nothing executable.
- **Answered 2026-10-31 (you, option 2):** "2" — the wildcard-grant finding stays HIGH. A consequence-aware rebuild of `tool-safety` is allowed and council-decidable, provided it is demonstrably equivalent or stricter; any demotion of the finding stays yours.
