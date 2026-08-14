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

## Phase 1: Make the codex budget observable and deterministic

- [ ] Extend `capture_skill_catalogue` with a codex observation source that
      parses the `codex exec --json` error event into `entries_total` and a
      dropped count, recorded as a **deterministic** observation rather than a
      self-report. Keep the record type free of any field able to hold prompt
      text or user content, per the script's stated privacy-by-construction.
      `verify:` a captured codex run records an observation whose dropped count
      equals the number in the host's own message.
- [ ] Extend the observation record with a `truncation_mode` distinguishing
      "host stripped all descriptions and dropped N" from the claude-shaped
      per-entry case, so one corpus can hold both without averaging two
      different mechanisms into one meaningless verdict.
      `verify:` the existing claude observation still validates and reports
      unchanged under the extended schema.
- [ ] Report projected catalogue volume per host — artefacts, entry count,
      description bytes — so the projection half is stated next to the
      observation half instead of being recomputed by hand.
      `verify:` run against `~/.codex` and confirm the reported description
      payload matches a direct measurement of the same tree.
- [ ] Warn at the end of a global deploy when a host with a **known** limit
      would be exceeded, naming the count, the limit, and the command that
      explains it. Silent for hosts whose limit is unknown — an unmeasured host
      gets no invented number.
      `verify:` a deploy to a codex-shaped fixture prints the warning; an
      unknown-limit host prints nothing.

## Phase 2: Repair the council's openai seat

- [ ] Pass `--skip-git-repo-check` in the codex `_build_command`, so a run from
      a worktree or any untrusted directory reaches the model.
      `verify:` a run from a fresh worktree returns a non-empty response.
- [ ] Validate the configured model against the resolved transport **before**
      spending, and fail loudly when a subscription transport cannot serve it,
      naming the model, the transport, and the supported set.
      `verify:` a config pinning `gpt-4o` on the CLI transport is rejected with
      that message instead of being billed and returning `exit_1`.
- [ ] Stop printing `concluded` for a run whose members did not answer. The
      defect is the success line, not the absence.
      `verify:` a run with one dead member exits non-zero, or prints a verdict
      that cannot be read as convergence.
- [ ] Correct the shipped council-config template so a subscription-authed
      `openai` member is seeded with a model that transport serves.
      `verify:` a freshly seeded config returns a live response without
      hand-editing.

## Phase 3: Feed the parent's corpus and settle its conditional branch

- [ ] Record codex observations into
      `agents/evidence/metrics/skill-catalogue.jsonl` until the corpus carries
      two hosts, and report whether the two hosts' truncation modes differ.
      `verify:` `capture_skill_catalogue` reports a per-host verdict rather than
      one pooled verdict.
- [ ] State whether codex's evidence discharges the parent's Phase 2 Step 2
      condition ("if the selector is estate size"). A negative answer is a
      result: it would mean the budget message is not estate-size evidence and
      the branch stays conditional.
- [ ] Settle the command double-count question from host-observable output
      rather than arithmetic — a controlled change in the projected command set
      moves the host's own dropped count by a measurable delta.
      `verify:` the delta is reported alongside the projected command count that
      produced it, and the conclusion names which reading it rules out.
- [ ] Record the outcome either way, "unresolved" included.

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

- [ ] **A:** a codex observation lands in the existing corpus with a dropped
      count taken from the host's own output, not from a self-report.
- [ ] **A:** projected catalogue volume per host is a reportable number, and
      crossing a known limit is visible at deploy time rather than only inside
      a host session.
- [ ] **A:** no host limit is declared without the measurement it came from.
- [ ] **B:** a two-member council run either returns two answers or reports a
      verdict that cannot be mistaken for convergence.
- [ ] **B:** the openai seat returns a live response from a worktree.
- [ ] **C:** the corpus holds two hosts, and whether their truncation modes
      differ is published either way.
- [ ] **C:** the parent's Phase 2 Step 2 condition is answered — discharged or
      explicitly still conditional.
- [ ] No existing install has what it receives narrowed without an explicit
      answer from its owner.
- [ ] All quality gates pass — see `quality-tools`.

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
