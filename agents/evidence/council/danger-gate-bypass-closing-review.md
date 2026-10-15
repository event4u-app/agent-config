<!-- evidence-type: analysis -->

# Council review — the bypass record and its reader (branch drain/danger-gate-governs-20261015)

A modification review under `docs/contracts/ratification-artifact.md` § The
modification review asks a fixed set, of the two gated files
`src/scripts/_lib/platform_anchor.ts` and `src/scripts/check_platform_anchor.ts`
and the contract edit beside them. Ten rounds, 2026-10-15, through the CLI seats
(`council_cli run --prompt-mode pr --rounds 1`), quorum 2 of 2 every round, nothing
billed. Each round's prompt is committed verbatim beside this file:

- round 1: `agents/evidence/council/danger-gate-bypass-closing-review-20261015.question.md`
- round 2: `agents/evidence/council/danger-gate-bypass-closing-review-r2-20261015.question.md`
- round 3: `agents/evidence/council/danger-gate-bypass-closing-review-r3-20261015.question.md`
- round 4: `agents/evidence/council/danger-gate-bypass-closing-review-r4-20261015.question.md`
- round 5: `agents/evidence/council/danger-gate-bypass-closing-review-r5-20261015.question.md`
- round 6: `agents/evidence/council/danger-gate-bypass-closing-review-r6-20261015.question.md`
- round 7: `agents/evidence/council/danger-gate-bypass-closing-review-r7-20261015.question.md`
- round 8: `agents/evidence/council/danger-gate-bypass-closing-review-r8-20261015.question.md`
- round 9: `agents/evidence/council/danger-gate-bypass-closing-review-r9-20261015.question.md`
- round 10: `agents/evidence/council/danger-gate-bypass-closing-review-r10-20261015.question.md`

| Round | Reviewed | anthropic/claude-sonnet-4-5 | openai/codex-default |
|---|---|---|---|
| 1 | `646d2c822` | ratified | refused |
| 2 | `aa6a7760d` | ratified | refused |
| 3 | `778cc3be1` | ratified | no stance line (did not conclude) |
| 4 | `9336a43d6` | confirmed-non-expanding | no stance line (did not conclude) |
| 5 | `e7291e37d` | confirmed-non-expanding | no stance line (did not conclude) |
| 6 | `6483ebbcf` | confirmed-non-expanding | refused |
| 7 | `84fc7837e` | confirmed-non-expanding | refused |
| 8 | `473333aa0` | confirmed-non-expanding | no stance line (did not conclude) |
| 9 | `e07c84c83` | confirmed-non-expanding | no stance line (did not conclude) |
| 10 | `09526f740` | confirmed-non-expanding | confirmed-non-expanding |

Rounds 1 to 5 sent the change and then the delta since the previous round; rounds
6 to 10 sent the whole change against the trunk after a seat asked for it. A reply
with no stance line is a seat that did not conclude; each such reply ended in
REQUEST_CHANGES prose, and the round after it addressed the findings.

The round-10 text of each seat follows verbatim.

## anthropic/claude-sonnet-4-5

# Modification Review - Round 10

Reviewing the complete change against the trunk, incorporating bypass record closing mechanism for the owner's ratification-gate route.

---

## 1. Behavior Changes

**Primary:** `check_platform_anchor` now reads bypass records on **every run** (gated diff or not) and fails when:

- A bypass is at/past `restore_by` with `restored_at: pending`
- A bypass is restored but `council_review: pending` ≥7 days after restoration  
- A record is malformed (missing/unknown/repeated field, invalid instant, impossible chronology)
- A record is unreadable (symbolic link, >64 KiB, cannot open with `O_NOFOLLOW`)
- A record the base carries was deleted from the checkout
- The record directory exists but cannot be listed, or contains >200 entries

**Secondary:** The contract now requires a closing flow (restore → council review) and explicitly states a run never performs/widens/restores a bypass — only records/checks it.

**Implications:**
- Forgotten bypasses surface automatically when the check runs
- The seven-day review deadline creates time pressure
- Platforms without `O_NOFOLLOW` fail closed (read no records, fail the gate)

---

## 2. Authority/Safety Boundaries

**NARROWS:** Before: owner bypass could stay open indefinitely with no automated visibility. After: unclosed bypass reds the next voluntary check run.

**Caveats (stated honestly):**
- "Local and voluntarily invoked" — doesn't prevent bypasses, only surfaces unclosed ones when someone runs it
- Can't verify against forge (needs `administration` permission workflows lack)  
- Branch can rewrite records to look closed
- Without `O_NOFOLLOW`, reads zero records and fails (platform limitation)

Direction: **narrower bypass risk**, but with explicit limits on what it can enforce.

---

## 3. Weakening of Judgement

**No weakening detected.**

Round 9 finding (1) — budget checked after read, counted UTF-16 units — is **fixed**:
- `reviewReader` now computes `allowance = min(perReview, total - bytes)` **before** each `git show`  
- Passes `allowance` as `maxBuffer`
- Reads as `Buffer`, counts bytes (line 291: `bytes += shown.stdout.length`)
- Test `check_platform_anchor_open_bypass.test.ts:248-256` validates exact capacity, one-under, one-over, and multibyte content deciding outcome

Round 9 finding (2) — misleading comment — is **fixed**:
- Comment now reads "a missing directory is no records and one that cannot be listed fails the gate" (matches code behavior)

**Test additions (35 new cases):**
- Validate all nine required fields
- Chronology checks (before/after relationships)
- Budget enforcement (per-review, total, byte-accurate)
- Review timing (committed before restore doesn't count)  
- Symlink/directory/untracked reviews don't count
- Record deletion detection
- O_NOFOLLOW absence handling

All new tests are legitimate additions, not weakenings. No existing tests modified.

---

## 4. Workarounds via Other Hosts/Projections

**Yes, inherent to design (stated honestly in contract):**

1. **Checkout control:** Someone who can rewrite the checkout or git history can fabricate closed records — the check reads branch-local files, can't verify against forge
2. **Platform limitation:** Without `O_NOFOLLOW`, check reads zero records and fails (line 223-226)  
3. **Voluntary invocation:** "local and voluntarily invoked" — only reds when someone runs it

**Mitigations (bounded, not eliminated):**
- Fails closed on unreadable/malformed records  
- Sanitizes values in findings (`printable()`)
- Caps all reads (64 KiB/record, 200 records, 1 MiB/review, 4 MiB total, 20 reviews)
- Won't follow symlinks (with `O_NOFOLLOW`)
- Reads reviews from committed `HEAD` tree, not working tree

Contract § "What that check does not establish" explicitly documents these limits (lines 421-434).

---

## 5. Reversibility

**Undoable:** Yes, by whom: **owner** (kernel-adjacent gating code on `ANCHOR_PATHS`).

**How:**
- Code revert: `git revert <this-commit>` against trunk  
- Check disable: don't invoke it (already voluntary)
- Record editing: edit/delete bypass record files (limitation per Q4)

**Authority:** Matches `check_kernel_edit_ratified.ts` gate — requires modification review or owner forge action.

---

## 6. Observability / Rollback Criteria

**Claimed benefit:** "Making forgotten closings visible."

**What would falsify:**
- People consistently game the check (edit records to look closed) instead of complying
- Check never run in practice  
- O_NOFOLLOW unavailable on production platforms (check fails closed, surfaces no data)

**Omitted rollback criteria:**
- No metric: "how often are bypasses properly closed vs. edited to look closed"
- No tracking: whether people comply or circumvent  
- No fallback: if O_NOFOLLOW widespread absence makes check unusable
- No threshold: "fail if >N bypasses accumulate" (could indicate systemic issue)

**Kill-switch:** None explicit. Closest: don't run the check (already voluntary), but that loses all visibility.

---

## 7. Smaller Change Available?

**Current size:** ~900 lines (code + tests + contract).

**Could be smaller?**
- Review budget tracking is complex (caching, byte-counting, allowance) but necessary (learned from round 9 failure)
- Multiple validation paths (malformed/unreadable/removed) could theoretically unify, but distinct failure modes aid debugging
- 35 test cases are thorough but justified for authority-boundary code

**What larger buys:**
- Defensive depth (size caps, symlink refusal, control-char sanitization)  
- Comprehensive test coverage (chronology, budget, deletion, platform limits)
- Explicit honesty about limits (contract prose)

**Verdict:** Size is proportionate to criticality. A safety gate for the owner's bypass route warrants thoroughness over minimalism.

---

## 8. Standing Instruction Weight

**Adds permanently:**
- New directory monitored: `agents/evidence/bypass-records/`  
- Contract text: ~90 lines in `ratification-artifact.md`  
- Per-run overhead: read bypass records (fast, local file I/O)  
- Review budget: up to 4 MiB read from git if records exist

**Mitigation:** Overhead proportional to bypass count. Repos with zero bypasses pay ~one directory stat. Not session-spanning prose — checking logic, not narrative.

---

## 9. Untrusted Content Steering

**Attack surface:** Bypass records are **committed files** — anyone who can write the branch can inject/edit them.

**Steering vectors:**
- Fake records with future dates (blocked: line 185, `time > t` is malformed)  
- Symlink to sensitive file (blocked: `O_NOFOLLOW` or fail closed)  
- Control characters in values (sanitized: `printable()` strips `\p{Cc}` etc., lines 30-33)
- Unbounded records (capped: 64 KiB/record, 200 entries, line 25-26)  
- Unbounded reviews (capped: 1 MiB each, 20 distinct, 4 MiB total, lines 378-380)
- Review committed before restore (blocked: line 159, `addedAtMs >= restoredAtMs`)

**Bounds hold:**
- All reads have `maxBuffer` caps  
- Findings sanitize values before output (can't forge second line)
- Reads from committed `HEAD`, not working tree (except records, which are explicitly local)
- Fails closed on unparseable input

**Residual risk (documented):** Someone with commit access can edit records to look closed without actually closing them. Check verifies structure/timing, not authenticity against forge. This is the honest limit of "local and voluntarily invoked."

---

## Defects Found

**None that block.**

**Medium-severity observation (not a bug):**  
`src/scripts/check_platform_anchor.ts:197` — `removedBypassRecords` fail-closed message "could not be listed" doesn't distinguish `ENOENT` (ref missing) from permission/git errors. Correct behavior (fail closed) but less informative than it could be. Not a security issue.

**Low-severity observation:**  
`src/scripts/_lib/platform_anchor.ts:89` — Timezone regex `Z|[+-]\d{2}:\d{2}` doesn't allow seconds component. Acceptable: ISO-8601 timezone offsets rarely include seconds. No known impact.

---

## STANCE

**STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: no**

**Rationale:**  
This change adds a **checking mechanism**, not an authority grant. It narrows the risk of unclosed bypasses by surfacing them when the check runs, without expanding who can bypass or what they can bypass. The round-9 budget enforcement bug is properly fixed (byte-counted allowance computed before read, tested). Code is defensive (fails closed, bounds all reads, sanitizes output), well-tested (35 new cases, zero weakenings), and **honest about its limits** (can't verify against forge, voluntary invocation, local files). The contract explicitly documents what the check does NOT establish (lines 421-434).

**Highest-leverage change before merge:**  
Add one rollback criterion to `docs/contracts/ratification-artifact.md` § Emergency use: "If >3 bypasses accumulate in 90 days, escalate to review whether the ratification process itself needs revision." This bounds systemic bypass abuse and surfaces when the gate has become a routine obstacle rather than a safety control.

## openai/codex-default

1. **Behavior change.** Every `check_platform_anchor` invocation now scans bypass records, even when the supplied diff contains no gated files. It fails for unreadable/malformed records, overdue restoration, overdue review, invalid review evidence, excessive record counts/sizes, or deletion relative to the base. It also introduces Git subprocess work on every invocation (`ls-tree`, `rev-parse`, and potentially `show`/`log`), so non-gated checks become slower and dependent on repository state.

2. **Authority boundary.** No authority is widened. The owner’s existing forge-bypass authority remains unchanged; the local checker narrows the practical safety boundary by making missing closure evidence visible. This is still advisory because invocation is voluntary and records are branch-local.

3. **Judging mechanism.** No assertion, test, threshold, or fixture semantics are weakened. The change adds validation, bounded reads, and regression coverage—including byte-based aggregate limits. The new injectable budget exists for boundary testing; production defaults remain fixed.

4. **Other projections.** Yes. The forge remains authoritative, while this control observes only the checkout and Git objects available locally. A writer can rewrite a record to appear closed, forge timestamps, recreate a deleted record at the same path, or omit invoking the check. The contract discloses most of these limitations accurately.

5. **Reversibility.** The checker and contract can be reverted by an actor authorized to modify the gated files, against the revision introducing this change, subject to the existing ratification gate. Individual false findings can also be resolved by correcting or removing records, although removal remains detectable when compared with a base containing them.

6. **Falsification and rollback.** The claimed benefit is false if real bypasses remain forgotten despite routine invocations, or if legitimate closed records repeatedly fail validation and cause operators to stop running the checker. No measured adoption/signal target, acceptable false-positive rate, rollback threshold, or operational kill switch is specified. Reverting the commit is the implicit kill switch.

7. **Smallest change.** A smaller implementation could check only `restored_at` and `council_review`. The larger change buys fail-closed parsing, chronology checks, deletion detection, committed-review verification, symlink resistance, output sanitization, and bounded resource use. Those additions are cohesive with the stated threat model rather than speculative OO structure; the functional decomposition fits the codebase paradigm.

8. **Standing instruction weight.** It adds roughly 80 lines of permanent contract material, nine required fields, two deadlines, several ceilings, platform requirements, and a rule forbidding agents from operating the bypass. Every later session handling this route must understand those constraints. That is meaningful governance weight, although localized to an exceptional path.

9. **Untrusted steering.** Record names, field values, review paths, review contents, and `baseRef` can influence execution. Command arguments are passed without a shell; review paths must normalize exactly, remain under the committed council directory, and name a regular `HEAD` blob. Reads are bounded by entry, file, aggregate-byte, and distinct-review limits. Finding text removes control and separator characters. A concurrent checkout writer remains outside the defended boundary, as documented.

**Defect**

- **Low — `src/scripts/check_platform_anchor.ts:286-310`: timestamp precision mismatch.** The first review commit time is read as whole Unix seconds and multiplied by 1,000, while `restored_at` accepts fractional seconds. If restoration is recorded as `12:00:00.500Z` and the review is committed later during that same second, Git reports `12:00:00Z`; `addedAtMs >= restoredAtMs` incorrectly rejects the legitimate review. Add a regression test and either restrict record instants to whole seconds or compare at Git’s one-second precision.

No security, type-safety, resource-bound, or concern-splitting defect warrants blocking this PR. Coverage is strong across the changed evaluator and I/O boundaries; confidence is high, although only the supplied diff—not the surrounding repository—was available.

APPROVE — the change adds a bounded, fail-closed observer without expanding bypass authority; the highest-leverage pre-merge improvement is resolving and testing the fractional-second/Git-timestamp mismatch.

STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: no
