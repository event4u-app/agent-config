# Roadmap: Augment + Agent Memory Hybrid

> **⚠️ SUPERSEDED** by `agents/roadmaps/agent-memory-hybrid.md`
> This German version is kept for historical reference. The active roadmap is agent-agnostic and in English.

## Zielbild

Wir bauen ein eigenes **"Augment + Agent Memory Hybrid"**-System, das die Stärken von zwei Welten kombiniert:

* **Augment Code** liest die aktuelle Codebasis, versteht Strukturen, Beziehungen, Diff-Kontext und Refactorings.
* **Claude Opus** übernimmt Planung, Synthese, Validierung, Wissensextraktion und Pflege des Memory-Layers.
* **Ein eigener Memory-Layer** speichert langfristig relevantes Projektwissen, damit nicht bei jeder Session alles neu hergeleitet werden muss.
* **Git History + Code-Index + Invalidation-Regeln** sorgen dafür, dass gespeichertes Wissen nicht blind vertraut wird, sondern gegen den aktuellen Stand geprüft wird.

Das Ziel ist **nicht**, Augment zu ersetzen. Das Ziel ist, **Augment zu ergänzen**:

> Augment liefert frischen Code-Kontext.
> Memory liefert langlebigen Arbeitskontext.
> Invalidation verhindert, dass altes Wissen gefährlich wird.

---

## WICHTIG

Frag vorher noch einmal nach, ob Du die Roadmap analysieren und ggf. anpassen sollst.
Vor allem, da es ein **Hybrid-System** ist, und andere Agents auch damit arbeiten können sollten.

---

## Kernthese

Ja, die Kombination ist sinnvoll.

Weil Augment ohnehin den Code liest, kann es als **Fresh Context Engine** dienen. Das Memory-System muss dann nicht die "Wahrheit" sein, sondern ein **hypothesenbasiertes Wissenssystem**:

* Es speichert Annahmen, Entscheidungen, Architekturwissen, Konventionen, Fallstricke und frühere Erkenntnisse.
* Vor Nutzung wird dieses Wissen anhand von Code, Git-Diffs, Commit-History und gezielten Checks validiert.
* Bei relevanten Änderungen wird Wissen invalidiert, herabgestuft oder neu aufgebaut.

Damit bekommt ihr das Beste aus beiden Welten:

* weniger Vergessen
* schnellere Agentenarbeit
* trotzdem kein blindes Vertrauen in veraltetes Memory

---

## Was das System können soll

### Funktionale Ziele

* Persistentes Projektgedächtnis pro Repository, Domain und Feature
* Erinnerung an:

    * Architekturentscheidungen
    * Domainregeln
    * bekannte Bugs / Workarounds
    * Coding-Konventionen
    * Integrationswissen
    * Refactoring-Historie
    * Teststrategien
    * Release-Fallen
* Semantische Suche über dieses Wissen
* Verknüpfung von Wissen mit:

    * Dateien
    * Symbolen
    * Modulen
    * PRs
    * Commits
    * Tickets
* Automatische Revalidierung bei Codeänderungen
* Teilweise oder vollständige Invalidation veralteter Einträge
* Agentenfreundliche Ausgabeformate für Augment / Claude

### Nichtfunktionale Ziele

* nachvollziehbar
* versionsfähig
* erweiterbar
* lokal oder self-hosted betreibbar
* keine Black Box
* klare Vertrauensstufen für gespeichertes Wissen

---

## Leitprinzipien

1. **Code ist die primäre Wahrheit.**
2. **Memory ist hilfreich, aber nie unangreifbar.**
3. **Jeder Memory-Eintrag hat Herkunft, Scope und Vertrauensstatus.**
4. **Invalidation ist Pflicht, nicht Kür.**
5. **Wissen wird möglichst atomar gespeichert.**
6. **Nur wiederverwendbares Wissen wird persistiert.**
7. **Temporäre Session-Notizen und langlebiges Projektwissen werden getrennt.**

---

## High-Level-Architektur

```text
+---------------------+
|  Augment Code       |
|  Fresh code context |
+----------+----------+
           |
           v
+---------------------+
| Claude Opus         |
| Planner / Synthesizer|
+----+-----------+----+
     |           |
     |           v
     |    +----------------------+
     |    | Memory Orchestrator   |
     |    | ingest / validate /   |
     |    | retrieve / invalidate |
     |    +----+-------------+----+
     |         |             |
     v         v             v
+---------+ +--------+ +----------------+
| Git     | | Vector | | Relational /   |
| History | | DB     | | Graph / JSON   |
+---------+ +--------+ +----------------+
     |                       |
     v                       v
+---------------------------------------+
| Extractors / Indexers / Validators    |
| AST, symbols, docs, ADRs, tests, PRs  |
+---------------------------------------+
```

---

## Empfohlener Technologie-Stack

### LLM / Agent Layer

* **Augment Code** für Codebase-Lesen, Multi-File-Verständnis, Umsetzungen
* **Claude Opus** für:

    * Architekturdenken
    * Wissensextraktion
    * Planen
    * Bewertung von Relevanz
    * Konsolidierung von Memory

### Programmiersprache

* **TypeScript** oder **Python**

Empfehlung:

* **TypeScript**, wenn ihr nah an IDE / Tooling / Node / MCP-artigen Integrationen bleiben wollt
* **Python**, wenn ihr stärker mit AST, Data Pipelines, Embeddings und ML-nah arbeiten wollt

Wenn ihr bereits Laravel + React / TS-lastig seid, ist **TypeScript** für den Orchestrator oft die pragmatische Wahl.

### Persistence

* **Vector DB**:

    * pgvector
    * Qdrant
    * Weaviate

Pragmatische Empfehlung:

* **Postgres + pgvector** für Version 1

### Strukturierte Metadaten

* **Postgres** oder SQLite für lokal

### Optional Graph Layer

* Neo4j oder Postgres-Relationen, wenn ihr später echte Beziehungsgraphen braucht

### Parsing / Analyse

* Tree-sitter oder sprachspezifische Parser
* Optional LSP / symbol extraction
* Git CLI für Commit- und Diff-Analyse

### Jobs / Pipelines

* BullMQ / Temporal / simple queue / cron
* Für V1 reicht ein synchroner Job-Runner plus CLI-Commands

---

## Datenmodell

Jeder Memory-Eintrag sollte mindestens enthalten:

```json
{
  "id": "mem_...",
  "type": "architecture_decision",
  "title": "Order totals are recalculated only via DomainService",
  "summary": "Totals must not be computed in controllers or UI adapters.",
  "details": "...",
  "scope": {
    "repository": "app-core",
    "bounded_context": "billing",
    "files": ["src/Billing/..."],
    "symbols": ["OrderTotalService::recalculate"]
  },
  "evidence": [
    {"kind": "file", "ref": "src/Billing/OrderTotalService.ts"},
    {"kind": "commit", "ref": "abc123"},
    {"kind": "adr", "ref": "docs/adr/0007-order-total-policy.md"}
  ],
  "embedding_text": "...",
  "trust": {
    "status": "validated",
    "score": 0.91,
    "validated_at": "2026-04-13T10:00:00Z"
  },
  "invalidation": {
    "strategy": "file_symbol_dependency_based",
    "watched_files": ["src/Billing/OrderTotalService.ts"],
    "watched_symbols": ["OrderTotalService::recalculate"]
  },
  "created_by": "agent",
  "updated_at": "2026-04-13T10:00:00Z"
}
```

### Sinnvolle Memory-Typen

* `architecture_decision`
* `domain_rule`
* `integration_constraint`
* `bug_pattern`
* `refactoring_note`
* `test_strategy`
* `deployment_warning`
* `coding_convention`
* `operational_runbook`
* `glossary_entry`
* `session_note` (nur kurzlebig)

---

## Memory-Layer: Wissensklassen

### 1. Evergreen Memory

Langlebig, selten ändernd

Beispiele:

* Bounded Contexts
* Architekturprinzipien
* Naming-Konventionen
* Security-Prinzipien

### 2. Semi-Stable Memory

Relevant, aber veränderlich

Beispiele:

* Integrationspfade
* Modulabhängigkeiten
* Caching-Regeln
* Teststrategien pro Modul

### 3. Volatile Memory

Sehr schnell veraltet

Beispiele:

* aktuelle Workarounds
* Hotfix-Hinweise
* temporäre Branch-Annahmen
* Übergangsregeln während Migrationen

### 4. Session Memory

Kurzlebig, nicht dauerhaft

Beispiele:

* aktueller Taskplan
* To-do-Liste der Session
* temporäre Hypothesen

---

## Retrieval-Strategie

Die Retrieval-Pipeline sollte **hybrid** sein:

1. **Lexikalische Suche**
2. **Vektor-Suche**
3. **Metadata-Filter**
4. **Graph / Relation Lookup**
5. **Frische-Prüfung gegen Git / Code**
6. **Ranking nach Relevanz + Trust + Freshness**

### Ranking-Signale

* semantische Ähnlichkeit
* gleiche Dateien / Module / Symbole
* gleiche Domäne
* Relevanz zur aktuellen Diff-Menge
* aktueller Branch
* Vertrauensstatus
* letzter Validierungszeitpunkt

---

## Invalidation-Strategie

Das ist das Herzstück.

Memory darf nicht nur gespeichert, sondern muss aktiv gepflegt werden.

### Auslöser für Invalidation

* Datei geändert
* Symbol geändert / gelöscht / umbenannt
* Modulstruktur geändert
* relevante Tests geändert
* ADR / Doku geändert
* abhängige Integration geändert
* großer Refactor / Migration erkannt
* Branch-Wechsel
* Merge in main

### Invalidation-Modi

#### 1. Soft Invalidate

Eintrag bleibt erhalten, Status wird auf `stale` oder `needs_review` gesetzt.

Nutzen:

* Wissen ist vielleicht noch nützlich
* aber darf nicht ungeprüft genutzt werden

#### 2. Hard Invalidate

Eintrag wird archiviert oder deaktiviert.

Nutzen:

* wenn Kernsymbol gelöscht wurde
* wenn Beweise wegfallen
* wenn Eintrag klar widersprüchlich geworden ist

#### 3. Partial Revalidation

Nur Teilfelder werden neu überprüft.

Nutzen:

* schneller als komplette Neuerstellung
* besonders sinnvoll bei großen Architektur-Einträgen

### Invalidation-Regeln pro Eintrag

Jeder Eintrag sollte Regeln definieren wie:

* watch these files
* watch these symbols
* watch these imports
* watch these config keys
* watch these tests

### Beispiel

Ein Memory-Eintrag über `InvoiceFinalizer::finalize()` wird invalidiert, wenn:

* die Datei geändert wurde
* der Symbolname fehlt
* relevante Tests umgebaut wurden
* commit diff das `finalize`-Verhalten betrifft

---

## Rolle von Augment in diesem System

Augment ist in diesem Setup **nicht der Memory-Speicher**. Es ist der **lebende Code-Leser und Executor**.

### Augment übernimmt

* Code lesen
* Zusammenhänge über viele Dateien verstehen
* gezielte Revalidierungs-Checks durchführen
* Refactorings umsetzen
* TODOs aus der Roadmap abarbeiten
* Ergebnisse im Code verankern

### Claude Opus übernimmt

* Wissensextraktion aus Code + Diffs + Docs
* Verdichtung zu stabilen Memory-Einträgen
* Bewertung der Haltbarkeit
* Definition von Invalidation-Regeln
* Qualitätsprüfung des gespeicherten Wissens

### Warum die Kombination stark ist

* Augment liefert stets frischen Realitätsabgleich
* Claude verhindert, dass Wissen nur als unstrukturierter Diff-Schlamm herumliegt
* Memory reduziert Wiederholungsarbeit
* Invalidation schützt vor falscher Sicherheit

---

## Phasenplan

# Phase 0 – Ziel, Scope und Architekturentscheidungen festziehen

## Ziel

Vor Implementierung alle Grundannahmen festlegen, damit das System nicht als unklare Tool-Sammlung endet.

## Deliverables

* Vision-Dokument
* Scope für V1
* Architekturdiagramm
* Stack-Entscheidung
* Definition von Memory-Typen
* Definition von Trust-Statuswerten

## Checkliste

* [ ] V1-Ziel schriftlich definieren
* [ ] Entscheiden: TypeScript oder Python als Kernsprache
* [ ] Entscheiden: Postgres + pgvector oder alternative Vector DB
* [ ] Liste der ersten 5 Memory-Typen festlegen
* [ ] Trust-Status definieren (`new`, `validated`, `stale`, `invalidated`, `archived`)
* [ ] Revalidierungs-Trigger definieren
* [ ] CLI- oder Service-first Ansatz festlegen
* [ ] Ein Beispiel-Repository für Entwicklung auswählen

## Arbeitsauftrag für Augment + Claude Opus

**Claude Opus**:

* Erstelle ein Architektur-ADR für das Gesamtsystem
* Begründe den V1-Scope und notiere bewusst ausgeschlossene Features
* Schlage ein minimales Datenmodell vor

**Augment**:

* Lege Projektstruktur an
* Erzeuge Grundmodule für `ingest`, `retrieve`, `validate`, `invalidate`, `storage`
* Erstelle Basis-Interfaces / Typen / Contracts

## Abnahmekriterien

* Jeder im Team kann in 5 Minuten erklären, was Memory speichert und was nicht
* Es existiert ein V1-Scope mit klaren Grenzen

---

# Phase 1 – Grundprojekt und Infrastruktur aufsetzen

## Ziel

Ein lauffähiges Grundsystem mit sauberem lokalen Setup.

## Deliverables

* Repository für den Memory-Service
* lokale Entwicklungsumgebung
* DB-Setup
* Migrationssystem
* Konfigurationssystem
* CLI-Befehle oder API-Grundgerüst

## Checkliste

* [ ] Repository initialisieren
* [ ] Docker / Dev-Container Setup hinzufügen
* [ ] Postgres mit pgvector konfigurieren
* [ ] DB-Migrationen einrichten
* [ ] `.env.example` erstellen
* [ ] Logging integrieren
* [ ] Fehlerbehandlung und strukturierte Fehlercodes definieren
* [ ] Healthcheck bereitstellen
* [ ] Baseline-README erstellen

## Arbeitsauftrag für Augment + Claude Opus

**Claude Opus**:

* Formuliere Coding-Guidelines für das Projekt
* Definiere Namenskonventionen für Memory-Typen, Status und Pipelines

**Augment**:

* Implementiere Setup, DB-Schema und Grundgerüst
* Erzeuge CLI-Kommandos wie:

    * `memory:ingest`
    * `memory:retrieve`
    * `memory:validate`
    * `memory:invalidate`

## Abnahmekriterien

* Projekt startet lokal reproduzierbar
* DB-Migrationen laufen sauber
* Basiskommandos sind vorhanden

---

# Phase 2 – Datenmodell und Speichermechanik implementieren

## Ziel

Memory-Einträge strukturiert speichern, laden und versionieren können.

## Deliverables

* Tabellen / Collections für Memory-Einträge
* Metadatenmodell
* Embedding-Felder
* Relationsmodell zu Dateien, Symbolen, Commits
* Änderungs- und Statushistorie

## Checkliste

* [ ] Tabelle `memory_entries` anlegen
* [ ] Tabelle `memory_evidence` anlegen
* [ ] Tabelle `memory_links` anlegen
* [ ] Tabelle `memory_status_history` anlegen
* [ ] Vektor-Spalte hinzufügen
* [ ] JSON-Felder für flexible Metadaten definieren
* [ ] Repository / DAO-Schicht implementieren
* [ ] Unit-Tests für CRUD schreiben

## Arbeitsauftrag für Augment + Claude Opus

**Claude Opus**:

* Bewerte, welche Felder Pflicht und welche optional sein sollten
* Schlage Regeln zur Atomisierung von Wissen vor

**Augment**:

* Implementiere Persistenz und Tests
* Erstelle Serialisierungslogik für Memory-Objekte

## Abnahmekriterien

* Einträge lassen sich mit Evidenz und Trust-Status speichern
* Historie von Statusänderungen ist nachvollziehbar

---

# Phase 3 – Ingestion Pipeline für Wissen bauen

## Ziel

Aus Code, Docs und Git History verwertbare Memory-Kandidaten erzeugen.

## Quellen für Ingestion

* Quellcode
* README / Doku
* ADRs
* Tests
* Git Commits
* PR-Beschreibungen
* Ticket-Verweise in Commits

## Deliverables

* Parser / Extractor Layer
* Kandidaten-Erzeugung
* Duplikaterkennung
* Normalisierung

## Checkliste

* [ ] Dateiscan implementieren
* [ ] Symbol-Extraktion integrieren
* [ ] Doku-Reader integrieren
* [ ] Git-Commit-Reader integrieren
* [ ] Kandidatenmodell definieren
* [ ] Heuristiken für relevante Wissensextraktion definieren
* [ ] Dedupe-Strategie umsetzen
* [ ] Embedding-Erstellung integrieren

## Arbeitsauftrag für Augment + Claude Opus

**Claude Opus**:

* Definiere Regeln: Was ist speicherwürdig, was nicht?
* Entwirf Prompt-/Instruktionsvorlagen für Memory-Extraktion
* Unterscheide strikt zwischen dauerhaften Erkenntnissen und Session-Notizen

**Augment**:

* Implementiere Extractor-Module
* Verbinde Git, Datei-Analyse und Doku-Parsing
* Füge erste Heuristiken hinzu

## Beispiel für speicherwürdiges Wissen

* "Alle Preise werden serverseitig über MoneyValueObject normalisiert."
* "Retries für Provider X nur über IntegrationAdapter, nie im Controller."
* "Feature-Flag Y muss bei Tenant-Migration aktiv sein, sonst Dateninkonsistenz."

## Beispiel für nicht speicherwürdiges Wissen

* "Heute habe ich Datei A geöffnet"
* "Ich vermute, hier ist vielleicht ein Bug"
* "Task gerade halb fertig"

## Abnahmekriterien

* Das System erzeugt aus einem Repo erste sinnvolle Memory-Kandidaten
* Rauschen ist beherrschbar

---

# Phase 4 – Retrieval Engine mit Hybrid Search aufbauen

## Ziel

Relevante Knowledge-Snippets zum aktuellen Task finden.

## Deliverables

* Query-Layer
* Hybrid Search
* Relevanzranking
* Scope-Filter
* Agentenfreundliche Antwortformate

## Checkliste

* [ ] Lexikalische Suche integrieren
* [ ] Vektorsuche integrieren
* [ ] Filter nach Repository / Modul / Typ / Trust / Status implementieren
* [ ] Ranking-Funktion implementieren
* [ ] Query-API oder CLI-Command bereitstellen
* [ ] Response-Format für Agents definieren
* [ ] Tests mit realistischen Queries schreiben

## Arbeitsauftrag für Augment + Claude Opus

**Claude Opus**:

* Definiere Ranking-Regeln und Priorisierung
* Formuliere Retrieval-Antwortformat für Agenten

**Augment**:

* Implementiere Suchlogik und Ranking
* Erzeuge Endpunkt / CLI für Retrieval

## Abnahmekriterien

* Für echte Coding-Tasks werden passende Memory-Einträge gefunden
* Offensichtlich irrelevante Einträge tauchen nicht oben auf

---

# Phase 5 – Trust- und Validation-System implementieren

## Ziel

Memory darf nicht blind geglaubt werden. Relevante Einträge müssen validiert werden.

## Deliverables

* Trust-Scoring
* Validation-Strategien
* Freshness-Bewertung
* Statusübergänge

## Trust-Signale

* direkte Code-Evidenz vorhanden
* Symbol existiert noch
* referenzierte Dateien unverändert
* Tests bestätigen Verhalten
* Doku deckt sich mit Code
* jüngste Commits widersprechen nicht

## Checkliste

* [ ] Trust-Modell definieren
* [ ] Validator-Interfaces erstellen
* [ ] File-exists Validator bauen
* [ ] Symbol-exists Validator bauen
* [ ] Diff-impact Validator bauen
* [ ] Optional: Test-linked Validator bauen
* [ ] Trust-Score-Berechnung implementieren
* [ ] Statusübergänge dokumentieren

## Arbeitsauftrag für Augment + Claude Opus

**Claude Opus**:

* Definiere die Semantik jedes Status
* Beschreibe, wann ein Eintrag als "validated" oder "stale" gilt

**Augment**:

* Implementiere Validatoren und Score-Berechnung
* Verknüpfe Trust mit Retrieval-Ranking

## Abnahmekriterien

* Jeder zurückgelieferte Eintrag hat nachvollziehbaren Status
* Veraltete Einträge werden sichtbar herabgestuft

---

# Phase 6 – Invalidation Engine bauen

## Ziel

Automatische Reaktion auf Veränderungen im Code.

## Deliverables

* Diff-Analyse
* Watcher-Logik
* Invalidation-Regeln
* Revalidation-Queue

## Checkliste

* [ ] Git-Diff-Reader implementieren
* [ ] Datei-basierte Watch-Regeln implementieren
* [ ] Symbol-basierte Watch-Regeln implementieren
* [ ] Abhängigkeitsbasierte Invalidation ergänzen
* [ ] Soft-Invalidate Flow bauen
* [ ] Hard-Invalidate Flow bauen
* [ ] Revalidation-Jobs einführen
* [ ] Audit-Log für Invalidation anlegen

## Arbeitsauftrag für Augment + Claude Opus

**Claude Opus**:

* Entwickle Regeln, wann Soft vs. Hard Invalidate gelten soll
* Definiere Prioritäten für Revalidation

**Augment**:

* Implementiere Diff-getriebene Invalidation
* Lege automatische Revalidierungspfade an

## Abnahmekriterien

* Wenn relevante Dateien geändert werden, reagiert das Memory-System korrekt
* Falsches Altwissen bleibt nicht unbemerkt aktiv

---

# Phase 7 – Git History als Lernquelle integrieren

## Ziel

Nicht nur aktuellen Code, sondern auch die Entwicklungsgeschichte nutzbar machen.

## Nutzen von Git History

* Warum wurde etwas geändert?
* Welche Patterns wurden mehrfach gefixt?
* Welche Dateien ändern sich oft gemeinsam?
* Welche Entscheidungen sind instabil?
* Wo gibt es fragile Bereiche?

## Deliverables

* Commit-Analyse
* Co-change-Analyse
* Hotspot-Analyse
* Wiederkehrende Bug-Muster

## Checkliste

* [ ] Commit-Metadaten erfassen
* [ ] Commit-Nachrichten klassifizieren
* [ ] Co-change-Datenmodell aufbauen
* [ ] Hotspot-Module identifizieren
* [ ] Bugfix-Muster extrahieren
* [ ] Refactoring-Hinweise aus History ableiten

## Arbeitsauftrag für Augment + Claude Opus

**Claude Opus**:

* Entwerfe Regeln, welche historischen Erkenntnisse als Memory gespeichert werden dürfen
* Trenne saubere Historien-Erkenntnisse von spekulativen Mustern

**Augment**:

* Implementiere Git-Analyse-Komponenten
* Verlinke Erkenntnisse mit Memory-Einträgen

## Abnahmekriterien

* History wird nicht nur angezeigt, sondern in verwertbares Wissen übersetzt
* Wiederkehrende Problemzonen sind identifizierbar

---

# Phase 8 – Agent Workflow integrieren

## Ziel

Das Memory-System muss praktisch im Agenten-Workflow nutzbar sein.

## Ziel-Workflow

1. Agent bekommt Task
2. System holt aktuellen Augment-Kontext
3. System fragt passendes Memory ab
4. Relevantes Memory wird validiert
5. Agent plant Umsetzung
6. Agent ändert Code
7. Nach Abschluss wird neues Wissen extrahiert
8. Betroffene alte Einträge werden invalidiert oder aktualisiert

## Deliverables

* Workflow-Definition
* Memory-aware Task-Prompts
* Post-task Memory Update Flow

## Checkliste

* [ ] Standard-Task-Workflow definieren
* [ ] Retrieval vor Taskstart integrieren
* [ ] Validation vor Nutzung integrieren
* [ ] Post-task Extraction integrieren
* [ ] Memory Update nach Merge definieren
* [ ] Session Notes von persistentem Memory trennen

## Arbeitsauftrag für Augment + Claude Opus

**Claude Opus**:

* Formuliere Prompt-Templates für:

    * pre-task retrieval
    * pre-commit validation
    * post-task extraction
* Definiere Output-Schemas

**Augment**:

* Integriere diese Workflows in Scripts / Commands / Tooling
* Verbinde Retrieval und Post-Task-Update mit dem Entwicklungsfluss

## Abnahmekriterien

* Der Workflow ist ohne manuelle Sonderlogik nutzbar
* Wissen wächst kontrolliert mit jeder abgeschlossenen Arbeit

---

# Phase 9 – Qualitätskontrolle und Anti-Drift-Mechanismen

## Ziel

Memory muss über Wochen und Monate brauchbar bleiben.

## Risiken

* zu viel Rauschen
* veraltete Einträge
* zu grobe Einträge
* doppelte Einträge
* Halluzinationen im gespeicherten Wissen

## Deliverables

* Qualitätsmetriken
* Drift-Reports
* Review-Mechanismen
* Cleanup-Jobs

## Checkliste

* [ ] Metriken definieren:

    * Retrieval Precision
    * Stale Rate
    * Duplicate Rate
    * Revalidation Success Rate
* [ ] Review-Command für fragwürdige Einträge bauen
* [ ] Duplicate Merge Mechanismus bauen
* [ ] Archivierungsstrategie definieren
* [ ] Regelmäßigen Cleanup-Job einführen

## Arbeitsauftrag für Augment + Claude Opus

**Claude Opus**:

* Definiere Review-Kriterien für gute Memory-Einträge
* Entwerfe Qualitätsberichte

**Augment**:

* Implementiere Admin- / Review-Commands
* Baue Reports und Cleanup-Automation

## Abnahmekriterien

* Die Qualität des Systems ist messbar
* Schlechtes Wissen sammelt sich nicht unbegrenzt an

---

# Phase 10 – Sicherheit, Privacy und Teamfähigkeit

## Ziel

Das System soll im Teambetrieb tragfähig sein.

## Deliverables

* Rollenmodell
* Repository-Scope-Regeln
* Sensible-Daten-Filter
* Auditability

## Checkliste

* [ ] Zugriffsscope definieren
* [ ] Secrets / Tokens niemals in Memory speichern
* [ ] PII / sensible Daten filtern
* [ ] Änderungsprotokoll für Memory-Einträge aktivieren
* [ ] Team-Review-Prozess definieren

## Arbeitsauftrag für Augment + Claude Opus

**Claude Opus**:

* Erstelle Sicherheitsrichtlinien für Memory-Inhalte
* Definiere No-store-Kategorien

**Augment**:

* Implementiere Sanitizer / Filter / Guardrails
* Ergänze Audit-Logging

## Abnahmekriterien

* Kritische Daten landen nicht im Memory
* Einträge sind auditierbar

---

# Phase 11 – V1 Pilot mit echtem Repository

## Ziel

System an einem realen Projekt beweisen.

## Deliverables

* Pilot-Repo Integration
* echte Tasks
* Auswertung
* Verbesserungsbacklog

## Checkliste

* [ ] Pilot-Repo auswählen
* [ ] Initial Ingestion durchführen
* [ ] 10 reale Tasks mit Memory-Unterstützung ausführen
* [ ] False Positives dokumentieren
* [ ] Stale Memory dokumentieren
* [ ] Feedback von Entwicklern sammeln
* [ ] Priorisierte V2-Liste erstellen

## Arbeitsauftrag für Augment + Claude Opus

**Claude Opus**:

* Werte die Ergebnisse aus
* Leite Verbesserungen für Datenmodell, Retrieval und Invalidation ab

**Augment**:

* Führe reale Implementierungs- und Refactoring-Tasks mit dem System durch
* Dokumentiere Engstellen im Workflow

## Abnahmekriterien

* Das System spart in echten Tasks spürbar Denk- und Suchaufwand
* Veraltetes Wissen wird meist korrekt erkannt

---

# Phase 12 – V2 Ausbau

## Mögliche Erweiterungen

* Graph Memory
* symbol-level dependency graph
* PR- und Ticket-Integration
* IDE-Kommandos / VS Code Extension
* MCP-Server / Tool-API
* Memory-Snapshots pro Release
* automatische ADR-Erkennung
* test impact analysis
* tenant- / domain-spezifisches Memory
* branch-spezifisches temporäres Memory

---

## Orchestrierungslogik

### Pre-Task

* hole aktuellen Task
* identifiziere betroffene Module
* retrieve relevante Memory-Einträge
* validiere Top-Einträge gegen Code / Git-Diff
* übergebe nur validiertes oder markiert-stales Wissen an den Agenten

### During Task

* nutze Augment für aktuelle Dateianalyse
* nutze Claude für Synthese, Entscheidung und Plan
* schreibe Session Notes getrennt von persistentem Memory

### Post-Task

* analysiere Diffs
* extrahiere neue stabile Erkenntnisse
* aktualisiere oder invalidiere betroffene Einträge
* archiviere Session Notes oder werfe sie weg

---

## Beispiel für Statusübergänge

```text
new -> validated
new -> stale
validated -> stale
stale -> validated
validated -> invalidated
stale -> invalidated
invalidated -> archived
```

---

## Beispiel für minimalen V1-Workflow

1. CLI-Befehl `memory:ingest repo-path`
2. System erzeugt erste Memory-Einträge
3. CLI-Befehl `memory:retrieve "how are invoice totals recalculated?"`
4. System liefert Top-Memory + Status
5. Entwickler / Agent arbeitet
6. CLI-Befehl `memory:invalidate --from-git-diff`
7. Betroffene Einträge werden neu bewertet

---

## Prompt-/Arbeitsregeln für Claude Opus

### Bei Wissensextraktion

* Speichere nur Wissen, das in zukünftigen Tasks wiederverwendbar ist.
* Trenne Beobachtung, Schlussfolgerung und Evidenz.
* Markiere Unsicherheit explizit.
* Erfinde keine Architekturregeln ohne Code- oder Doku-Beleg.

### Bei Revalidierung

* Prüfe zuerst, ob referenzierte Dateien und Symbole noch existieren.
* Suche nach widersprechenden Diffs oder Tests.
* Senke Trust, wenn Evidenz geschwächt ist.

### Bei Konsolidierung

* Merge doppelte Einträge.
* Bevorzuge atomare Aussagen statt übergroßer Sammeltexte.
* Halte Scope klar: Repository, Modul, Symbol, Domäne.

---

## Prompt-/Arbeitsregeln für Augment Code

* Nutze den aktuellen Code als Primärquelle.
* Verwende Memory als Zusatzkontext, nicht als absolute Wahrheit.
* Führe bei `stale`-Einträgen immer einen schnellen Code-Check durch.
* Dokumentiere neue stabile Erkenntnisse nach abgeschlossenen Änderungen.
* Aktualisiere Watch-Scopes bei Refactorings.

---

## Definition of Done für V1

V1 ist erreicht, wenn:

* Memory-Einträge strukturiert gespeichert werden
* Hybrid Retrieval brauchbare Ergebnisse liefert
* Trust-Status sichtbar ist
* Git-Diffs Invalidation auslösen
* Augment + Claude im Workflow nutzbar integriert sind
* ein Pilot-Repo erfolgreich getestet wurde

---

## Empfohlene Reihenfolge für die tatsächliche Umsetzung

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 4
5. Phase 5
6. Phase 3
7. Phase 6
8. Phase 8
9. Phase 7
10. Phase 9
11. Phase 10
12. Phase 11
13. Phase 12

Begründung:

* Erst Speicher + Retrieval + Trust solide machen
* dann Ingestion und Invalidation härten
* danach Workflow und History ausbauen

---

## Realistische Risiken

* zu frühes Speichern von zu viel Wissen
* schlechte Granularität der Einträge
* unzureichende Symbolverknüpfung
* zu aggressive oder zu schwache Invalidation
* zu hoher Pflegeaufwand
* Overengineering durch Graph-Features zu früh

---

## Pragmatiker-Empfehlung für V1

Wenn ihr schnell starten wollt, baut zuerst nur das:

* Postgres + pgvector
* Memory-Einträge mit Evidenz + Trust
* Retrieval
* einfache Git-Diff-Invaliderung auf Dateiebene
* manuelle Revalidation
* Claude-basierte Wissensextraktion
* Augment als Fresh Context Reader

Noch **nicht** in V1:

* echter Wissensgraph
* vollautomatische Symbolgraphen
* komplexes Multi-Agent-System
* vollautonome Entscheidungssysteme

---

## Nächster sinnvoller Schritt

Startet mit einem kleinen, echten Repository und implementiert innerhalb weniger Tage einen V1-Kern:

* Ingest
* Retrieve
* Trust
* Invalidate by diff

Danach erst ausbauen.

---

## Umsetzungsnotiz

Dieses System funktioniert gerade **deshalb**, weil Augment den Code ohnehin frisch lesen kann. Dadurch müsst ihr Memory nicht wie eine absolute Wissensquelle behandeln. Ihr könnt es wie einen **persistenten, aber überprüfbaren Wissenscache** benutzen.

Das ist sehr wahrscheinlich die praktikabelste Form eines eigenen Agent-Memory-Systems heute:

* **Fresh Code Understanding** durch Augment
* **Deep synthesis and policy extraction** durch Claude Opus
* **Persistent project memory** durch euren Speicherlayer
* **Controlled invalidation** über Git, Dateien, Symbole und Validierung

Genau darin liegt der Hybrid-Vorteil.
