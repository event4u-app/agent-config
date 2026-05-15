---
type: "auto"
tier: "2a"
description: "Drafting strategic recommendations, executive memos, board decks, or consulting deliverables — cite the assumptions every recommendation rests on; flag low-confidence claims"
source: package
triggers:
  - keyword: "strategic recommendation"
  - keyword: "board memo"
  - keyword: "executive summary"
  - keyword: "consulting deliverable"
  - keyword: "go-to-market plan"
  - phrase: "what should we do"
  - phrase: "recommend a strategy"
routes_to:
  - "skill:stakeholder-tradeoff"
  - "skill:decision-record"
applies_to_user_types:
  - "consultant"
---

# Domain Safety — Consulting / Strategic Disclaimer

## Iron Law

```
EVERY STRATEGIC RECOMMENDATION CITES ITS LOAD-BEARING ASSUMPTIONS.
EVERY LOW-CONFIDENCE CLAIM IS LABELED. NO HIDDEN PRIORS.
```

Strategic advice from an AI without surfaced assumptions is the worst kind of advice: it looks authoritative, but the reader can't see which inputs the recommendation rests on. The disclaimer here is structural, not a footer line — bake assumption-citation into the draft itself.

## Required structure for any strategic deliverable

Every recommendation must include:

1. **Assumptions section.** 3-5 bullets naming the load-bearing priors (market size, competitive response, internal capacity, regulatory stability, customer demand). If any one of these flips, the recommendation flips.
2. **Confidence label per claim.** High / Medium / Low — verifiable from cited data → High; reasoned but unverified → Medium; speculative → Low.
3. **Inversion check.** One paragraph: *"This recommendation fails if [X happens]. The early signal to watch is [Y]."*

## Disclaimer footer (append in addition to structure)

> **AI-generated strategic analysis.** This recommendation was drafted by an AI assistant based on the assumptions stated above. It is one input among several and should not be acted on without human review, validation against current data, and stakeholder consultation. Confidence labels are the AI's self-assessment, not an external audit.

German equivalent:

> **KI-generierte Strategieanalyse.** Diese Empfehlung wurde von einem KI-Assistenten auf Basis der oben genannten Annahmen erstellt. Sie ist ein Input unter mehreren und sollte nicht ohne menschliche Prüfung, Abgleich mit aktuellen Daten und Stakeholder-Konsultation umgesetzt werden. Konfidenzangaben sind die Selbsteinschätzung der KI, kein externer Audit.

## See also

- `skill:stakeholder-tradeoff` — competing-lens framing.
- `skill:decision-record` — ADR pattern for locking the choice.
- `skill:adversarial-review` — pre-commit stress test on the recommendation.
