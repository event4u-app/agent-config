## Acceptance Criteria

- [-] AC-1 — The tracked `deny` array holds no readable source name: every
      entry matches `^[0-9a-f]{64}$`, and the gate still exits 1 on a seeded
      fixture violation in CI.
      <!-- MOVED to road-to-source-silence-cutover AC-1. Gated on the atomic
      digest cutover, which needs a repository secret an agent cannot provision;
      the mechanism, generator, tests and dormant config key all shipped. The
      plaintext array is still in force and still publishes 65 names — that is
      the unmet part, stated plainly. -->
- [x] AC-2 — The gate refuses a source token in a **path** and in a **`> **Source:**`
      header, not only in a content line: three fixtures (denied token in a
      filename, speaking `agents/tmp(.old)?/<name>/` quote, un-allowlisted
      `owner/repo` slug) produce the block/warn results the
      `how-loud-the-slug-heuristic-is` blocker decided.
      <!-- DONE 2026-08-29, all three fixtures present and the tier asserted.
      (1) Denied token in a FILENAME with a clean body: added this change to
      `tests/scripts/check_no_external_sources.test.ts` — exit 1 with the hit at
      line 0 and a `(path)` excerpt, plus a polarity case where a clean filename
      produces no hit. Phase 3.1's own verify was a LIVE probe on the real tree,
      which was a real reading but pinned nothing, so a regression there would
      have been silent; this is the pin. (2) Speaking `agents/tmp(.old)/<name>/`
      quote and (3) un-allowlisted `github.com/<owner>/<repo>` URL: the three
      blocking fixtures in `tests/scripts/source_shape.test.ts`, whose own
      describe block asserts the block/warn tier the blocker decided. NOTE on
      the third fixture, because the criterion as authored says "slug": the BARE
      `owner/repo` form was built, measured at 3,109 hits against 202 for the
      URL form, and REMOVED under this roadmap's Phase 3.2 — so the fixture is
      the URL form, which is the class that shipped. The recall hole that leaves
      is recorded in `_lib/source_shape.ts` and pinned by a negative test. -->
- [-] AC-3 — A keyless run of the gate is loud, never green: with the key
      unset the gate exits with its distinct warning code, and the CI job
      asserts key presence before the gate step.
      <!-- MOVED to road-to-source-silence-cutover AC-2. The BEHAVIOUR half is
      done and tested — `digestMode` is a five-row table with two fatal rows, the
      keyless run writes a stderr line naming the missing capability, and under
      `SOURCE_DENY_STRICT` it exits 3, asserted never 0, in
      `tests/scripts/source_digest.test.ts`. The CI half cannot exist before the
      secret does: a key-presence assertion has nothing to assert. Carried
      rather than claimed, because a criterion with two clauses is not met by
      one. -->
- [-] AC-4 — The full-surface sweep (tracked content, tracked paths, `main`
      commit subjects, branch refs, PR titles and bodies) reports **zero**
      hits at HEAD, with whatever the history blocker recorded as accepted
      residual named and counted — never left as an unstated hope.
      <!-- MOVED to road-to-source-silence-cutover. The SECOND clause is fully
      satisfied and stays satisfied: the residual is named and counted — 341
      occurrences on the two immutable surfaces, at
      `agents/evidence/reports/source-attribution-census.md:50`, and repeated in
      the `non_inference` field of `claim:plaintext-source-attribution` so it
      travels with the claim. The FIRST clause is not met and cannot be met by
      this roadmap: "zero on content" needs the corpus-wide codename rewrite
      (243 baselined shape findings) AND, on the commit and PR surfaces, needs
      exactly the history rewrite the `whether-history-gets-rewritten` blocker
      resolved AGAINST. So this criterion is partly unreachable by a recorded
      decision of this same roadmap — which is a defect in the criterion, not in
      the work, and the successor restates it as the reachable half. -->
- [x] AC-5 — A new inbox round cannot restart the chain: creating a
      non-opaque directory under `agents/tmp/` is rejected at write time, and
      the `/analyze:inbox` command file carries the opaque-intake rule and the
      `ENC1:` intake step.
      <!-- DONE 2026-08-29 — both clauses, from 4.2 and 4.1 respectively. The
      write-time rejection is `block-speaking-inbox-dir` with 14 harness tests
      covering both polarities; the command file carries the fenced naming Iron
      Law, the accepted-forms table and the `link_crypto encrypt` intake recipe.
      HONEST REACH, restated here rather than left in 4.2: the rejection is a
      real deny only on `claude`, the one host that both binds `pre_tool_use`
      and honours one. On a host that binds nothing, this criterion's first
      clause is model-carried. -->
- [-] AC-6 — `skip_paths` is a ratchet at or below 20 entries, every survivor
      maps to a key in `skip_reason`, and raising the count requires a blocker
      reference in the same diff.
      <!-- MOVED to road-to-source-silence-cutover AC-3 + blocker
      `skip-paths-target-is-owner-reserved`. Two of three clauses hold TODAY and
      are reproduced: the estate is a ratchet — `check_suppression_hygiene`
      declares this file with `growth: 'forbidden'`, which is STRICTER than the
      criterion asked for, since growth is refused outright rather than
      permitted with a blocker reference (Phase 3.3 measured this by appending
      an entry and watching the gate red) — and every one of the 22 survivors
      maps to a `skip_reason` key, published per entry in the ledger. The
      NUMBER does not hold: 22, not at most 20. The AI council was asked twice;
      round 2 SPLIT (one seat "correct the criterion to the measured floor", one
      seat "hold at most 20 and leave it unmet"), and a split escalates rather
      than resolves. Both seats agreed on the two things that are not in dispute:
      the published ledger discharges the evidentiary question, and the
      `dist/agent-src/` consolidation that would reach 18 must not be done to
      hit a number by the party whose criterion it satisfies. -->
