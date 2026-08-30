## Acceptance Criteria

- [ ] AC-1 — The tracked config holds no readable source name: every
      `deny_digests` entry is a 64-hex digest, no `deny` array is present, and
      the gate still exits 1 on a seeded fixture violation in CI.
- [ ] AC-2 — A keyless run is loud, never green: with the key unset the gate
      exits **3** under the strict flag, and a CI step asserts key presence
      before the gate step runs.
- [x] AC-3 — `skip_paths` has a recorded target it meets, and the entry is
      shrink-only, so the next drift fails rather than accumulating.
      MET by 2.1 and 2.2, and this line IS the predecessor's AC-6 restated
      against the settled number, which is what 2.1's `verify:` asks for.
      **The target is 21**, decided by the AI council on 2026-08-30 with 2/2
      seats present after an earlier 1–1 split; `check_suppression_hygiene`
      reports `21 entry(ies) (22 at base, 1 removed)`. The entry is shrink-only
      by that gate's own construction — a base of 22 with one removed is a
      ratchet reading, and a 22nd entry would fail it rather than accumulate.
      Each of the 21 survivors is individually justified in
      `agents/evidence/reports/source-skip-paths-ledger.md` with a MEASURED
      suppressed-hit count, and unskipped deny hits are 0.
- [x] AC-4 — `check_no_external_sources:shape-block` carries a `landed` date
      within its 56-day window, reached by a reduction or by a `reaffirmed`
      block that states a real reason.
      MET by 3.1, and by a REDUCTION rather than a reaffirm: 243 → **148**,
      `landed: 2026-08-30`, expiry 2026-10-25. The 95 removed findings were each
      read and are each a false positive of a class that flagged the presence of
      a `**Source:**` header rather than a leaked name; the delta was recounted
      full-tree and added zero. What remains — 127 speaking inbox-directory names
      and 21 repository slugs — is real debt with a named paydown mechanism
      (ADR-250 in-place redaction) that this change did not attempt.
