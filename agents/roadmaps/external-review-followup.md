# External Review Follow-Up

**Source:** External GitHub-based code review (April 2026) rating the public repo
at 7.5/10 as internal tool, 5.5/10 as public OSS product.

**Status: In progress.** Mechanical fixes are being executed in this session;
items that need a product or legal decision are called out separately.

## Validation summary

The review made 10 concrete claims. Ground truth before starting work:

| # | Claim | Status after check |
|---|---|---|
| 1 | `package.json` version 1.0.0 vs latest tag 1.3.3 | ✅ Valid — drift confirmed |
| 2 | License: `UNLICENSED` + `proprietary` + no LICENSE file | ✅ Valid — needs decision (see below) |
| 3 | `.gitignore` marker still reads `# galawork/agent-config` | ✅ Valid — present in `scripts/install.sh` |
| 4 | CI runs only 2 of 17 Python test files | ✅ Valid — all 15 missing tests pass locally |
| 5 | Postinstall uses `\|\| true` and swallows errors | ✅ Valid |
| 6 | Runtime layer is scaffold, not a real execution engine | ✅ Valid — intentional, but README phrasing has drifted |
| 7 | Tool adapters mostly scaffold | ✅ Valid — same |
| 8 | README overclaims vs actual surface | Partially valid — Phase 5 of the archived README roadmap already simplified wording |
| 9 | Split into core vs optional layers | ❌ Rejected — user already moved multi-package split to `skipped/` |
| 10 | Windows support audit | Deferred — no Windows user to validate against |

## Items fixed in this session

| # | Task | Commit |
|---|---|---|
| 1 | Version sync `package.json` + `composer.json` → latest git tag | _to be filled_ |
| 3 | Rename gitignore marker `galawork/agent-config` → `event4u/agent-config` with idempotent migration | _to be filled_ |
| 4 | Add all 15 passing Python test files to `tests.yml` | _to be filled_ |
| 5 | Postinstall no longer swallows errors; prints actionable message and exits 0 only when the fault is environmental (e.g. no Python) | _to be filled_ |
| 6 | Runtime + tool-adapter modules now carry an explicit `EXPERIMENTAL` header; README section on what's executable gets a qualifier | _to be filled_ |

## Items deferred — see `deferred-followups.md`

The following items from the review are either already rejected or require
external input:

- **License choice (review item 2)** — legal decision, needs a maintainer call.
  Options presented below.
- **Architectural split (review item 9)** — user decision: multi-package split
  was already moved to `skipped/multi-package-architecture.md`.
- **Windows support (review item 10)** — needs a Windows user. Parked.
- **`private: true` on the npm package** — kept. The package is published under
  an `@event4u/` scope; `private: true` prevents accidental publication to the
  public npm registry while the license question is open. Revisit when license
  is decided.

## Open decision — license

The repository is public but ships without a LICENSE file. Both `package.json`
(`UNLICENSED`) and `composer.json` (`proprietary`) signal "no rights granted",
which legally prevents any third party from using, forking, or even meaningfully
reading the code for adoption. This is the single biggest blocker to the review's
"public OSS product" rating.

Three realistic options:

1. **MIT** — permissive, simplest, standard for tooling. No copyleft.
2. **BUSL-1.1** — source-available, converts to Apache-2.0 after N years.
   Prevents competing commercial distributions in the interim.
3. **Keep proprietary** — LICENSE file stating the repo is source-available for
   reading only, no redistribution. Honest if the repo is truly internal; closes
   off OSS adoption entirely.

**Recommendation:** surface this to the maintainer. The agent does not pick a
license.

Until the decision is made, `package.json` stays `private: true` so nothing
gets published accidentally under the current contradictory metadata.

## Not adopted from the review

The review proposed creating a top-level `roadmaps/` directory with seven new
roadmap files. This project already uses `agents/roadmaps/` with a defined
lifecycle (active → skipped → archive). Adding a parallel structure would
fragment it. Instead, this single follow-up file consolidates the actionable
review items.

---

← [Back to README](../../README.md)
