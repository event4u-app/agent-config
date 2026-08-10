# Carrier-layer divergence, classified — the 109 differ in metadata, not in obligation

> **Produced by:** Phase 1 of the carrier-layer-convergence roadmap.
> **Measured:** 2026-08-10 · **Commit:** `a5b2f4cb7` · **Host:** Claude Code
> `2.1.226` · **Checkout:** a freshly regenerated worktree (`task sync` +
> `task generate-tools` run immediately before the reading, per the
> regenerate-before-quoting discipline).
> **Instrument:** `report_carrier_divergence`, plus a one-off frontmatter-strip
> comparison whose logic then landed in the instrument itself as
> `proseEqual`.

## The two questions Phase 1 had to answer

### (1) Classify each of the 109 divergent rules. Per-class totals.

Against the taxonomy the phase names:

| Class | Count | Verdict |
|---|---:|---|
| The global copy is an **older release** of the same rule (a refresh closes it) | **0** | Empty. No global copy carries superseded prose. |
| The project copy is **generated differently** (the generator is the fix) | **109** | The whole set — but the prescribed remedy does not apply, see below. |
| The two carry **genuinely different obligations** (a content decision) | **0** | Empty. Nothing to surface, nothing to decide. |

**All 109 pairs carry byte-identical prose.** The entire difference is the YAML
frontmatter block. Two writers apply two frontmatter policies to the same rule:

- `generate-tools` emits a real file carrying **only** `paths:`, and only where a
  rule is path-scoped — 25 of 110 files in this checkout. The other 85 carry no
  frontmatter at all.
- `install.ts` writes agent-config's full vocabulary (`type`, `tier`,
  `description`, `alwaysApply`, `triggers`, `workspaces`, `packs`, …) plus its
  two ownership keys (`package`, `source_path`) — 114 of 114 files.

Neither policy is wrong, and this is why the phase's own remedy ("fix the
generator so the projection is reproducible rather than patching the output")
has nothing to act on: the projection **is** reproducible. `task sync` followed
by `task generate-tools` at this commit leaves a clean tree — the step's own
verification passes without any change. The difference is deliberate on both
sides: the host reads `paths` and nothing else from this block, so emitting the
rest into the project carrier would be payload the host ignores, while the
installer needs its vocabulary and its ownership stamp for agent-config's own
tooling (uninstall attribution, and the `type: manual` filter this very report
reads from the projection source).

The 109, by name — one class, so the list is flat:

active-remediation, agent-authority, architecture, artifact-drafting-protocol,
artifact-engagement-recording, ask-when-uncertain, augment-edit-discipline,
autonomous-execution, brand-source-of-truth, broken-access-control,
cli-output-handling, code-comment-discipline, code-provenance,
command-suggestion-policy, commit-conventions, commit-policy,
communication-through-line, content-quoting-floor, context-hygiene,
copilot-routing, council-availability, cross-source-consistency,
decision-revisit-gate, delegation-policy, design-fidelity,
design-review-after-ui-write, devcontainer-routing, direct-answers,
doc-screenshot-hygiene, docker-commands, domain-adoption-policy,
domain-safety-disclaimer, domain-safety-pii, domain-safety-retention,
downstream-changes, engineering-safety-floor, evaluator-independence,
external-code-graph-interop, external-reference-deep-dive,
fast-path-marker-visibility, finance-safety-floor,
framework-neutrality-in-generic-skills, git-history-discipline,
history-discipline, icon-consistency, image-likeness-and-rights,
improve-before-implement, invite-challenge, language-and-tone, laravel-routing,
laravel-translations, legal-safety-floor, lethal-trifecta-guard,
linked-projects-onboarding-gate, low-impact-corpus-privacy-floor,
markdown-safe-codeblocks, media-governance-routing, media-sync-ground-truth,
minimal-safe-diff, missing-tool-handling, model-recommendation,
no-attribution-footers, no-cheap-questions,
no-decorative-emojis-in-git-surfaces, no-pr-progress-comments,
no-roadmap-references, non-destructive-by-default, notes-first-reasoning,
onboarding-gate, output-discipline, persona-governance, php-coding,
prefer-enums-over-literals, preservation-guard, provider-lifecycle-discipline,
question-not-instruction, reviewer-awareness, roadmap-ci-steps-policy,
roadmap-progress-sync, role-mode-adherence, rule-type-governance,
runtime-safety, scale-discipline, scope-control, secret-vcs-guard,
security-sensitive-stop, self-repair-loop, senior-engineering-discipline,
session-canary, settings-ask-protocol, skill-improvement-trigger, skill-quality,
slash-command-routing-policy, source-confidentiality, source-discovery-gate,
spreadsheet-source-quality, strategy-safety-floor, symfony-routing,
think-before-action, token-budget-discipline, token-efficiency,
token-optimizer-maintenance, tool-safety, ui-audit-gate,
untrusted-input-defense, upstream-proposal, user-interaction,
user-interrupt-priority, verify-before-complete.

Asymmetric reach at the same reading, recorded because a project-scope figure
does not transfer without it: **1** project-only (`source-of-truth` — newer than
the installed release) and **5** global-only, all of them ADR-004
`type: manual` and therefore expected (`analysis-skill-routing`,
`brand-consistency`, `guidelines`, `package-ci-checks`, `size-enforcement`).

### (2) Name the precedence rule the host actually applies.

**The host applies none.** Rules without a `paths` key are loaded at launch with
the same priority as `CLAUDE.md`, and no precedence marker exists between the
two layers. Cited rather than inferred, from the probed host contract in
`claude-code-rules-dir-contract.md` (host 2.1.226) — the host's own
documentation, verbatim there, plus a first-party observation of a live session
carrying both copies simultaneously.

So the phase's fallback verdict is the operative one: **binding is undefined**
whenever the two carriers disagree. It simply does not follow, at this reading,
that anything disagrees.

This corrects a claim two instruments were printing. Both
`report_carrier_divergence` and `report_conformance_funnel` told the reader
"the project projection is generated from `src/` at this commit **and wins**".
The project copy is indeed the newer text — that is a fact about recency, not a
precedence rule the host implements — and a reader acting on "wins" would have
believed the host resolves something it does not. Both surfaces now state that
binding is undefined and that recency is not precedence.

## What this does to the roadmap's premise

The roadmap opens with two defects wearing one number: a removable share of the
standing-delivery floor, and *"a correctness hole, because when two copies of a
rule differ there is no defined answer to which text binds"*.

**The correctness hole is not there.** No governed text differs, so no
obligation is ambiguous, and no rule can have a claim retracted by one copy and
re-asserted by the other. The duplication is real and measured; the ambiguity is
not.

What remains is a delivery-cost item — and the instrument that measures it says,
in its own header, that it must never acquire a threshold, for the same reason
`report_skill_activation` must not. Two independent recorded findings say the
same thing from the other direction: a carrier-comparison figure may diagnose a
stale install and nothing more, and the parent roadmap routed this measurement
out of its blockers as evidence-deciding-nothing. That reading holds.

The defect actually worth repairing was therefore **in the instrument, not in
the carriers**: a metadata-only difference was being reported as body
divergence, i.e. as the one class the report tells a reader to act on. That is
the precise failure the same function already refuses to commit for an
unreadable copy ("a permission error would otherwise manufacture the only class
this report asks a reader to act on"). It now has a fourth class,
`frontmatter-only`, reported as a count with its explanation.

## Why two earlier readings of the same commit disagreed

A recorded measurement puzzle closes here. At one commit the primary checkout
reported **91 shared / 90 stamp-only / 1 body**, while a freshly generated
worktree reported **109 shared / 0 stamp-only / 109 body**. Rebuilding the
worktree from scratch reproduced 109, which ruled out contamination and left the
discrepancy unexplained.

The explanation is the **emitter generation that produced the project tree**:

| Project tree | Files | Frontmatter | Shape |
|---|---:|---|---|
| Primary checkout (older emitter) | 92 | all 92 carry it | symlinks into `dist/agent-src/rules/` |
| This worktree (current emitter) | 110 | 25 (`paths:` only) | real files |

A symlinked tree inherits `dist`'s full frontmatter, so stripping the two
ownership keys equalizes the pair and it classifies **stamp-only**. A
real-file tree carries no frontmatter to strip, so the same pair classifies
**body-diff**. Same commit, same install, opposite verdicts — the figure is a
fact about when and with which emitter someone last regenerated, on top of how
stale the global install is. The report now says so where it reports a clean
reading.

## Named, not fixed

- **The delivered-payload byte basis is an over-count.** Byte censuses of
  `~/.claude/rules/` include each file's frontmatter, and the host does not
  deliver it: the global copy of `role-mode-adherence` carries eight-plus lines
  of frontmatter on disk and reaches the model as prose starting at its first
  heading. Correcting the basis would move three published baselines and touch
  the standing-delivery gate, so it is recorded here rather than changed under
  this roadmap. Direction of the error is stated: the published payload figure
  is conservative (too high), not optimistic.
- **Phase 3's safety precondition is now met, ahead of its measurement.** The
  phase order exists because suppressing a *divergent* copy drops whatever
  obligations only that copy carried. With prose identical across all 109,
  suppression is a no-op on content — which is what Phase 2 was supposed to
  establish and what this reading establishes directly. The measurement itself
  still needs the maintainer machine, so the phase stays blocked; only its
  premise is discharged.
- **Convergence is point-in-time.** The global layer is a release snapshot, so
  today's reading says nothing about the next release. That was already named in
  the roadmap's risk register and is not repaired here.

## What a re-run should show

On a freshly regenerated checkout against a global install at or behind this
commit: `differ in PROSE 0`, `differ ONLY in frontmatter` equal to the shared
count, and the flat class list above. A non-zero prose count on a later reading
is a real finding and means a rule's governed text genuinely diverged — that is
the number to act on, and the only one.
