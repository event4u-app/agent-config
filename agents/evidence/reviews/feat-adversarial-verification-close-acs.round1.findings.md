# Findings: feat-adversarial-verification-close-acs
<!-- completion-review: v1 | reviewed: 2026-09-30 | scope: 765df03e68f8c051444beec0caba666193704e006fbabdfb7ee71b1134305a85 | diff: 4c2c36bef361a755bef1a35c8dc2f11ac20fe4f1 | reviewer: r2-fresh-subagent-feat-adversarial-verification-close-acs | prompt_hash: 803a7b25db48c0683048f6b8979b48781584664d2d83014f72d8d705719ebdf4 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-feat-adversarial-verification-close-acs"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-09-30 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 4c2c36bef361a755bef1a35c8dc2f11ac20fe4f1
  scope_hash: 765df03e68f8c051444beec0caba666193704e006fbabdfb7ee71b1134305a85
  roadmap: agents/roadmaps/road-to-adversarial-verification-and-long-runs.md
  roadmap_hash: 7ce6c1cf6fc4757e2f17daa845c8d53cba596dc46221048b50f8dd445734c200
  ac_hash: 5bac96ba975815debb7d9695b0045f861f1cec0c60524d35ba7962c18a382cba
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-09-30T16:01:58Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/_lib/forge_protection.ts:119-124 | `deployRestrictedFrom` returns `true` (vacuously "restricted") for an empty `environments` array. This collapses "confirmed zero environments" and "the fetch of `GET .../environments` failed or returned an empty/short page" into the same `satisfied` result. That is the opposite of this module's own repeatedly-stated design invariant (`ForgeReading`'s three-state contract, `forgeProtectionRows`'s doc comment: "a row that was not read says so ... unread, which is a third state and never a false"). The function's boolean-only return type gives a future caller no way to signal "not read" — the AC-5 closure note in this same diff frames `deployRestrictedFrom` as the fix that will make the `deploy_via_pipeline_only` row trustworthy going forward, but as written it will silently report `satisfied` if a future wiring's environments fetch comes back empty for the wrong reason. | fixed | 5cd16cbcd — returns `null` for an empty set, which maps to the `unread` row state |
| 2 | low | src/scripts/_lib/forge_protection.ts:119-124 | The restriction check treats `custom_branch_policies === true` as sufficient evidence of restriction without inspecting the actual named branch/tag patterns (only available via the separate `GET .../environments/{name}/deployment-branch-policies` call). GitHub deployment-branch-policy names accept glob patterns, so a custom policy whose pattern is a broad wildcard (e.g. `*`) would still report `custom_branch_policies: true` while not actually restricting the environment to a specific branch — a case indistinguishable, from this function's inputs alone, from the single-named-branch (`main`) case it was built to detect. Not exploitable on the one environment this repo currently has (verified `main`-only in the roadmap note), but the function offers no signal that this narrower guarantee wasn't checked. | fixed | 5cd16cbcd — optional `patternsByEnv` refutes a wildcard policy; flag-only path documented as the narrower guarantee |
