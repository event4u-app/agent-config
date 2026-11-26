---
reason: PR #3049 (session-title) was red on the required check "Sync + Generate Tools Consistency", at the step "Kernel / governance-hook edits carry a ratification artifact" alone — the modification review split after three two-provider rounds (anthropic ratified, openai refused with DEALBREAKER yes); the owner chose in session on 2026-11-26 to land over the split and ordered the merge
subject: 95e177dbecf213caff279ed810f8e2bc78e484dcf27e4bad6caea7236cab5c4f
time: 2026-11-26T20:50:46Z
commit: ab3211c306724c040c157a79c9e6f267d087aed0
ruleset_version_before: 56735008
ruleset_version_after: 56735008
restore_by: 2026-12-03T20:50:46Z
restored_at: superseded-by-owner-ruling agents/evidence/owner-directives/2026-10-25-standing-pull-request-bypass.md
council_review: pending
---
<!-- evidence-type: bypass-record -->

# Bypass — PR #3049, session-title

Under the standing actor that `2026-10-25-standing-pull-request-bypass.md` keeps
(ruleset `17749383`, version `56735008`, unchanged by this merge — the forge's
ruleset history shows no newer version). The PR's one red required check was
"Sync + Generate Tools Consistency". It failed only at the ratification step,
on two gated paths: `src/scripts/hook_manifest.json` and
`src/scripts/hook_manifest.yaml`. The other 46 checks were green.

- **Why it was red:** the record
  `agents/evidence/ratifications/session-title-20261126.md` carries
  `verdict: refused`, derived from the seats. A recorded owner decision cannot
  turn that green, by contract (`docs/contracts/ratification-artifact.md`
  § The owner-permission-route).
- **Who decided:** the repository owner, in session on 2026-11-26: first to land
  over the split, then, on the open pull request, "fixe die ci, wenn es geht und
  danach (auch wenn es nicht geht) merge den pr". The decision, with its
  expected gain, risk and rollback, is written in the record's section "Owner
  decision on the split (ADR-282)".
- **Who executed:** the agent session acting on that order, by an administrator
  merge (`gh pr merge --admin`) at `2026-11-26T20:50:46Z`. The ruleset was not
  edited.
- **This record was written after the fact:** on 2026-11-27, so the release the
  owner asked for is not refused by the red check on `main`'s tip, the same
  failure #3037 hit.
- **Still owed:** the after-the-fact council review of the bypassed change. The
  roadmap `road-to-owner-overrides-that-do-not-block-releases` carries the
  review of the #3037 bypass as its first step; this one is owed the same way.
