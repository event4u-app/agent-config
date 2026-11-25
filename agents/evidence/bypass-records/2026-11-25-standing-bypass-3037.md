---
reason: PR #3037 (arena-route) was red on the required check "Sync + Generate Tools Consistency", at the step "Kernel / governance-hook edits carry a ratification artifact" alone — the modification review split after three two-provider rounds (anthropic confirmed-non-expanding, openai refused with DEALBREAKER yes); the owner chose in session on 2026-11-25 to override the split and merged over the step
subject: b961654c49b18541901dcba53a44bece4f9c469c22f26d7356cad21a7a114477
time: 2026-11-25T14:12:26Z
commit: 2404338fffd35f392f656b4976a900bc6d5e8f6c
ruleset_version_before: 56735008
ruleset_version_after: 56735008
restore_by: 2026-12-02T14:12:26Z
restored_at: superseded-by-owner-ruling agents/evidence/owner-directives/2026-10-25-standing-pull-request-bypass.md
council_review: pending
---
<!-- evidence-type: bypass-record -->

# Bypass — PR #3037, arena-route

Under the standing actor that `2026-10-25-standing-pull-request-bypass.md` keeps
(ruleset `17749383`, version `56735008`, unchanged by this merge — the forge's
ruleset history shows no newer version). The PR's one red required check was
"Sync + Generate Tools Consistency". It failed only at the ratification step,
on four gated paths: `src/config/hook-latency-budget.json`,
`src/scripts/hook_manifest.json`, `src/scripts/hook_manifest.yaml` and
`src/scripts/hooks/egress_stage.ts`.

- **Why it was red:** the record
  `agents/evidence/ratifications/arena-route-20261125.md` carries
  `verdict: refused`, derived from the seats. A recorded owner decision cannot
  turn that green, by contract (`docs/contracts/ratification-artifact.md`
  § The owner-permission-route).
- **Who decided:** the repository owner, in session on 2026-11-25. The decision,
  with its expected gain, risk and rollback, is written in the record's section
  "Owner decision on the split (ADR-282)".
- **Who executed:** the owner, by merging on the forge (merged by the owner's
  account at `2026-11-25T14:12:26Z`).
- **This record was written after the fact:** it was written on 2026-11-25,
  after a release dispatch failed. The release job's source-check gate read
  this red check on `main`'s tip and refused, with "Nothing was released."
- **Still owed:** the after-the-fact council review of the bypassed change,
  due seven days after `restore_by`. The follow-up roadmap
  `road-to-owner-overrides-that-do-not-block-releases` carries that review as
  its first step.
