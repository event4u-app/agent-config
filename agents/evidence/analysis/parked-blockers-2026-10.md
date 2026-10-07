<!-- evidence-type: analysis -->

# Parked blockers — the census, 2026-10

Phase 1 of `road-to-parked-blockers-that-get-asked`. Measured on `main` @
`adaad0aa2`, 2026-10-07, so the council deciding blocker
`later-blockers-in-scope` decides on a count rather than a guess.

## The command

```bash
./scripts-run src/scripts/report_parked_blockers            # text
./scripts-run src/scripts/report_parked_blockers --format json
```

It reads only `agents/roadmaps/later/*.md` — the directory both
`lint_roadmap_blockers` and `/roadmap:resolve-blockers` exclude — and exits 0
whatever it finds.

## The headline

| Measure | Value |
|---|---|
| `.md` files in `later/` | 100 |
| Files with at least one open blocker | 40 |
| Open blocker entries | 60 |
| …waiting on the owner (`Owner:` maintainer / user / owner) | 51 |
| …waiting on an agent-reachable condition (implementer, council, a run) | 9 |
| Blockquote lines naming an owner question or owner decision | 8 |
| …of which in a file with no `### blocker:` entry at all | 4 (3 files) |

The roadmap's own count was 40 of 99 at `a75bb3210` on 2026-10-06. One file
has entered `later/` since; the number of files carrying an open blocker is
unchanged at 40 of 100. The file count is not the question count: 40 files
hold 60 open entries, and 51 of them name the owner.

**Classification is mechanical and printed beside the raw value.** `Owner:` is
free text; the report classifies a value as owner-wait when it starts with
`maintainer`, `user` or `owner` — the same set `lint_roadmap_blockers` already
treats as a user decision — and prints the value verbatim so a misread is
visible. Two readings a reviewer may want to override: `council` is classed
agent-wait (the council is reachable without the owner), and
`any autonomous process-full run` is agent-wait.

**The blockquote list over-matches by design.** It flags any quoted line
containing "owner question" or "owner decision". Of the 8, the posed questions
are `road-to-release-finding-ordering.md:29`,
`road-to-mixed-trigger-activation-cost.md:25`,
`road-to-worker-generation-recycling.md:23` and
`road-to-experience-loop-owner-decisions.md:52`; the rest mention an owner
decision in passing. Phase 3 of the roadmap converts the release-ordering one.

## Raw output

```text
Parked blockers under agents/roadmaps/later/
files scanned: 100 · files with an open blocker: 40 · open blockers: 60 (owner-wait 51, agent-wait 9)

## owner-wait (51)
- agents/roadmaps/later/road-to-a-release-record-that-says-what-it-reviewed-carried.md · review-ceiling-is-spend · Owner: owner · Status: open
- agents/roadmaps/later/road-to-a-release-record-that-says-what-it-reviewed-carried.md · container-e2e-promotion · Owner: owner · Status: open
- agents/roadmaps/later/road-to-a-stop-that-holds-carried.md · kill-switch-owner-decision · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-a-stop-that-holds-carried.md · d1-stop-ladder-after-reading · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-a-trunk-whose-own-gates-are-green-carried.md · legal-user-type-is-a-product-call · Owner: owner · Status: open
- agents/roadmaps/later/road-to-an-obligation-row-that-names-its-writer-carried.md · shadow-corpus-is-one-machine · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-billing-cliff-detection.md · billing-cliff-signal-existence · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-capability-native-execution.md · b-adr-088-external-runtime-federation · Owner: maintainer · Status: open (partially resolved 2026-08-29)
- agents/roadmaps/later/road-to-carrier-layer-convergence.md · b-convergence-machine · Owner: user · Status: open
- agents/roadmaps/later/road-to-catalogue-host-fit.md · b-live-trigger-eval · Owner: user · Status: open
- agents/roadmaps/later/road-to-composite-dispatch-topology.md · orchestration-claim-queue · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-composite-dispatch-topology.md · post-hook-capture-rate · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-conformance-round7-followup.md · commit-policy-remote-state-deliverable · Owner: user — the maintainer. · Status: open
- agents/roadmaps/later/road-to-corpus-knowledge-skills.md · first-corpora-named · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-corpus-knowledge-skills.md · compiler-scope-council-review · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-cost-parity-2-state-aware-dispatch.md · orchestration-claim-queue · Owner: user · Status: open
- agents/roadmaps/later/road-to-cost-parity-2-state-aware-dispatch.md · per-role-floor-scope-decision · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-council-topology-evidence-followups.md · council-seats-below-five · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-council-topology-evidence-followups.md · leakage-bench-two-day-window · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-council-topology-evidence-followups.md · no-qualifying-live-run · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-delivery-on-hook-hosts.md · no-host-observed-true-injection · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-evidence-calibrated-model-orchestration.md · b-orchestration-corpus-adequacy · Owner: maintainer · Status: OPEN
- agents/roadmaps/later/road-to-federation-behind-adr-278.md · adr-278-not-accepted · Owner: user · Status: open
- agents/roadmaps/later/road-to-first-reference-analysis-observation.md · fetch-is-owner-reserved · Owner: maintainer · Status: OPEN
- agents/roadmaps/later/road-to-host-catalogue-contract.md · b-host-catalogue-build-pin · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-host-claims-the-tree-contradicts-carried.md · upst-timeout-witness · Owner: owner · Status: open
- agents/roadmaps/later/road-to-language-and-tone-enforcer-claim.md · b-kernel-rule-edit · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-learning-you-can-see-carried.md · learning-window-and-owner-amendment · Owner: owner · Status: open
- agents/roadmaps/later/road-to-mixed-trigger-activation-cost.md · b-behavioural-bench-spend · Owner: user · Status: open
- agents/roadmaps/later/road-to-originality-gate-and-contributor-funnel.md · npm-publish-go · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-product-bets.md · simple-expert-mode-demand-evidence · Owner: user · Status: open
- agents/roadmaps/later/road-to-regulatory-radar.md · b-regulatory-owner-and-cadence · Owner: user · Status: open
- agents/roadmaps/later/road-to-regulatory-radar.md · b-regulatory-knowledge-home · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-release-holds-that-refuse.md · measurement-window-not-open · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-release-holds-that-refuse.md · zero-live-subjects · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-skill-ecosystem-capability-queue.md · capacity-slot · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-skill-ecosystem-capability-queue.md · marketing-domain-gates · Owner: user · Status: open
- agents/roadmaps/later/road-to-skill-ecosystem-executable-payloads.md · phase-0-spikes-need-a-live-host-session · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-skill-ecosystem-security-and-conformance.md · verification-slot · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-skill-ecosystem-security-and-conformance.md · signing-key-custody · Owner: user · Status: open
- agents/roadmaps/later/road-to-skill-menu-economy.md · step-1-2-menu-exclusion-lever-unbuilt · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-source-silence-cutover.md · agent-cannot-provision-a-secret · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-surface-consolidation.md · repo-admin-and-usage · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-surface-consolidation.md · benchmark-spend · Owner: user · Status: open
- agents/roadmaps/later/road-to-token-proof-and-story.md · flip-gates-upstream (inherited) · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-token-proof-and-story.md · field-corpus-privacy · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-touched-files-that-pass-their-own-tools-carried.md · touched-file-quality-default-is-an-owner-call · Owner: owner · Status: open
- agents/roadmaps/later/road-to-worker-generation-recycling.md · capsule-quality-near-budget · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-worker-generation-recycling.md · host-worker-respawn · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-worker-generation-recycling.md · orchestrator-only-mode-decision · Owner: maintainer · Status: open
- agents/roadmaps/later/road-to-zero-ceremony-host-primitives.md · adr-035-review-window · Owner: maintainer · Status: open

## agent-wait (9)
- agents/roadmaps/later/road-to-a-menu-whose-precision-is-measured.md · e3-witness-set-is-empty-here · Owner: implementer · Status: open
- agents/roadmaps/later/road-to-a-stop-that-holds-carried.md · q1-shadow-reading-window · Owner: implementer · Status: open
- agents/roadmaps/later/road-to-a-stop-that-holds-carried.md · obligation-shadow-bar-window · Owner: implementer · Status: open
- agents/roadmaps/later/road-to-a-stop-that-holds-carried.md · obligation-shadow-rows-live · Owner: implementer · Status: open
- agents/roadmaps/later/road-to-ac-deep-capabilities.md · b-deep-caps-offsets-unnamed · Owner: council · Status: open
- agents/roadmaps/later/road-to-episode-finalizer-and-outcome-attribution-v2.md · b-machine-local-denominator · Owner: council · Status: open
- agents/roadmaps/later/road-to-first-reference-analysis-observation.md · shadow-pin-is-post-upgrade · Owner: council · Status: OPEN
- agents/roadmaps/later/road-to-regulatory-radar.md · b-legal-floor-wiring · Owner: implementer · Status: open
- agents/roadmaps/later/road-to-run-continuation-observation.md · three-phase-contract-run · Owner: any autonomous `process-full` run, no dedicated effort · Status: open

## owner questions in blockquotes (8)
- agents/roadmaps/later/road-to-experience-loop-owner-decisions.md:52 · blocker entries in file: 0
- agents/roadmaps/later/road-to-mixed-trigger-activation-cost.md:25 · blocker entries in file: 2
- agents/roadmaps/later/road-to-post-pr-promotion-workflow.md:470 · blocker entries in file: 0
- agents/roadmaps/later/road-to-release-finding-ordering.md:21 · blocker entries in file: 0
- agents/roadmaps/later/road-to-release-finding-ordering.md:29 · blocker entries in file: 0
- agents/roadmaps/later/road-to-release-holds-that-refuse.md:159 · blocker entries in file: 3
- agents/roadmaps/later/road-to-source-silence-cutover.md:54 · blocker entries in file: 3
- agents/roadmaps/later/road-to-worker-generation-recycling.md:23 · blocker entries in file: 3
```

Long `Status:` tails and blockquote excerpts are trimmed above; the
`--format json` output carries them verbatim.
