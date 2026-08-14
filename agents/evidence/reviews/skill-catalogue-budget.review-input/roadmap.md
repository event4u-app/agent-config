<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: lightweight
status: ready
parent_roadmap: road-to-frontend-skill-application
---

# Road to a measured skill-catalogue budget — Codex as the second host

> The catalogue-delivery defect is already measured, and its measurement is
> stuck: one observation, one host, verdict `no-selector`, corpus filled by
> hand. **Codex CLI reports its own truncation as a machine-readable event** —
> which makes it the second host that blocker needs, converts the self-reported
> half of the capture into a deterministic one, and supplies direct evidence for
> the one branch the parent roadmap left conditional.

## Context

This roadmap feeds
[`road-to-frontend-skill-application`](road-to-frontend-skill-application.md).
It does **not** re-open that roadmap's Phase 1 and does not build a parallel
measurement — the instrument already exists as
`src/scripts/capture_skill_catalogue.ts`, and its docstring's split of
**projection** (deterministic) from **observation** (self-reported) is the right
shape. What is missing is a host that can fill the observation side without a
human transcribing it.

### The reported symptom, reproduced rather than pasted

```
$ codex exec "reply with exactly: OK"
warning: Exceeded skills context budget. All skill descriptions were removed
         and 667 additional skills were not included in the model-visible
         skills list.
```

On the JSON channel the same fact arrives structured — `codex exec --json`
emits `{"type":"item.completed","item":{"type":"error","message":"Exceeded
skills context budget. All skill descriptions were removed and 667 additional
skills were not included…"}}`. That is the load-bearing detail of this whole
roadmap: **the host publishes its own truncation count.** No self-report, no
transcription, no agent reading its own context.

### Why this is the missing piece, not a duplicate

The parent's `blocker: ui-session-capture-window` resolves only when
`agents/evidence/metrics/skill-catalogue.jsonl` holds **≥ 20 observations
across ≥ 2 hosts**. Verified state of that corpus: **one** line, `host: claude`,
`entries_total: 336`, `bare_count: 16`, `described_count: 19`,
`verdict: no-selector`. The blocker's own text names the gap precisely — *"a
selector that only shows up on one host is exactly what the current
`no-selector` verdict cannot distinguish from no selector at all"* — and names
why the corpus does not grow: *"Capture is a script plus a labelled self-report,
so the corpus does NOT fill by itself."*

Codex answers both halves at once:

- It is a **different host**, so it addresses the ≥ 2 requirement.
- Its observation half is **deterministic**, so on this host the corpus can fill
  without a human in the loop.

### Two selectors, and they are not the same shape

This is the substantive finding and it is why one more host was worth having.

On **claude** the parent recorded that all 16 bare entries *declare* a
description, and that described entries reach position #325 while bare entries
start at #45 — which no head-N budget explains, hence `no-selector`.

On **codex** the host states the selector itself: a **budget**, discharged by
stripping *every* description and then dropping entries wholesale. Measured
volume on this machine: `~/.codex/skills` holds 298 skill directories,
`~/.codex/commands` holds 200 command bodies across 101 directories, and the
skills' `description:` payload alone is **60,483 bytes ≈ 15k tokens**.

So the two hosts appear to truncate by **different mechanisms**. If that holds,
`no-selector` on claude was never evidence that no selector exists — it was
evidence that claude's is not budget-shaped, which is exactly the confound the
blocker warned about.

### The conditional branch this discharges

The parent's Phase 2 Step 2 reads: *"If the selector is estate size — project a
workspace-scoped skill subset at install."* It is open and conditional because
nothing had established estate size as the selector. Codex's own message —
"Exceeded skills context **budget**" — is direct evidence for that branch on
that host. Phase 3 below turns it from a quoted string into a recorded
observation, which is what the parent step needs in order to fire.

### Verified supporting facts

1. **The projection is wholesale.** `_CLAUDE_SKILL_BUNDLE`
   (`src/scripts/install.ts:1909`) is `[rules, skills, commands, personas]`,
   assigned unchanged to 13 hosts in `GLOBAL_DEPLOY_SOURCES` — `codex` among
   them. Nothing between the source tree and the host trims by size.
2. **No budget concept exists under that name.** `grep -rn -i "skills context
   budget"` over `src/` and `docs/` returns zero hits. The suite gates the
   always-loaded *rule* layer (`check_always_budget`) and per-artefact *size*
   (`size-enforcement`); a host's catalogue limit is ungoverned.
3. **The existing mitigation cannot fire by default.** `projection.mode: scoped`
   (`_resolve_scoped_projection`, `install.ts:3544`) narrows a global deploy to
   the active packs, but its contract resolves a **missing** key to
   `legacy-all`, and on the reporting machine the key is present and explicitly
   `legacy-all`. A change to the packaged default would migrate nobody.

### Not established, and deliberately not load-bearing

The codex arithmetic closes well — 298 skills + 200 commands counted **twice**
= 698, against 667 dropped + ~31 surviving = 698 — which would mean hosts list
each command under both a dash-flattened (`roadmap-process-full`) and a
namespaced (`roadmap:process-full`) name. **This is inference, not
observation**, and it was flagged in both council rounds as the one claim not to
build on. Checked and still open: commands are not duplicated into `skills/`,
and the Claude plugin that would supply a second naming scheme is not installed.

Nothing below depends on it. Even at the conservative count — no duplication at
all — ~498 artefacts are projected and ~31 survive.

### A second, independent defect found while running the council

The council's `openai` seat is structurally dead, and it fails while reporting
success. Both runs recorded `absent_members: [{member: openai, reason:
unavailable, detail: exit_1}]` while stdout printed `council:quorum ·
concluded`. Two reproduced causes:

- **The pinned model.** `codex exec --json --model gpt-4o -` returns `400
  invalid_request_error: The 'gpt-4o' model is not supported when using Codex
  with a ChatGPT account.` The council config pins `model: gpt-4o`, and its
  `model_ladder` entries share the restriction.
- **The trust gate.** The captured `stderr_tail` is `Not inside a trusted
  directory and --skip-git-repo-check was not specified.`, and `_build_command`
  (`src/scripts/ai_council/clients.ts:1730`) emits `[codex, exec, --json,
  --model, <model>, -]`, omitting that flag. This also explains the standing
  observation that the openai seat dies in a worktree: a fresh worktree path is
  never a trusted directory.

A two-member council printing `concluded` over one answer is the
fabricated-evidence shape `evaluator-independence` exists to prevent, so it is
sequenced early — every later council consultation is worth less until it is
fixed.

## Non-goals

- **Not re-opening the parent's Phase 1.** The instrument exists; this adds a
  host to it.
- **Not deleting or merging skills to fit a limit.** Whether 298 skills is the
  right number is a separate question.
- **Not flipping any default that silently narrows what an existing install
  already receives.** Over-shipping stays the safe direction.
- **Not adding activation triggers.** That 0 skills declare one is real and was
  raised in council, but it is an independent track.
- **Not refusing at install time.** Warn, never block — see Phase 1.

## Execution status (2026-08-15)

Phases 1, 2 and 3 are closed — 12 of 14 steps, 8 of 9 acceptance criteria.
Phase 4 stays open on its own user blocker. Evidence:
[`skill-catalogue-budget-codex`](../evidence/analysis/skill-catalogue-budget-codex.md).

**Four premises moved when they were re-measured, and two of them made the
plan's case stronger rather than weaker.**

1. **The `gpt-4o` pin was NOT machine-local.** A screening pass reported the
   shipped default as `gpt-5` and concluded the plan's Phase 2 Step 4 rested on
   the reporter's own config. Both readings were incomplete: the shipped
   *template* (`agents/templates/.ai-council.yml.example`) pinned `gpt-4o`, and
   the shipped *code default* was `gpt-5` — **and a ChatGPT-account codex
   refuses both**, reproduced on every argv shape. So the seat was dead for
   every subscription user on either path, which is worse than the plan said.
   Both are now the `auto` sentinel, and both are covered by a measured
   deny-list that refuses the call before it spends quota.
2. **The trust-gate cause was narrower than stated.** "The openai seat dies in
   a worktree" does not reproduce: a worktree inside a trusted repo IS trusted,
   and `--skip-git-repo-check` changed nothing there. It is decisive from a
   genuinely untrusted CWD (a temp dir, a fresh clone), where `codex exec`
   refuses outright and emits no JSON. The flag ships; the reason is corrected.
3. **The `concluded`-over-silence defect was already half-fixed, on the wrong
   surface.** Round 7 shipped the DEGRADED marker on the CLI's stdout line and
   not on the artefact renderer stdout was mirrored FROM. Stdout scrolls away;
   the artefact is what gets committed and cited. The marker now ships on both,
   with one wording so neither can drift into being the softer one.
4. **The 698 double-count reading is RULED OUT** — from host output, as the
   step demanded, not from arithmetic. Baseline stable at 393 across two runs
   from one directory; +5 project-local skills moved it to exactly 398. Each
   artefact is counted once.

**One defect this work introduced and then found.** The first real capture
reported 297 skills offered against 393 dropped — more dropped than offered —
because the projection root covered skills only while the host counts skills
*and* commands. Clamping the subtraction would have published a confident
`survivors: 0`. Under-coverage is now a named condition that refuses to derive
a survivor count across the gap, and `--command-root` supplies the missing half.

**The instrument is a maintainer script, not a CLI verb.** There is no
`capture:skill-catalogue` registered anywhere; it runs as
`./scripts-run src/scripts/capture_skill_catalogue`.

**One thing the maintainer has to do for their own seat.** The user-global
`.ai-council.yml` still pins `model: gpt-4o` on a `cli · subscription`
transport. Editing that file is a self-config change routed through the
edit-permission gates, so it was not touched: set it to `auto` and the seat
answers again. Until then the pass now names the cause instead of printing the
opaque `exit_1` it printed before.

## Phase 1: Make the codex budget observable and deterministic

- [x] Extend `capture_skill_catalogue` with a codex observation source that
      parses the `codex exec --json` error event into `entries_total` and a
      dropped count, recorded as a **deterministic** observation rather than a
      self-report. Keep the record type free of any field able to hold prompt
      text or user content, per the script's stated privacy-by-construction.
      `verify:` a captured codex run records an observation whose dropped count
      equals the number in the host's own message.
- [x] Extend the observation record with a `truncation_mode` distinguishing
      "host stripped all descriptions and dropped N" from the claude-shaped
      per-entry case, so one corpus can hold both without averaging two
      different mechanisms into one meaningless verdict.
      `verify:` the existing claude observation still validates and reports
      unchanged under the extended schema.
- [x] Report projected catalogue volume per host — artefacts, entry count,
      description bytes — so the projection half is stated next to the
      observation half instead of being recomputed by hand.
      `verify:` run against `~/.codex` and confirm the reported description
      payload matches a direct measurement of the same tree.
- [x] Warn at the end of a global deploy when a host with a **known** limit
      would be exceeded, naming the count, the limit, and the command that
      explains it. Silent for hosts whose limit is unknown — an unmeasured host
      gets no invented number.
      `verify:` a deploy to a codex-shaped fixture prints the warning; an
      unknown-limit host prints nothing.

## Phase 2: Repair the council's openai seat

- [x] Pass `--skip-git-repo-check` in the codex `_build_command`, so a run from
      a worktree or any untrusted directory reaches the model.
      `verify:` a run from a fresh worktree returns a non-empty response.
- [x] Validate the configured model against the resolved transport **before**
      spending, and fail loudly when a subscription transport cannot serve it,
      naming the model, the transport, and the supported set.
      `verify:` a config pinning `gpt-4o` on the CLI transport is rejected with
      that message instead of being billed and returning `exit_1`.
- [x] Stop printing `concluded` for a run whose members did not answer. The
      defect is the success line, not the absence.
      `verify:` a run with one dead member exits non-zero, or prints a verdict
      that cannot be read as convergence.
- [x] Correct the shipped council-config template so a subscription-authed
      `openai` member is seeded with a model that transport serves.
      `verify:` a freshly seeded config returns a live response without
      hand-editing.

## Phase 3: Feed the parent's corpus and settle its conditional branch

- [x] Record codex observations into
      `agents/evidence/metrics/skill-catalogue.jsonl` until the corpus carries
      two hosts, and report whether the two hosts' truncation modes differ.
      `verify:` `capture_skill_catalogue` reports a per-host verdict rather than
      one pooled verdict.
- [x] State whether codex's evidence discharges the parent's Phase 2 Step 2
      condition ("if the selector is estate size"). A negative answer is a
      result: it would mean the budget message is not estate-size evidence and
      the branch stays conditional.
- [x] Settle the command double-count question from host-observable output
      rather than arithmetic — a controlled change in the projected command set
      moves the host's own dropped count by a measurable delta.
      `verify:` the delta is reported alongside the projected command count that
      produced it, and the conclusion names which reading it rules out.
- [x] Record the outcome either way, "unresolved" included.

## Phase 4: A migration path for scoped projection

Gated on Phase 1's numbers, Phase 3's verdict, and the blocker below — this is
the only phase that can change what a consumer receives, so it moves last.

- [ ] Write the migration path as an explicit **choice**, not an imposed
      default: keep everything and accept truncation, scope to active packs, or
      select manually. A writer that imposes `scoped` substitutes the
      maintainer's judgment for the user's.
      `verify:` an existing install with explicit `legacy-all` is not modified
      without an answer, and every branch is reachable.
- [ ] Make the packaged default meaningful for fresh installs only, so the
      upgrade-compat contract stays intact.
      `verify:` an install carrying a settings doc keeps its resolved mode.

## Acceptance Criteria

- [x] **A:** a codex observation lands in the existing corpus with a dropped
      count taken from the host's own output, not from a self-report.
- [x] **A:** projected catalogue volume per host is a reportable number, and
      crossing a known limit is visible at deploy time rather than only inside
      a host session.
- [x] **A:** no host limit is declared without the measurement it came from.
- [x] **B:** a two-member council run either returns two answers or reports a
      verdict that cannot be mistaken for convergence.
- [~] **B:** the openai seat returns a live response from a worktree.
      **Deferred, and the reason is not the seat.** The argv the client now
      builds — `codex exec --json --skip-git-repo-check -`, no `--model` —
      returns a live answer from this worktree, verified directly on
      2026-08-15, and a test pins that the client builds exactly that argv.
      What blocks the *council-path* proof is the shared openai quota bucket,
      standing at **68/50**: a `--confirm` run refuses on `cli_quota_exhausted`
      before reaching the transport. Resetting a cap the user deliberately set
      is theirs (`council:quota --reset`), so the criterion is left open rather
      than closed on the two halves that were provable.
- [x] **C:** the corpus holds two hosts, and whether their truncation modes
      differ is published either way.
- [x] **C:** the parent's Phase 2 Step 2 condition is answered — discharged or
      explicitly still conditional.
- [x] No existing install has what it receives narrowed without an explicit
      answer from its owner. Nothing in Phases 1–3 narrows a projection; the
      only phase that could is 4, and it is blocked on its owner.
- [x] All quality gates pass — see `quality-tools`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-15 | reviewer: claude-opus-5 -->

**Re-review after executing Phases 1–3.** Risk 1 is CLOSED by construction
rather than by discipline — the codex path does not call `analyzeSelector` at
all, so a pooled verdict is unreachable, not merely discouraged. Risk 3 FIRED
in a milder form than written: the host's wording held, but its *number* moved
with the working directory (393 vs 401 on the same estate), which is the same
lesson one step earlier — a count is only meaningful next to the conditions it
was taken in. Risk 4 is RESOLVED: the delta experiment ruled the inference out
from host output, and no phase had built on it. Risk 5 FIRED, and it is now the
live one: the seat is repaired in code while the openai quota sits at 68/50, so
verdicts recorded in the interval are still DEGRADED and must stay labelled.
Risk 2 is unchanged and untouched — Phase 4 never started.

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Pooled verdict across unlike hosts | product | The parent's corpus holds one verdict field. Feeding codex into it without distinguishing mechanisms averages a budget-shaped truncation with a per-entry one and can report a confident `no-selector` that describes neither host. That would corrupt the very measurement the parent's Phase 2 is gated on. | Add `truncation_mode` to the record and report a per-host verdict; never a pooled one. The existing claude observation must still validate unchanged. | Phase 1 |
| 2 | Narrowing an existing install | product | Scoped projection reduces what a consumer receives. Applied without an answer from the owner it silently removes surfaces someone may rely on, and the loss is invisible until a skill is missing mid-task. | Migration is an explicit choice with all three branches reachable; the packaged default moves for fresh installs only; the decision itself is a user-owned blocker. | Phase 4 |
| 3 | Brittle dependence on host wording | implementation | The dropped count is read out of a host-emitted message. A reworded or removed message makes the capture report zero, which is indistinguishable from a fixed defect — the failure mode would look like success. | Parse the structured JSON event rather than the human-readable line, and treat an unparseable or absent event as a loud failure, never as a zero observation. | Phase 1 |
| 4 | The 698 reading is inference | product | The command double-count closes the arithmetic exactly, which is persuasive and unproven. Building a payload estimate or a host limit on it would put a guess into a table other work then cites as measured. | Every phase is written to hold at the conservative count; the reading is marked as inference in the plan; the delta experiment settles it from host output or records it unresolved. | Phase 3 |
| 5 | Council evidence quality shifts underneath recorded verdicts | implementation | Repairing the seat changes a one-member council into a two-member one. Verdicts already recorded elsewhere were produced DEGRADED, and a silent upgrade would make old and new verdicts look equally strong. | The fix makes non-convergence explicit rather than upgrading it silently; previously recorded DEGRADED verdicts stay labelled as such where they are cited. | Phase 2 |

## Blockers

### blocker: scoped-default-decision

- **Status:** open
- **Owner:** user
- **Blocks:** Phase 4
- **What to do:** decide whether the shipped default for fresh installs becomes
  `scoped`, and whether the migration writer may prompt an existing install at
  all. Both are consumer-visible defaults, so neither is an agent decision.
  Phase 1's measured numbers and Phase 3's verdict are the inputs this decision
  waits on.
- **Resolved when:** the user states the default for fresh installs and whether
  prompting an existing install is permitted.
