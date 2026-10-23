<!-- evidence-type: analysis -->

# Inbox round `inbox-2026-10-aa` — point ledger and coverage

Round: one topic, four files (`chat.txt` 367 lines, a supplied repo-format plan 245, a second
reviewer's P0–P5 plan 182, an annex of 21 findings 98), 200 source anchors (`inbox_source_census`),
lineage clean. Verified 2026-10-23 at `feat/subagent-system-2583-rest@23fbc95112` by three
read-only verifier passes (D1–D2, D3–D4, D5) plus direct reads. Emitted roadmap:
`agents/roadmaps/road-to-a-tick-the-shipped-path-earns.md`.

Passes: pass 1 extracted the rows below; pass 2 (inverted question, sources open) added F13, F14,
F20, the P0.3 fingerprint and the chat's blocker-status-text demand; pass 3 found every
`adopted` row in a roadmap step or decision. Converged at pass 2.

## Annex findings F1–F21

| F | Verdict at the live tree | Disposition |
|---|---|---|
| F1 | overtaken — O1–O3 (2026-10-23) made A7, A9, A10, D11 owner rows; two blocker `Status:` texts still name the council | adopted, 1.1 (text), 2.2–2.3 (lint) |
| F2 | still-true (`ac-worker.md:34`, `ac-researcher.md:31`; `composeSpawnBrief` has no production caller) | adopted, 1.2, 2.4 |
| F3 | still-true (`ac-researcher.md:7` `lite`, `:13-14` web tools) | adopted, 1.3 |
| F4 | still-true (`orchestration_record_hook.ts:309-316`) | adopted, 1.3 note + 4.2 |
| F5, F6 | still-true (`internal/bench/tier-downshift/run.ts:25,37-69,152`) | adopted, 4.1 |
| F7 | still-true (`tier_downshift_verdict.ts:171-174`) | adopted, 4.2 |
| F8 | still-true (`internal/bench/pricing.yaml:14-20`) | adopted, 4.3 |
| F9 | still-true, bodies survive in all four probes (`hand_payload.ts`) | adopted, 5.1 |
| F10 | still-true (`route_chooser.ts:152`, no client sets the field) | adopted, 5.2 |
| F11 | still-true (shadow without the hand contract) | adopted, 5.3 |
| F12 | by design fail-closed: an unproven member counts as paid, so it may chair — the defect is that a route member may chair at all | adopted, 5.4 |
| F13 | still-true (`clients.ts:943,959`, `ask_transport.ts:251,412`) | adopted, 5.2 scope |
| F14 | unverifiable without the census the reviewer ran | declined — no tree evidence; revisit with a host census |
| F15 | still-true (`clients.ts:1467`, `blind: false` at `:1678`, `:1825`) | adopted, 5.5 |
| F16 | still-true (`quota_parked.ts:78-79`) | adopted, 5.6 |
| F17 | still-true (`hooks/hooks.json:103-108`) | adopted, 5.7 |
| F18 | still-true (`egress_normalize.ts` test-only) | adopted, 1.4, 3.2 |
| F19, F20 | still-true (`identifier_redaction.ts:14`) | adopted, 4.4 |
| F21 | still-true (cold-start 4.3 text, settings description) | adopted, 5.8 |

## Second reviewer's plan

| Item | Disposition |
|---|---|
| P0.1, P0.2 | adopted as 6.1 (replay of every #2585 tick) |
| P0.3 | adopted, 6.2 |
| P0.4 | declined (K8) — `main` residue, owned by the eval-freshness gate |
| P1.1–P1.4, P2.1–P2.4, P3.2–P3.4, P4.1–P4.4, P5.1–P5.3 | declined (K7) — programmes without a reproduced defect; overlap the owners that plan's own § 8 names |
| P3.1 | adopted in substance, 4.2 (re-decide the tier flip on bound evidence) |

## Chat demands (owner turns)

| Demand | Disposition |
|---|---|
| Continue the LLM roadmaps of #2585 | adopted — this roadmap |
| Correctness and evidence before more routing | adopted, Goal + Phases 2–4 |
| Are the owner blockers still open? | answered by O1–O3; residual status text adopted, 1.1 |
| Revert the two consumer-facing flips before the next release | adopted, 1.2, 1.3 |
