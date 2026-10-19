## Acceptance Criteria

- [x] AC-1 — From a subfolder each of the four doors prints the scope line before
      any read; inside an enumerated or detected module it names the module, with
      or without a marker in the module's `agents/`, and keeps the outer project
      as `project_root`. Met 2026-10-19: `analysis_target.test.ts` (15 cases) pins
      the resolver's module and `project_root` semantics;
      `analysis_scope_line_doors.test.ts` is the per-door half and was red on
      `analyze/repo`, which named neither the scope line nor the resolver, until
      its § 1 was given both.
- [x] AC-2 — Every loop, round and fix cycle of the four doors has a numeric cap in
      a `limits:` block, and no door runs until a condition without one (ADR-118).
      Met 2026-10-19: `analyze:inbox` was the one door shipping its caps in prose
      alone and now carries the same five keys as its siblings, pinned by
      `analyze_inbox_limits.test.ts` beside `analyze_repo_limits`,
      `analyze_pr_limits` and `optimize_deep_limits`.
- [x] AC-3 — Each seed and deepen output carries independence stamps and
      references no other analyst; each exchange records its cross-exam targets
      verbatim, a disagreement ledger and a minority audit. Met 2026-10-19:
      `analysis_analysts.test.ts` (19 cases, including an output that consulted
      another analyst before the exchange, and a subagent never stamped
      cross-family) and `analysis_exchange.test.ts` (9 cases, including a minority
      finding dropped silently and one mentioned without a disposition).
- [x] AC-4 — After every exchange the run shows the gate's numbers, and a further
      round happened only on a recorded council or owner decision. Met 2026-10-19:
      `analysis_gate.test.ts` (17 cases) pinned the decision half only — the
      shared context now carries the showing half (the four returned fields
      printed after every exchange; an offer is affordability, never a decision),
      pinned by `analysis_gate_surfacing.test.ts`, red before the edit.
- [ ] AC-5 — `analyze:inbox` on a replayed round lands only `status: ready`
      roadmaps and, unless `--no-pr`, a PR whose `isDraft` is `false`, without an
      owner prompt for the PR and with at most one batched post-action question
      block. <!-- blocked-by: replay-round-is-maintainer-local | asked: no — a drain lane holds no channel to the owner; the batch belongs to the next owner round -->
      *Held 2026-10-19: the mechanism is pinned on fixture rounds
      (`analysis_inbox_final`, `analysis_publish`, `analysis_questions`); the
      replayed round this AC names is step 3.5, whose inputs are not in the
      repository.*
- [x] AC-6 — A source-door run in a consumer fixture without `docs/CLAIMS.md`
      produces a typed anchor table or states feature mode, and never presents an
      opportunity as a defect. Met 2026-10-19: `analysis_anchors.test.ts` carries
      exactly those three cases, plus the no-signal fixture that states feature
      mode anchored on `--goal`.
- [x] AC-7 — `analyze:pr` without an argument on a branch with an open PR finds it
      without asking, writes nothing to the PR by default, and with `--optimize`
      stops on a moved head and never merges. Met 2026-10-19:
      `analysis_pr_target.test.ts` (6 cases), `analysis_pr_optimize.test.ts`
      (10, including a moved head stopping before the push and a fork yielding a
      patch) and `analyze_pr_limits.test.ts` (the door makes no `gh` write call
      and never merges).
- [x] AC-8 — An interrupted run resumes from its last completed state without a
      second PR or duplicated output. Met 2026-10-19: `analysis_run.test.ts`
      resumes a run killed in `emitted` without re-emitting and reports a moved
      head instead of continuing; `analysis_publish.test.ts` opens no second PR
      on a re-run and hands back when the remote head moves mid-push.
- [x] AC-9 — `run.json` exists for every run, and the retro roadmap carries the
      `analysis-run` unit that reads it. Met 2026-10-19 at mechanism level:
      `analysis_run.test.ts` persists the record under
      `agents/runtime/analysis/<round-id>/` and `analysis_run_record.test.ts`
      round-trips it with one row per analyst and loop; the retro file names
      `analysis-run` five times. Stated plainly: the evidence is fixture runs —
      zero production runs exist, which is what step 6.6 is held on, not this.
- [x] AC-10 — `analyze:repo`, `analyze:reference-repo` and `optimize:deep` still
      resolve as aliases in the projected tree. Met 2026-10-19:
      `analysis_family_aliases.test.ts` reads the projected frontmatter under
      `dist/agent-src/commands/analyze/` — `analyze:reference-repo` and
      `optimize:deep` as `replaces:` entries, `analyze:repo` as the live name
      until 6.2b renames it. Sensitivity probed by removing one alias and
      watching the case go red.
