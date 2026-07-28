---
model_tier: medium
name: license-compliance-audit
description: "Run the offline (jscpd) and online (scanoss-py) similarity scanners on demand against a diff or path — the ONLY home of this repo's detection capability; no CI gate exists or ever ran it automatically"
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
---

# license-compliance-audit

Gate G0 (`road-to-provenance-and-license-governance`, Phase 0) measured both
candidate similarity detectors against a frozen golden corpus and neither
met the pre-registered bar for a CI gate. Council resolved (2026-07-28,
Option A): **no `lint_code_provenance.ts` in any form — not even
advisory.** This skill is the result: the scan capability that used to be a
planned CI gate now exists only as something a human invokes deliberately,
so every hit gets investigated *because* a human asked for it — never as a
silent pipeline signal nobody reads.

## When to use

- Before merging a diff that looks suspiciously similar to something you've
  seen elsewhere, or that a reviewer flagged.
- During a periodic self-audit (e.g. the Phase-4 "run the full pipeline on
  this repo" dogfood exercise).
- A reviewer or the `origin: uncertain` self-flag from
  [`code-provenance`](../../rules/code-provenance.md) names a residual-class
  file worth a closer look.

Do NOT use when:

- You expect this to run automatically in CI — it does not, by explicit
  council decision; nothing here is wired into any pipeline.
- You expect a clean result to prove the code was not copied — it cannot;
  see the scope bound below.
- You already have a specific, known source to check against a specific
  license — that's [`license-compliance-borrow-check`](../license-compliance-borrow-check/SKILL.md),
  a targeted one-source check, not a corpus-wide scan.

## Procedure

1. **Inspect available tooling.** The offline layer (L-1) is always
   available via `npx`:
   ```bash
   npx jscpd --version
   ```
   The online layer (L0) is optional — check whether it's installed and
   reachable:
   ```bash
   scanoss-py --version   # or: pip show scanoss
   ```
   Offline-only is expected and fine in most environments — report it
   honestly, not as a failure.
2. **Run the offline scan (L-1)** against the target path or diff:
   ```bash
   npx jscpd <path> --min-tokens 25
   ```
   `--min-tokens 25` is the pre-registered shipping value — the best
   false-positive-clean point of the S0.3 sweep
   (`internal/bench/provenance/reports/baseline-2026-07-28.md`). Read every
   reported clone pair as a **candidate**, never a verdict.
3. **If L0 is reachable, run the fingerprint scan:**
   ```bash
   scanoss-py scan <path>
   ```
   Only WFP fingerprints leave the machine, never raw source (privacy by
   construction, principle 7). If L0 is unreachable, rate-limited, or not
   installed, report the result as `partial (offline)` explicitly — never
   claim a full two-layer scan ran.
4. **Investigate every hit manually.** For each match: is the matched file
   already in `provenance/borrows.jsonl` (cleared)? Does it read like
   independent convergence on a common algorithm shape, or an unattributed
   real copy? Open both files side by side before deciding — a match id is
   a starting point, not a conclusion.
5. **Route unresolved hits.** A hit with no existing ledger entry and no
   independent-convergence explanation routes to
   [`license-compliance-borrow-check`](../license-compliance-borrow-check/SKILL.md)
   to classify and draft the entry. Never clear a hit yourself by simply
   deciding it's fine.
6. **Report the scope bound alongside every result** (see below) — a clean
   run means "nothing matched this KB/corpus at this sensitivity", never
   "no copying happened".

## What the measured numbers mean — and don't

On the frozen synthetic corpus (`internal/bench/provenance/`, 36 files,
content-sha256 `dbbc84a7…34bb3`):

| layer | verbatim+rename recall | rename-only recall | false positives |
|---|---:|---:|---:|
| L-1 jscpd `--min-tokens 25` | 10/16 | 4/8 | 0/12 |
| L0 scanoss | 4/16 | 0/8 | 2/12 |
| **union (both layers)** | **12/16** | **4/8** | **2/12** |

Full source: `internal/bench/provenance/reports/baseline-2026-07-28.md`.

- **Scope bound:** the corpus is `synthetic-canonical` — independently
  authored implementations of well-known algorithm shapes, never fetched or
  pasted from any upstream file. This measures **transformation-depth
  sensitivity and false-positive rate on independent code** — it does
  **not** measure recall against SCANOSS's real-OSS knowledge base. No
  sample here is indexed anywhere, so a KB lookup returning zero hits says
  nothing about the detector's real-world recall. Real-KB recall is
  unmeasured and would need a second, real-snippet corpus.
- **Rename-only laundering is not reliably caught** — 0/8 (SCANOSS), 4/8
  (jscpd). The provenance ledger, not this scan, is the anti-launder
  control (see [`code-provenance`](../../rules/code-provenance.md)).
- **No tool sees model training data.** Unconscious reproduction from
  training data is not addressed by this scan at all, regardless of
  outcome.

## Output format

1. Per scan target: which layer(s) actually ran, hit or clean, and — if
   the online layer was unreachable — the explicit `partial (offline)`
   marker (never a silent green presented as a full scan).
2. For every hit: the matched file/snippet, a manual same-shape-vs-real-copy
   judgment, and the routing decision (already ledgered / route to
   `license-compliance-borrow-check` / independent convergence, no action).
3. The scope-bound paragraph from the section above, restated so the
   requester never reads a clean result as a copying guarantee.

## Gotcha

- **A clean scan is not proof of originality.** It means "nothing matched
  at this sensitivity, in this corpus/KB" — never "not copied from
  training data".
- **Rename-only copies routinely pass both layers.** Do not trust a clean
  re-scan after a purely cosmetic rewrite as evidence of real
  transformation.
- **Both of SCANOSS's measured false positives came from independently
  authored files** matching on convergent canonical-algorithm shape (MIT
  snippet matches) — a hit is an investigation trigger, not an accusation.
- **Nothing here is wired into CI.** A hit found by this skill never
  blocked anything automatically; if you expected a pipeline signal, there
  isn't one — that's the point of Gate G0's Option A resolution.

## Do NOT

- NEVER claim or imply this scan runs in CI — it explicitly does not, by
  council decision (Gate G0, Option A).
- NEVER report a scan as complete when the online layer was unreachable —
  always say `partial (offline)`.
- NEVER present a clean result as "provably not copied" — restate the
  scope bound every time a result is shared.
- NEVER clear a hit without either a ledger entry or a documented
  independent-convergence judgment.

## See also

- [`code-provenance`](../../rules/code-provenance.md) — the rule that makes
  the ledger, not this scan, the primary anti-launder control.
- [`license-compliance-borrow-check`](../license-compliance-borrow-check/SKILL.md) —
  where an unresolved hit routes for classification + ledger drafting.
- `internal/bench/provenance/reports/baseline-2026-07-28.md` — the full
  measured baseline this skill's numbers are drawn from.
- `docs/CLAIMS.md` — claim `provenance-detector-transformation-sensitivity`
  (unbacked, carries the same scope bound).
