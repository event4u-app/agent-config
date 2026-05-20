# Script Archive — One-Shot Migrations

This directory preserves migration / bootstrap / back-fill scripts that have
already run to completion and are no longer invoked by any productive code
path. They are kept as forensic reference, mirroring the archival convention
used by [`agents/roadmaps/archive/`](../../agents/roadmaps/archive/).

**Do not run these scripts.** They are one-shot transformations whose
target state is already the working tree. Re-running them on the current
codebase is undefined behaviour.

## Provenance

Archived 2026-05-14 as part of [`agents/roadmaps/step-1-v2-feedback-followup.md`](../../agents/roadmaps/step-1-v2-feedback-followup.md)
Phase 1 Step 3, addressing audit finding F3 / council finding C3 from
[`agents/runtime/council/sessions/2026-05-14-v2-analysis/feedback/03-migration-scripts-archival.md`](../../agents/runtime/council/sessions/2026-05-14-v2-analysis/feedback/03-migration-scripts-archival.md).

## Inventory

| Script | Migration / phase served | What it did |
|---|---|---|
| [`_backfill_skill_domains.py`](_backfill_skill_domains.py) | B3 domain back-fill | Injected `domain:` frontmatter into every `SKILL.md`. Source of truth now lives in each skill's frontmatter directly. |
| [`_bootstrap_tier_frontmatter.py`](_bootstrap_tier_frontmatter.py) | Tier-frontmatter bootstrap | Injected `tier: N` frontmatter into every slash command during the kernel / tier-1 / tier-2 routing introduction. |
| [`_p43_bodies.py`](_p43_bodies.py) | Phase 4.3 — rule-body compression | Wrote compressed rule bodies after `_p43_compress.py` produced the manifest. Paired with `_p43_compress.py`. |
| [`_p43_compress.py`](_p43_compress.py) | Phase 4.3 — rule-body compression | Surgical compression of 22 `compress-and-keep` auto-rules; produced the manifest consumed by `_p43_bodies.py`. |
| [`_p4_migrate.py`](_p4_migrate.py) | Phase 4.1 + 4.2 — rule reclassification | Migrated rules into the skill / guideline / command / contract-stub split that the package ships today. |
| [`_phase2_shim_helper.py`](_phase2_shim_helper.py) | Phase 2 — deprecation shim | One-shot helper that injected `superseded_by:` + `deprecated_in:` + deprecation warning into rules retired during Phase 2. |
| [`_pilot_council_question.py`](_pilot_council_question.py) | Phase 1 pilot — kernel-membership council prep | Built the Phase-1 council question file used for the kernel-membership R1/R2 cross-check. The resulting council artefacts live under `agents/runtime/council/sessions/20260506T*`. |

## Why these stayed live and were NOT archived

The 2026-05-14 audit (F3) listed 9 candidate scripts. Two of those turn out
to have productive (non-incestuous) references and remain in `scripts/`:

- **`scripts/_emit_domain_table.py`** — cited as the regeneration command in
  [`docs/contracts/skill-domains.md`](../../docs/contracts/skill-domains.md)
  ("regenerate via `python3 scripts/_emit_domain_table.py`"). The
  domain-table snapshot is a derived view that the contract doc explicitly
  expects to be regenerable from this script.
- **`scripts/_pilot_measure.py`** — cited by
  [`docs/contracts/kernel-membership.md`](../../docs/contracts/kernel-membership.md)
  as the reproducibility-verification command for the kernel pilot SHAs, and
  its algorithm is mirrored by [`scripts/iron_law_sha.py`](../iron_law_sha.py).
  Both productive paths assume the script remains in place.

The audit's F3 framing ("zero productive references") was correct for the 7
archived scripts and wrong for these 2. Recorded here so the F3 finding is
not re-litigated without context.

## How to restore one (if a future migration needs it)

```bash
git mv scripts/_archive/<script>.py scripts/
git commit -m "chore(scripts): restore <script> for <reason>"
```

Restoration should come with an issue / PR explaining why the historical
one-shot is being reused — by construction these scripts assume their
pre-migration starting state.
