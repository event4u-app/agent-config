# road-to-substrate-adoption

> **Status: Superseded — archived as a record, not as a plan.**
>
> This roadmap was authored **outside this repository**, in a consuming
> program that was designing a shared memory substrate across several
> packages. Its direction — `agent-config` gives up its internal memory
> substrate and consumes an external `agent-memory` v2 as a library — is
> **no longer the planned course**: that program re-decided its substrate
> strategy on 2026-08-08, before any item below was started.
>
> Its cross-repo gate ("starts at the earliest after `agent-memory` M3,
> v2.0 API freeze") is void for the same reason — the counterpart roadmap
> in that repo is archived as superseded as well.
>
> **Nothing here is scheduled**, and no item is checkbox-tracked, so the
> roadmap dashboard does not count it. It is filed under `archive/` because
> the analysis is worth keeping even where the direction is not: the M0
> census discipline (caller inventory with a grep counter-check, a mapping
> table with no "unclear" cells) and the M1 migration acceptance criteria
> (loss-free by entry count + normalised checksums, restore tested in CI
> rather than described in prose) are reusable for any future substrate
> change, whoever authors it.
>
> **Anonymised on archival.** The authoring program is unreleased; its name,
> its internal decision records, and its product-side components are
> referred to generically. Technical substance is unchanged — nothing was
> removed except identifiers. German-language original, preserved as
> written (see `00-overview.md` for the same treatment of an external
> analysis in this folder).

---

**Repo:** `event4u-app/agent-config` · **Status:** Entwurf · **Datum:** 2026-08-05
**Programm:** übergreifendes Substrat-Programm eines konsumierenden Produkts
**Cross-Repo-Gate:** Startet frühestens nach `agent-memory` M3 (v2.0 API-Freeze).
Bis dahin nur M0 (Census) zulässig.

## Ziel

agent-config gibt sein internes Memory-Substrat auf und konsumiert
`@event4u/agent-memory` v2 als Library — dieselben Dateien, dieselbe Logik
wie später der Kern des konsumierenden Produkts. Bestandsdaten verlustfrei
migriert, alle Schreibpfade mit Origin `agent-config` + korrektem Scope.

## Nicht-Ziele

Keine Parallel-API „für den Übergang" (Alt-Pfad nur als Read-only-Fallback,
eine Minor lang) · keine eigene Schema-Erweiterung außerhalb der v2-Spec ·
keine Kenntnis des konsumierenden Produkts im Code.

---

## M0 — Census interner Memory-Pfade (read-only)

Inventur des internen Substrats: Tabellen/Pragmas, alle Schreib-/Lesepfade
(Aufrufer-Liste), Dateiorte, implizite Invarianten, vorhandene Migrationen.
Mapping-Tabelle Ist-Schema → v2-Spec (Feld für Feld, inkl. Verlust-/
Umdeutungs-Kandidaten).

- A0.1: Jede Aussage mit Datei:Zeile-Referenz; 0 Prosa-Belege.
- A0.2: Aufrufer-Census vollständig — grep-Gegenprobe findet 0 DB-Zugriffe
  außerhalb der Liste.
- A0.3: Mapping-Tabelle ohne „unklar"-Zellen; jeder Sonderfall mit Verdict.

## M1 — Umstellung + Bestandsmigration

Alle M0-Pfade auf die v2-Library umstellen (vollständig). Up-Migration:
Backup → Dry-Run mit Report → Migration → Checksummen-Verifikation.
Rollout gestuft: Opt-in-Beta → Default; Alt-Pfad eine Minor als
Read-only-Fallback, dann Entfernung. Rollback = getestetes
Restore-Kommando in CI, nicht Prosa.

- A1.1: Migration verlustfrei — Eintrags-Zählung + normalisierte Checksummen
  vor/nach identisch; maschinenlesbarer Report als Repo-Artefakt.
- A1.2: 0 verbleibende Direkt-DB-Zugriffe außerhalb der Library
  (Gegenprobe wie A0.2, Soll = leer).
- A1.3: ≥ 14 Tage Eigen-Dogfooding im Beta-Fenster ohne P1-Memory-Bug vor
  Default-Umstellung.
- A1.4: Restore-Test in CI grün (Backup→Restore→Checksummen-Gleichheit).

## M2 — Origin/Scope + kanonische Relokation

Alle Writer setzen `origin='agent-config'` + korrekten Scope. Relokation der
DB-Dateien an kanonische Orte mit Kompat-Lesen des Altpfads (eine Minor) +
einmaligem Move-Assistenten.

- A2.1: 100 % neuer Einträge tragen Origin+Scope (DB-Assertion in Tests).
- A2.2: Kaltstart auf Altpfad-Installation → angebotener Move, 0 Datenverlust
  (Checksummen), Altpfade danach nachweislich unbenutzt.
- A2.3: Host-Memory-Dateien enthalten nach Umstellung 0 duplizierten
  Substrat-Inhalt (Pattern-Prüfung) — nur Pointer/Projektion; Drift-Test:
  Substrat-Änderung schlägt ohne manuelle Host-Datei-Pflege durch.

## Claims Ledger

- CL-SMS-03 „Bestandsmigration ist verlustfrei" → A1.1 + A1.4
- CL-SMS-04 „Kein Direktzugriff am Substrat vorbei" → A0.2/A1.2
