## Acceptance Criteria

Per-criterion evidence moved verbatim to `agents/evidence/analysis/analysis-family-step-records.md` § AC-1 … § AC-10 (lightweight cap).

- [x] AC-1 — From a subfolder each of the four doors prints the scope line before
      any read; inside an enumerated or detected module it names the module, with
      or without a marker in the module's `agents/`, and keeps the outer project
      as `project_root`. Met 2026-10-19.
- [x] AC-2 — Every loop, round and fix cycle of the four doors has a numeric cap in
      a `limits:` block, and no door runs until a condition without one (ADR-118).
      Met 2026-10-19.
- [x] AC-3 — Each seed and deepen output carries independence stamps and
      references no other analyst; each exchange records its cross-exam targets
      verbatim, a disagreement ledger and a minority audit. Met 2026-10-19.
- [x] AC-4 — After every exchange the run shows the gate's numbers, and a further
      round happened only on a recorded council or owner decision. Met 2026-10-19.
- [ ] AC-5 — `analyze:inbox` on a replayed round lands only `status: ready`
      roadmaps and, unless `--no-pr`, a PR whose `isDraft` is `false`, without an
      owner prompt for the PR and with at most one batched post-action question
      block. Held 2026-10-19.
      <!-- blocked-by: replay-round-is-maintainer-local | asked: no — a drain lane holds no channel to the owner; the batch belongs to the next owner round -->
- [x] AC-6 — A source-door run in a consumer fixture without `docs/CLAIMS.md`
      produces a typed anchor table or states feature mode, and never presents an
      opportunity as a defect. Met 2026-10-19.
- [x] AC-7 — `analyze:pr` without an argument on a branch with an open PR finds it
      without asking, writes nothing to the PR by default, and with `--optimize`
      stops on a moved head and never merges. Met 2026-10-19.
- [x] AC-8 — An interrupted run resumes from its last completed state without a
      second PR or duplicated output. Met 2026-10-19.
- [x] AC-9 — `run.json` exists for every run, and the retro roadmap carries the
      `analysis-run` unit that reads it. Met 2026-10-19 at mechanism level.
- [x] AC-10 — `analyze:repo`, `analyze:reference-repo` and `optimize:deep` still
      resolve as aliases in the projected tree. Met 2026-10-19.
