---
model_tier: medium
name: license-compliance-borrow-check
description: "Paste a URL/snippet before you borrow it — detects its license, runs the derived compatibility policy, and drafts a provenance ledger entry — even before any code is written, not after"
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
---

# license-compliance-borrow-check

## When to use

- Before adapting, porting, or otherwise consciously reusing an algorithm,
  a non-trivial structure, or more than roughly ten lines of logic shape
  from a source you can name (a repo, a gist, a Stack Overflow answer).
- The [`code-provenance`](../../rules/code-provenance.md) rule fired and its
  step 3 ("check license compatibility") needs a concrete answer.
- A reviewer or the `origin: uncertain` self-flag surfaces a borrow that was
  never checked.

Do NOT use when:

- No conscious borrow happened — a well-known, unpatentable algorithm shape
  (a for-loop, a hash map) implemented with no specific source in mind.
- The borrow is already ledgered with a valid entry — use
  [`license-compliance-credits`](../license-compliance-credits/SKILL.md) to
  regenerate notices instead.
- You want a broad similarity scan across the repo, not one source — use
  [`license-compliance-audit`](../license-compliance-audit/SKILL.md).

## A passing verdict is not a copying clearance

This skill answers ONE question: is the source's license compatible with
this repo's license, under the derived compatibility policy? An `allow`
verdict means the license permits the reuse — it says nothing about whether
the [`code-provenance`](../../rules/code-provenance.md) discipline (read,
close the source, re-derive against house standards) was actually followed.
License-clean code that is still a verbatim copy is still a violation of
that rule. Run both checks; treat neither as a substitute for the other.

## Procedure

1. **Identify the source** — the URL or repo path being borrowed from, and
   the exact commit or blob SHA the snippet was taken from (`git log -1
   --format=%H -- <path>` on the source repo, or the URL's own commit ref).
2. **Detect the source's license.** Check, in order: a `LICENSE`/
   `LICENSE.md`/`COPYING` file at the source repo root; the source's
   `package.json` `"license"` field; its `composer.json` `"license"` field;
   an SPDX header comment in the file itself. If none resolve to a known
   SPDX id, the license is `unknown` — never guess permissive.
3. **Detect this repo's target policy.** Run:
   ```bash
   npx tsx src/scripts/detect_target_license.ts . --json
   ```
   If `license-policy.yaml` exists at the repo root, read its
   `policy.{allow,conditional,deny}` buckets directly. If it doesn't (dry
   run only), derive the same buckets by hand from this repo's own
   `LICENSE` file and the compatibility matrix in
   `src/scripts/_lib/detect_target_license.ts`
   (`COMPATIBILITY_MATRIX`/`classifyBorrow`).
4. **Classify the borrow.** Map the source's SPDX id to its source class
   (permissive / weak-copyleft / gpl-2.0 / gpl-3.0 / agpl / sspl /
   `unknown`), then read the verdict off the target's policy buckets:
   `allow`, `conditional` (escalate), or `deny`. A source license of
   `unknown` is **always** `deny` — no exception.
5. **Act on the verdict:**
   - `allow` → continue to step 6 (draft the ledger entry).
   - `conditional` → STOP. Don't write the borrowed code yet. Escalate to
     the user with the exact matrix cell that triggered it (per
     [`ask-when-uncertain`](../../rules/ask-when-uncertain.md)) — never
     auto-clear a conditional verdict.
   - `deny` → refuse the borrow. Name the alternative: write it from
     scratch, find a permissively-licensed equivalent, or ask the
     maintainer for an explicit, recorded exception.
6. **Draft the ledger entry** — one JSON object matching
   `src/scripts/schemas/provenance-borrow.schema.json` (`source_url`,
   `license`, `source_sha`, `borrowed_at`, `files`, `transformation_note`,
   `cleared_by`). Write a `transformation_note` that names a real
   structural change — rename-only phrasing (e.g. "renamed variables",
   "cosmetic rename") is rejected by `lint_provenance.ts` even if the code
   hasn't landed yet, so draft it honestly against what will actually
   change.
7. **Present the draft to the user before appending it.** Once the
   re-derived code lands, append the confirmed entry to
   `provenance/borrows.jsonl` and verify:
   ```bash
   ./scripts-run src/scripts/lint_provenance
   ```
   Exit 0 confirms the entry is schema-valid, license-compliant, and its
   transformation note passed the rename-only phrase check.

## Output format

1. The classification verdict (`allow` / `conditional` / `deny`) with the
   exact source class → target class cell that produced it, and the source
   license's SPDX id (or `unknown`).
2. The draft ledger entry as a fenced JSON block, ready to append verbatim
   once the user confirms it.
3. For `conditional` or `deny`, the specific escalation question or refusal
   reason presented to the user — never a silently auto-resolved verdict.

## Gotcha

- **`allow` is not a copying clearance** — see the section above; run
  `code-provenance`'s read-close-re-derive discipline regardless of the
  license verdict.
- **No `LICENSE` file at the source is not "no license, so it's free"** — an
  absent license file defaults to strictest (`unknown` → `deny`), not to
  permissive.
- **A `conditional` verdict is not a soft "probably fine"** — it is a hard
  stop pending human escalation; treating it as advisory is the exact
  Q1 workspace-license failure mode the roadmap's council resolved against.
- **`license-policy.yaml` missing does not mean skip the check** — derive
  the policy by hand from the matrix; a missing policy file is a detection
  gap, not a green light.

## Do NOT

- NEVER append a ledger entry without presenting the draft to the user
  first.
- NEVER treat an undetectable license as permissive — `unknown` fails the
  linter outright and must escalate.
- NEVER let a `conditional` verdict proceed without the escalation actually
  happening this turn.
- NEVER write a `transformation_note` that only describes a rename or
  formatting change — describe the real structural change, or don't borrow.

## See also

- [`code-provenance`](../../rules/code-provenance.md) — the rule this skill
  answers step 3 of.
- [`license-compliance-credits`](../license-compliance-credits/SKILL.md) —
  regenerates `docs/THIRD-PARTY-NOTICES.md` once the entry lands.
- [`license-compliance-audit`](../license-compliance-audit/SKILL.md) — the
  on-demand similarity scan for suspicious diffs, not for a single known
  source.
- `src/scripts/detect_target_license.ts`, `src/scripts/_lib/detect_target_license.ts` — the license-policy derivation this skill consumes.
- `src/scripts/lint_provenance.ts`, `provenance/README.md`,
  `src/scripts/schemas/provenance-borrow.schema.json` — the ledger + its
  contract.
- [`ask-when-uncertain`](../../rules/ask-when-uncertain.md) — the escalation
  shape for `conditional`/`unknown` verdicts.
