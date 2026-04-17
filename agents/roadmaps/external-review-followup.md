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
| 2 | License: `UNLICENSED` + `proprietary` + no LICENSE file | ✅ Valid — **resolved: MIT** |
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

## License decision — MIT

Maintainer chose **MIT** out of the three options (MIT, BUSL-1.1,
keep proprietary).

Applied in the same session:

- `LICENSE` file added with the standard MIT text, copyright holder
  `event4u`, year 2026.
- `package.json`: `license` changed from `UNLICENSED` to `MIT`;
  `private` flipped from `true` to `false` since the MIT grant makes the
  previous "no accidental publish" guardrail obsolete and inconsistent.
- `composer.json`: `license` changed from `proprietary` to `MIT`.
- `README.md`: added a short License section linking to the `LICENSE`
  file so the grant is visible without digging into metadata.

Effect: the package.json / composer.json / LICENSE / repo visibility
signals are now coherent with each other. Third parties can install,
fork, and redistribute under MIT terms.

## Items deferred — see `deferred-followups.md`

The following items from the review remain out of scope:

- **Architectural split (review item 9)** — user decision: multi-package split
  was already moved to `skipped/multi-package-architecture.md`.
- **Windows support (review item 10)** — needs a Windows user. Parked.

## Not adopted from the review

The review proposed creating a top-level `roadmaps/` directory with seven new
roadmap files. This project already uses `agents/roadmaps/` with a defined
lifecycle (active → skipped → archive). Adding a parallel structure would
fragment it. Instead, this single follow-up file consolidates the actionable
review items.

---

← [Back to README](../../README.md)
