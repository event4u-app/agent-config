---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "The consumer-side answer to the round's playbook demand has no owner in the estate. Merging into road-to-typed-grants-that-persist was rejected because that file owns the authority model, not what a consumer writes down; folding into stubs/road-to-target-project-bootstrap-enforce was rejected because that stub is demand-gated on quality tooling; parking in later/ was rejected because both phases are executable today."
relates:
  - slug: road-to-typed-grants-that-persist
    relation: disjoint
    note: "Draft. Owns autonomy and grants; the per-task-type autonomy ledger the source proposed stays there or nowhere, never here."
  - slug: road-to-target-project-bootstrap-enforce
    relation: disjoint
    note: "Stub. Owns quality-tool bootstrap in a consumer repo; this file owns the written goal and no-gos only."
---
# Road to a project contract written down

> **Source:** `agents/tmp.old/inbox-2026-10-i/` — a transcript in which the owner
> named the subject of a short video (an external reference: a derivative
> playbook of a vendor post on human-agent teams) and asked how this package
> gets better from it, plus the supplied plan's delta phase that mapped the
> playbook's four lessons onto the tree. Re-verified against `origin/main` @
> `d41121927` (v16.4.0) on 2026-10-11. Steps marked
> `corrected-from-reproduction` carry the wording the reproduction forced.

## Goal

A consumer repo that ran `/agents:init` carries, in its own `AGENTS.md`, a
written goal and a written list of no-gos beside the architecture and
conventions the initializer already asks for; a read-only report says which of
the four are present; and every no-go that names a path or a command can, with
the consumer's consent, become a deny rule the host enforces instead of a
sentence the agent may read past. Nothing is fabricated for the consumer and no
company content ships in the package.

## Context

- **The playbook's first lesson — "what is not written does not exist for the
  agent" — has half a receiver.** `/agents:init` asks five questions
  (`src/domains/meta/agents/init/command.md:84-97`): name, one-line
  description, architecture style, user-facing strings, additional conventions.
  It asks for no goal and no no-gos. The consumer guide's optional copy-in
  sections (`src/agent-src/contexts/contracts/consumer-agents-md-guide.md`)
  cover tech stack, setup, structure, testing and quality tools — none for a
  goal or a no-go. A grep for "north star" across `src/`, `docs/contracts/` and
  `README.md` returns only internal uses, none on a consumer surface.
- **The template cannot carry new sections.** `lint_agents_md` holds the
  consumer template (`src/agent-src/templates/AGENTS.md`) to a 2,500-character
  fail cap; it measured 2,495 at this file's base and **2,499 since
  2026-10-12**, when step 1.5 of
  `road-to-self-modification-that-a-council-must-pass` had to say in that
  pointer line where a kernel rule changes. `corrected-from-reproduction`: the
  supplied plan put the sections into a `CLAUDE.md` written by `init`; `init`
  only detects `CLAUDE.md` (`src/install/detect.ts:76`), the consumer entry
  point this package writes is `AGENTS.md`, and the template has five
  characters of headroom — so the sections go into the consumer's filled file
  and the guide, never into the template.
- **No consumer no-go is enforceable today.** The `pre_tool_use` deny concerns
  (`block-kernel-rule-writes`, `block-plumbing-writes`, `block-config-weakening`
  and siblings in `src/scripts/hook_manifest.yaml`) guard this package's own
  surfaces; none reads a consumer-authored list. Nothing under `src/install/`
  writes a `permissions` block into a consumer's settings file.

## Phase 1 — The two questions the initializer does not ask

- [x] **1.1 Two copy-in sections in the consumer guide.** The guide gains
      `## Goal section (optional copy-in)` and `## No-gos section (optional
      copy-in)`, each with a short shape: the goal as one to three sentences a
      plan can be checked against; the no-gos as bullets, each naming a path,
      a command, a dependency, or a behaviour. The guide states why these two
      belong in the always-loaded file when its default is "leave AGENTS.md
      thin": they bind every turn.
      verify: `grep -c '^## No-gos section (optional copy-in)' src/agent-src/contexts/contracts/consumer-agents-md-guide.md` -> /^1$/
- [x] **1.2 The initializer asks them, one at a time.** `/agents:init` step 3
      gains two questions after "Architecture style": the goal, then the
      no-gos. An empty answer omits the section and is reported in step 8 —
      never filled with a default. The sections are written into the consumer's
      filled `AGENTS.md` below the template content; the template file is not
      edited. `corrected-from-reproduction` (see Context).
      verify: `grep -c 'No-gos' src/domains/meta/agents/init/command.md` -> /^[1-9]/
- [x] **1.3 A read-only report: N of 4.** `report_project_contract` reads a
      consumer `AGENTS.md` and prints which of goal, no-gos, architecture and
      conventions are present, as `N of 4` plus the missing names; it writes
      nothing and never infers a section from other prose. `/agents:init`
      step 8 calls it. A fixture with a goal and no
      no-gos reads `3 of 4` only when architecture and conventions are present
      too, and the test is seen red before the reader exists.
      verify: `npx vitest run tests/scripts/report_project_contract.test.ts` -> 0

      **Closed 2026-10-12. The reader's load-bearing part is a fence skip**,
      and it is not tidiness: the consumer guide ships every one of these
      headings INSIDE a ```markdown fence as copy-in material, so a reader
      without it reports the guide itself as a complete contract. Proved by
      neutralising it — one case reds — and by running the reader over the live
      guide, which reports `0 of 4`. The "does not infer" case pins the other
      half: a file saying "our goal is to delight every user" in prose reads as
      having no goal, because a goal the agent recognises is still a goal
      nobody wrote.

## Phase 2 — A no-go that names a path or a command is enforced

> **Re-screened 2026-10-13 against the tree, and the recorded price turned out
> to be for the wrong purchase.** The 2026-10-12 screen was right that
> `host_lowering.yaml` is agent-writable and that editing it costs an
> independent ratification record. What it had not measured is that the pin
> cannot be READ there: `_structure()` in `src/scripts/hooks/host_lowering.ts`
> reads only named hook keys, so a `permissions:` block would be dropped from
> the typed table while still moving the compiled body's fingerprint and
> forcing both the recompile and the ratification. The price was real; what it
> bought was a comment.
>
> Put to the AI council on 2026-10-13 (design mode, deep, `anthropic` +
> `openai`, 2/2 present, $0.00 subscription transport). Both seats refused that
> home on the table's own declared subject — "how each host lowers a dispatcher
> verdict into its own hook contract" — and both required a provenance gate in
> place of the ratification the move avoids. D5 and D6 record the outcome;
> `agents/evidence/council/no-go-deny-pin-home-20261013.md` is the record.
>
> So no plumbing file is touched by this phase and no ratification artifact is
> owed. The syntax is still not taken from this file: it was read from the
> host's own permission documentation on 2026-10-13 and pinned with that URL
> and date.


- [x] **2.1 Classify each no-go bullet.** A pure function sorts each bullet
      into `path`, `command` or `prose`, and returns the deny rule it would
      become in the host's documented permission-rule syntax for the first two
      kinds. The syntax is checked against the host documentation when the step
      is implemented and pinned with its `docs_url`, not taken from this file.
      A bullet the function cannot classify is `prose`, never guessed.
      verify: `npx vitest run tests/install/no_go_classify.test.ts` -> 0

      **Closed 2026-10-13.** `classifyNoGo` in `src/install/noGoRules.ts` emits
      `{kind, token, action}` and NOTHING host-specific; `denyRulesFor` in
      `src/install/hostPermissionsAdapter.ts` turns that into the host's
      spelling and carries the pin. The split is D5's, not a style choice: a
      classifier that resolves a host row is not the pure function this step
      asked for.

      Four signals must agree or the verdict is prose: exactly one backticked
      token, a NEGATION, an action verb after it, and no clause break between
      the verb and the token. The first two alone made "`vendor/` is generated"
      prose. The last two were added by the completion review, which measured
      the classifier rendering a deny row over the command a bullet
      RECOMMENDS — "Never run migrations in production - use `php artisan
      migrate --pretend` instead" denied the escape hatch named in its own
      sentence. A no-go section is not the only place a backticked command
      appears beside a verb.

      **A command bullet renders TWO rows. The first stated reason was WRONG,
      and the correction is the step's real finding.** It read: "`Bash(x *)`
      requires a space after `x`, so the with-arguments form never matches the
      bare command." The documentation says the opposite one line above the
      sentence that was read — "A `*` at the end, with a space before it, also
      matches the bare command." An independent completion review caught it
      after this step was already marked closed.

      The true reason is the page's own qualifier: the bare-command match
      "holds only when the trailing `*` is the rule's only wildcard". A
      consumer token carrying its own `*` breaks that, and the exact row is
      what still guards the plain command then. One row would be right for most
      tokens and silently wrong for those.

      **What the episode is actually evidence of:** a pinned quote is only as
      good as the lines around it. The pin now records the qualifier verbatim
      beside the example, so the next reader sees the condition rather than
      reconstructing it.
- [x] **2.2 Shown, consented, appended.** After 1.2, `/agents:init` prints the
      rows 2.1 produced and asks once whether to add them. On yes it appends
      them to the consumer's settings file's deny list, keeping every
      existing entry and its order; on no it writes nothing. `prose` bullets are
      reported as instruction-only. On a host with no native deny list the step
      reports the rows as instruction-only and writes nothing.
      verify: `npx vitest run tests/install/no_go_deny_rows.test.ts` -> 0

      **Closed 2026-10-13.** `/agents:init` step 6b shows
      `./scripts-run src/scripts/no_go_deny_rows AGENTS.md`, which writes
      nothing, then asks once. The decline path is the ABSENCE of a second
      call rather than an undo — the command's default is read-only, so there
      is no window in which a skip has to be reversed.

      The append is a textual splice, not a parse-and-reserialise: every byte
      outside the insertion point is the byte that was there before. Risk 4 is
      a rewrite dropping or reordering a user entry, and a re-serialising
      writer is exactly how that happens while every value-level assertion
      stays green.

- [x] **2.3 Seen to block.** The deny-row test's fixture no-go "never edit
      `migrations/`" yields a deny row; a second fixture asserts an existing
      user deny entry survives the append byte-for-byte, and a third asserts a
      declined consent leaves the file unchanged.
      verify: `npx vitest run tests/install/no_go_deny_rows.test.ts -t preserves` -> 0

      **Closed 2026-10-13, and the byte-for-byte assertion was WRONG on its
      first pass.** Neutralising the splice — replacing it with
      `JSON.stringify(root, null, 2)` — left all twenty tests green, because
      the fixture happened to be formatted the way canonical stringify output
      is formatted. A fixture that matches canonical output cannot tell a
      splice from a rewrite. The fixture is now four-space-indented with a
      one-line array, and the sibling value-level assertion stays green —
      which is the discrimination the pair is for.

      This line claimed "the same probe reds exactly one test". A round-3
      review re-ran the probe and measured **four**, across two files. The
      figure was written before the CLI suite existed and was never
      re-measured; it is corrected here rather than quietly swapped, because
      an under-claim is still a number nobody checked.

## What this roadmap deliberately does not do

- **No persona lowered to a host subagent, no generated roster.** ADR-109
  rejected projecting personas as a subagent subtype (`ADR-109:54`, `:171`);
  the supplied plan's persona-to-subagent step is the rejected mechanism, and
  the one shipped verifier, `production-validator`, already gates "done".
- **No north-star claim and no plan-gate criterion on it.** No measured
  comparison of goal-anchored against task-anchored work exists; a section the
  agent reads is the whole adoption.
- **No autonomy ledger.** The authority model is owner-ruled in ADR-268 and
  received by `road-to-typed-grants-that-persist`; raising autonomy from
  evidence is not decided here.
- **No company or project content in the package** — generalised mechanics
  only; the consumer's goal and no-gos live in the consumer's file.
- **No setup-prompt skill.** The playbook's copyable prompt is prose; the
  mechanics above carry its effect with a test behind them.

## Acceptance Criteria

- [x] AC-1 — `/agents:init` asks for a goal and for no-gos, writes only what
      the consumer answered, and never edits the shipped template.
      Steps 3.4 and 3.5 ask; step 4 writes the sections into the consumer's
      filled file and says in place why the template is not touched.
      `git log --oneline -- src/agent-src/templates/AGENTS.md` carries nothing
      from this roadmap.
- [x] AC-2 — `report_project_contract` prints `N of 4` for a consumer
      `AGENTS.md` and writes nothing.
- [x] AC-3 — A no-go naming a path becomes a host deny row only after consent,
      and existing deny entries survive unchanged.
      Discharged by `tests/install/no_go_deny_rows_cli.test.ts`, which runs the
      command this criterion is about. It was a prose record of a manual run
      until the completion review pointed out that an acceptance criterion
      about a CLI, verified only by a sentence, is unverifiable from the tree —
      and that both blocker-class defects of this change lived in that untested
      half.
- [x] AC-4 — No file under `src/` ships a consumer's goal or no-go content.
      Every bullet under `src/` is a fixture of this package's own example —
      `migrations/`, `php artisan migrate:fresh`, `.env` — and the two
      sections live only in the consumer's filled file.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | Sections go into the filled consumer `AGENTS.md` and the guide, not the template | Template 2,499 chars against a 2,500 fail cap (`lint_agents_md.ts:58`) — 2,495 when this was decided, and **one** character of headroom since 2026-10-12. The decision is unchanged and now rests on a harder fact: nothing of any size fits in that file without a subtraction in the same change | The template's cap is raised by its own owner |
| D2 | reversible-technical | agent | Enforce through the host's native deny list, not a new `pre_tool_use` concern | A concern costs hook-bundle bytes and binds on every install; a consented, consumer-authored deny row changes nothing for a consumer who declines | A hook host without a native deny list asks for the same enforcement |
| D3 | reversible-technical | agent | Two new questions only | Architecture and conventions are already asked (`init/command.md:92-97`) | The report in 1.3 shows architecture or conventions missing on most filled files |
| D4 | reversible-technical | agent | Unclassifiable bullets stay prose | A guessed deny row on a vague sentence blocks legitimate work silently | A classifier error rate is measured on real consumer files |
| D5 | reversible-technical | council:2026-10-13 design, 2/2 present | **Step 2.1's named home is superseded.** The pin lives in `src/install/hostPermissionsAdapter.ts`, a typed per-host row carrying `docs_url`, `docs_at`, a chosen review-by date, the deny key and verbatim examples. The classifier stays host-neutral and emits `{kind, token, action}`; the adapter alone knows a host's spelling. No plumbing file is touched and no ratification artifact is owed | Measured before asking: `_structure()` in `host_lowering.ts` reads only named hook keys, so a `permissions:` block there is dropped from the typed table and read by nobody — while still moving `body_fingerprint` through `compile()` and pulling the diff into `PLUMBING_SOURCE_RE`. The literal instruction cost a ratification record and bought a comment. AI council 2026-10-13, design mode deep, `anthropic` + `openai`, 2/2 present, $0.00 subscription transport; both seats refused the hook table on its own declared subject — lowering a dispatcher verdict into a hook contract, which a permission rule is not — and both refused the run-time-lookup variant as contradicting the word "pure" in this step. Record: `agents/evidence/council/no-go-deny-pin-home-20261013.md` | A second non-hook per-host fact needs the same lifecycle — then a governed host-capabilities registry, which both seats named and both refused for one row |
| D6 | reversible-technical | council:2026-10-13 design, 2/2 present, split recorded not resolved | **No authority label is asserted; the split effect is recorded instead.** The generated deny row REDUCES the agent's execution authority; the installer GAINS authority to mutate a consumer-owned settings file, after an explicit consent prompt that writes nothing when declined | One seat read this as a consented authority expansion — new enforcement capability plus a write to a consumer boundary. The other held the label is taxonomy-dependent, named the two directions above, and asked for the split to be recorded rather than a label chosen without a cited taxonomy. The narrower reading was taken, as it was on the fetch question in D5's record | This package records an authority taxonomy that settles which direction the label follows |
| D7 | reversible-technical | council:2026-10-13 design, 2/2 present | The provenance control is `src/scripts/check_permission_deny_syntax`, run in CI as a step in `.github/workflows/rule-backstops.yml` AND exercised by `tests/scripts/permission_deny_syntax.test.ts`. It fetches nothing. It is NOT registered in `src/config/gate-coverage.yml`. **The workflow step is not decoration:** a round-2 review measured that with the test as the only carrier, the staleness verdict could never fire — the test pins `--today` to the read date, so `expires` was unreachable against a real clock, and the one thing this decision calls "the drift signal" was evaluated by nothing. The step passes no `--today` | Both seats required a provenance control as the replacement for the ratification D5's placement avoids, and one named the risk directly: moving the fact out of the gated tree could bypass scrutiny rather than correctly avoid irrelevant governance. On the shape, the seats split — one wanted a live documentation fetch and a six-month expiry, the other refused the fetch as nondeterministic and the six months as unsupported by evidence; the narrower reading was taken, so the review-by date is the drift signal and no network call runs in a build. Not registered because a newly registered gate owes a `--self-test` with a `--root` fixture seam, and this gate's corpus is a typed constant with no tree to point one at; the test file drives the real argv path and carries a rejecting case per shape the gate can report, including four that neutralise the RENDERER rather than the pin | A second host pin lands, or the gate acquires a file corpus a `--root` seam can address |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-11 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A deny row blocks legitimate work | product | A broad path no-go stops an edit the consumer later needs, and the agent cannot say why | Rows are shown before consent; each row names the bullet it came from; the guide documents removing one — § "Removing a deny row your no-gos produced", added 2026-10-13 after a round-3 review found this mitigation listed and never built. The consent screen also states where the rows reach FURTHER than the bullet reads, which is this risk's real shape | Phase 2 — A no-go that names a path or a command is enforced |
| 2 | The always-loaded file grows | product | Long goal or no-go sections add tokens to every turn on every host | The guide's shape caps each section at a few lines; 1.3's report prints the section sizes | Phase 1 — The two questions the initializer does not ask |
| 3 | The deny syntax is guessed | implementation | A row in the wrong syntax is accepted by the file and enforced by nothing | 2.1 pins the syntax to the host documentation with a `docs_url`; 2.3 asserts the produced row, not only that a row was written | Phase 2 — A no-go that names a path or a command is enforced |
| 4 | Writing the settings file clobbers it | implementation | Rewriting the settings file drops a user entry or reorders it | 2.2 appends, never replaces; 2.3 asserts byte-for-byte survival | Phase 2 — A no-go that names a path or a command is enforced |

## Provenance

Source ids from the supplied plan, by disposition: W6.1 → Phase 1
(`corrected-from-reproduction`); W6.2 → Phase 2; W6.5 → the goal section only,
plan criterion and suggestion anchor declined (K13); W6.3, W6.4 → declined on
ADR-109 (E9 moot); W6.8 → declined, receiver named (E10); W6.6, W6.7, W6.9 →
declined or already satisfied in the round's ledger; K14, K15, K16 → carried as
non-goals; E11 (interview over silent scaffold) → adopted as 1.2.
