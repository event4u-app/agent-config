---
proposed_by: road-to-a-fill-the-session-sees-coming steps 1.4, 2.1 and 2.2
implemented_by: claude-opus-5.5 session on feat/road-to-a-fill-the-session-sees-coming
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 4 of 2026-11-04
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: b027e5abdb27723c679e0a36ad0bf8eda4ee75a0259db3c0f351242eddeae3c9
---

<!-- evidence-type: ratification -->

# Ratification — manifest comment corrections and a hook-bundle budget raise

`check_kernel_edit_ratified` gates three files on this branch: `src/scripts/hook_manifest.yaml`,
its compiled projection `src/scripts/hook_manifest.json`, and `src/config/hook-bundle-budget.json`.
The `subject:` digest covers all three, computed with
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`
at revision `fa0b2028da`. The header is the output of
`ratification_header --seat anthropic=ratified --seat openai=ratified`.

## What was ratified

- **Two manifest comments corrected (step 1.4).** `quota-notice` said "one per session at 80 %
  context fill"; it has emitted a context line per prompt at or above the band since
  `road-to-a-memory-that-arrives` 2.1. `turn-end-gate` said "FIVE detectors"; `DetectorId` carries
  six. Comments only: no parsed key changes, and `hook_manifest.json` differs in its source-text
  `fingerprint` alone — its `body_fingerprint` over the parsed manifest is identical.
- **`max_bytes` 1,582,000 → 1,585,400** with a `raise_log` entry. The dispatch bundle measures
  1,584,627 B (APFS-cloned `node_modules`); origin/main builds to about 1,581,350 B. The growth is
  steps 2.1 and 2.2: the session-eol hook now reads the fill the status-line tap recorded for this
  session (`_lib/quota_ledger.ts`, `_lib/pressure.ts`) so the continuity record is written at the
  80 % band, and the handoff hook hands the record over as a pointer and digest after `/clear`.
  Both seats found no widened capability: the existing continuity write fires on one more
  condition (still switched off by the `0` override), and the existing injection changes shape;
  no new write destination, denial, output channel or injection event.

## How it got here

Four rounds, CLI subscription transport, USD 0.00. Prompts committed verbatim:
`agents/evidence/council/fill-session-manifest-comment-ratification-r1-20261104.question.md`
through `…-r4-20261104.question.md`.

- **Round 1, both `confirmed-non-expanding`** on the YAML diff. `check_generator_sync` then
  required the compiled JSON to be regenerated, which changed the gated set.
- **Round 2, split:** one seat approved on the identical `body_fingerprint`; the other asked for
  the YAML diff in the same prompt rather than by reference to round 1.
- **Round 3, both `confirmed-non-expanding`** on the complete diff of both manifest files.
  `check_hook_bundle_composition` then failed (2,627 B over), and the budget raise joined the set.
- **Round 4, both `ratified`** on all three gated files, with the hook code the raise pays for
  supplied as context.

Residuals, named by seats and not built — each would change a gated file and so the reviewed
digest: the `raise_log` phrase "quota_ledger.ts is its one reader" means the one ledger-format
parser and should say so; the 2026-10-01 `max_bytes_derivation` sentence that a 1,564,211 B
regression "cannot reappear under it" no longer holds as a size-only guarantee at the current
ceiling; the rebuild-jitter allowance (773 B) is a doctrine, not a measured variance; and
"every prompt" in the manifest comment is more precisely "once per prompt key".
