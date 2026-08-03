---
complexity: structural
status: ready
---

# Road to release truth — one final source, findings with dispositions, bounded autonomy

> **Source:** four independent external release reviews of 9.11.0–9.14.0
> (2026-08-02, local transcript `agents/tmp.old/feedback-9.14.0-1.txt`).
> Council disposition 2026-08-03 (claude-sonnet-4-5 + gpt-4o, 2 rounds): land
> a SINGLE focused release-truth roadmap carrying only the items that close
> recorded failures; cross-reference (never duplicate) what the renewal set
> and `road-to-gates-that-can-fail` already own; REJECT the reviews'
> net-reduction targets (skills <275 / commands <175) as numbers without an
> evidence base — if surface reduction is wanted, it needs its own causal
> analysis first.
>
> **Recorded failures this roadmap closes:**
>
> 1. *Release material disagreed with itself at 9.14.0:* the release-PR body
>    said 10,054 tests (+12) and named only the counts work; the merged
>    CHANGELOG section additionally carried `/optimize:deep`, the renewal
>    roadmaps, several CI fixes, and 10,056 tests (+14). PR body, changelog,
>    GitHub release body, and tag metadata were generated at different times
>    from different scopes — ironic for a release about reproducible numbers.
> 2. *Curated release highlights said `_none_` twice while false:* 9.13.0
>    shipped behaviour changes (design-fidelity priority), a removed public
>    trigger type (`intent:`), a permanent mechanism rejection (ADR-054), a
>    security fix (tool grants vs trusted registry) and honest nulls — the
>    curated head claimed none of it. Same pattern at 9.14.0.
> 3. *A critical automated security finding has no traceable disposition:*
>    the 9.14.0 release-PR review reported a symlink-traversal risk in the
>    skill-catalog walk (`iter_skills` dereferences symlinks without a
>    package-root confinement check). The PR merged; the release head says
>    "Security and correctness: none"; whether the finding was fixed or
>    adjudicated false-positive is not reconstructable from the record.

## Locks honored / ownership boundaries

- **Owned elsewhere — cross-reference only, never duplicate:**
  consumer-E2E-on-feature-PR triggers and the CI build-artifact sharing →
  renewal set (`road-to-package-renewal.md` § PR-creation flow findings);
  gate-scope liveness, `assertScanned` adoption, and any gate-manifest work →
  `road-to-gates-that-can-fail.md` (its structural guard) — a generated gate
  manifest is only picked up there if that roadmap's own adjudication wants
  it.
- **REJECTED (council 2026-08-03):** net-reduction targets (skills <275 /
  commands <175). Reopen only with a causal analysis of what surface size
  costs whom (evidence base first, targets second).
- **Commit/scope floors:** all release automation keeps the human on the
  merge; nothing here auto-publishes.

## Phase 1 — one final source for release material

- [ ] The release pipeline emits PR body, `CHANGELOG.md` entry, GitHub
      release body, and tag metadata from ONE final generation step at the
      final head — regenerating on every release-branch update, so late
      commits cannot desynchronize the surfaces.
      *Verify:* fixture release with a late-added commit → all four surfaces
      carry the same content and the same test count.
- [ ] Equality gate: `normalized(release body) == normalized(changelog
      entry)` (whitespace/anchor normalization only — not "similar", equal).
      *Verify:* seeded one-line divergence → red in the release workflow.
- [ ] Test-count single-sourcing: the count appears in exactly one generated
      fragment that every surface includes.
      *Verify:* grep across the four surfaces finds one generated origin.

## Phase 2 — curated highlights that cannot silently lie

- [ ] Highlight plausibility gate: derive generated categories from the
      release span (security-tagged commits, behaviour/default changes from
      conventional-commit types + rule/schema diffs, honest-null markers,
      removed public surface) and FAIL when a populated generated category
      meets a `_none_` curated field. The gate blocks the contradiction; a
      human still writes the prose (no auto-formulated highlights).
      *Verify:* fixture span with a `fix(security)` commit + curated
      `Security and correctness: _none_` → red; correctly curated head →
      green; empty span with `_none_` everywhere → green.
- [ ] Backfill the 9.13.0 and 9.14.0 curated heads in `CHANGELOG.md` with
      accurate entries (behaviour changes, removals, security fixes, honest
      nulls that actually shipped) — the two recorded false `_none_` cases
      get corrected, not just prevented.
      *Verify:* changelog diff reviewed against the two release spans.

## Phase 3 — review findings get machine-readable dispositions

- [ ] Disposition ledger for release-PR review findings: every blocking/high
      finding from the automated self-review carries
      `{finding_id, status: fixed|false_positive|accepted_risk, commit,
      rationale, verified_by}` in a tracked artefact; the release workflow
      fails while any blocking/high finding lacks a disposition.
      *Verify:* fixture PR with an undispositioned high finding → release
      validation red.
- [ ] Retroactively disposition the 9.14.0 symlink finding: verify against
      the tag whether `iter_skills` (skill-catalog walk in the count
      generator path) confines symlink targets to the package root; record
      fixed / false-positive / fix-now with evidence.
      *Verify:* disposition entry exists with a commit or an adjudication
      rationale; if the traversal is real, the fix lands in this phase.
- [ ] Symlink-confinement test battery for the catalog/count walkers:
      internal symlink target allowed; external target rejected or ignored
      safely; symlink loop terminates; broken symlink handled explicitly.
      *Verify:* four permanent tests green; removing the confinement check
      turns them red.

## Phase 4 — bounded autonomy for `/optimize:deep`

> The reviews' P0: an autonomous deep-refactoring loop shipped without
> technically enforced limits, and without appearing in its release's curated
> head (the Phase-2 gate now catches the latter class).

- [ ] Enforce in the command flow itself (not prose): plan-only default;
      `max_iterations: 3` with halt-on-spin; pre-registered target metric
      before loop 1; per-loop verification; stop when two consecutive
      iterations deliver no measurable gain.
      *Verify:* command spec + eval cases pin each limit; a fixture run that
      exceeds an iteration or produces no gain twice → halt.
- [ ] Hard exclusions: no kernel-rule edits (kernel slow-rollout process
      owns those), no public-contract changes without explicit user
      approval, commit/push stays permission-gated per the existing floors.
      *Verify:* eval case — optimize run touching a kernel rule → refusal
      with the kernel-process pointer.

## Success criteria (pre-registered)

- One generation step feeds all four release surfaces; the equality gate is
  red on seeded divergence.
- The highlight gate is red on a seeded category/`_none_` contradiction; the
  9.13/9.14 heads are backfilled.
- Zero blocking/high review findings without a machine-readable disposition
  on any release after this lands; the 9.14.0 symlink finding is
  dispositioned with evidence.
- The symlink battery (4 cases) is green and demonstrably fails when the
  confinement check is removed.
- `/optimize:deep` limits are enforced by the command flow and pinned by
  evals, not described in prose.
