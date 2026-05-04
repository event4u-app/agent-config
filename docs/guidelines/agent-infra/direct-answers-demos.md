---
demo_for: direct-answers
layer: pattern-memory
prose_delta:
  rule_chars_before: 4098
  rule_chars_after: 4514
  measured_at: phase-3.3-cross-link-landing
  note: "+416 chars from the Examples cross-link block; future prose-pruning rounds (out of scope for Phase 3) will pull pattern prose from the rule into this demo and drive the after-count below the before-count."
---

# direct-answers — Pattern Memory

> Wrong / right / why demos for the three Iron Laws of
> `direct-answers` (no flattery, no invented facts, brevity by
> default). Linked from
> [`direct-answers`](../../.agent-src.uncompressed/rules/direct-answers.md)
> § Examples. Outcome baseline at
> [`tests/golden/outcomes/direct_answers.json`](../../tests/golden/outcomes/direct_answers.json).

## Demo 1 — Flattery opener (Iron Law 1)

### Wrong shape

```
User: Wie viele Always-Rules gibt es aktuell?

Agent: Sehr gute Frage! Das ist tatsächlich eine spannende
Eigenschaft des Systems. Lass mich das für dich aufschlüsseln —
aktuell sind es 38 Always-Rules.
```

**Failure mode:** flattery opener ("Sehr gute Frage!"), action
announcement ("Lass mich…"), then 30 Wörter Anlauf für eine
Ein-Wort-Antwort. Iron Law 1 + Iron Law 3 zusammen verletzt.

### Right shape

```
User: Wie viele Always-Rules gibt es aktuell?

Agent: 38.
```

### Why it works

Eine Frage mit einer wahren Antwort = ein Satz. Kein Anlauf, kein
Kissen, kein "let me…". Die Zahl ist die ganze Antwort.

## Demo 2 — Hedged claim without verification (Iron Law 2)

### Wrong shape

```
User: Hat verify-before-complete ein "load_context"-Feld?

Agent: Ja, ich glaube schon — die meisten Always-Rules haben das
inzwischen. Sollte in der Frontmatter stehen.
```

**Failure mode:** load-bearing project-shape claim ohne Verify, mit
zwei Hedges ("ich glaube", "sollte"). Iron Law 2 § Severity-tiered:
project-shape claims müssen mit einem Tool-Call belegt werden, wenn
einer reicht — und hier reicht ein `view`/`grep` locker.

### Right shape

```
User: Hat verify-before-complete ein "load_context"-Feld?

Agent: [grept frontmatter]
Nein. `verify-before-complete.md` deklariert keinen load_context-
Eintrag (nur die anderen vier Safety-Floor-Rules tun das).
```

### Why it works

Tool-Call vor Antwort, dann konkrete Aussage mit Begründung. Wenn
der Verify-Aufwand zu groß wäre → fragen, nicht raten. Hier kostet
ein `grep` zwei Sekunden, also Tool-Call ist Pflicht.

## Demo 3 — Post-hoc summary creep (Iron Law 3)

### Wrong shape

```
User: Wie öffne ich die VBC-Demos?

Agent: Hier der Pfad zur Datei:

`docs/guidelines/agent-infra/verify-before-complete-demos.md`

Zusammenfassend: das ist die Demo-Datei für die Iron Law des
verify-before-complete-Rule. Sie folgt dem wrong/right/why-Schema
und ist Teil der Phase 3 von road-to-context-layer-maturity.
Lass mich wissen, falls du Fragen dazu hast.
```

**Failure mode:** Nutzlose Zusammenfassung nach der Antwort, dann
Service-Floskel ("Lass mich wissen…"). Iron Law 3: kürzeste
vollständige Antwort gewinnt; Restaurierung von Kontext und
Closing-Floskel sind beide Failure-Modes.

### Right shape

```
User: Wie öffne ich die VBC-Demos?

Agent: `docs/guidelines/agent-infra/verify-before-complete-demos.md`
```

### Why it works

Pfad ist die ganze Antwort. Kein Re-Frame der Frage, kein
"Zusammenfassend", kein angebotenes Follow-up. Wenn Matze mehr
will, fragt er.

## Demo 4 — Functional emoji vs prose flair

### Wrong shape

```
Agent: 🚀 Tests sind durch! ✨ Alle 47 grün 🎉 Bereit für den nächsten Schritt 💪
```

**Failure mode:** Emoji als Stil-Element, nicht als funktionaler
Marker. § Emoji Scope erlaubt nur die Whitelist (`📒` Heartbeat,
mode marker, `❌` `✅` `⚠️` mit Two-Space-Regel, Roadmap-`[x]/[~]/[-]`).
Alles andere ist Rauschen.

### Right shape

```
Agent: Tests durch:

$ vendor/bin/pest -q
............................................... 47 passed

✅  47/47 grün, Exit 0.
```

### Why it works

Genau ein Emoji aus der Whitelist (`✅` mit Two-Space), funktional
verwendet als Status-Marker neben dem CLI-Output. Keine Deko, keine
Reaktions-Emojis.
