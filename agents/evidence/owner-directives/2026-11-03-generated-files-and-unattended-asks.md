<!-- evidence-type: analysis -->

# Owner directive 2026-11-03 — answers to Q1 and Q2 of road-to-generated-files-and-unattended-asks

Recorded verbatim from chat, 2026-11-03:

> 1 nur warnen, 2 ja unbeaufsichtigt <!-- md-language-check: ignore -->

EN: (1) only warn; (2) yes, unattended.

| Question | Answer |
|---|---|
| Q1 — target posture of the consumer generated-file guard | advisory (warn only), never blocking |
| Q2 — does a `/roadmap:process-full` started from an attended chat count as unattended? | yes — it never waits on `AskUserQuestion`; it parks the question and continues with the next independent step |
