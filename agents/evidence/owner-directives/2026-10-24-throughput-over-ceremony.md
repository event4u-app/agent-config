<!-- evidence-type: analysis -->

# Owner directive — throughput over ceremony

| Field | Value |
|---|---|
| Ordered by | the repository owner, in chat |
| Date | 2026-10-24 |
| Scope | every roadmap run, until the owner changes it |
| Grants by itself | the working rules below; it lowers no test, CI gate or Hard-Floor obligation |

Progress is measured in closed steps, not merged PRs. Tests and CI are unchanged; only
justification paperwork is cut.

## Immediate

1. `road-to-authority-routing-mechanism` step 7.1 is parked with a revisable
   fail-closed default (D48). No further council round on 7.1.
2. Every open question to the owner lives in `agents/owner-questions.md` (ID, one line
   of context, options, recommendation, what it blocks). A PR whose only content is a
   question to the owner is not opened: the question goes into the list and the run
   takes the next step.
3. At most five active roadmaps. A new inbox round creates no active roadmap; it lands
   in `later/` or as an addition to an existing roadmap. A new roadmap is pulled only
   when an active one completes.

## Working rules

4. **Timebox per step.** At the third `(partial)` PR, or after two days open, the step
   is parked with a result note. More than about ten decisions in one step means it is
   cut wrong: split it.
5. **Ceremony by risk.** The council runs only for irreversible, release- or
   security-relevant decisions; otherwise one reviewer or none. Files under
   `agents/evidence/` only where someone must read them later (release, security,
   owner-reserved); a normal step's PR description is enough. Target: evidence lines
   well below `src/` lines.
6. **Parallelism.** At most three sessions at once, on separate areas, never two on the
   same roadmap. During work, vitest runs only the affected tests; the full suite runs
   before merge. Each session reports its council and vitest call counts at the end.
7. **Daily report.** Closed steps (of those, from roadmaps older than seven days), open
   steps with the trend against yesterday, evidence lines against `src/` lines, steps
   parked by the timebox, new owner questions.

## The instruction, verbatim

As issued, drafted in an external chat at the owner's request and re-supplied in inbox round `inbox-2026-10-af`.

> Owner-Direktive (24.10.2026): Durchsatz vor Zeremonie. Gemessen wird an geschlossenen Schritten, nicht an gemergten PRs. Tests und CI bleiben unverändert; gespart wird nur an Begründungspapier.
>
> SOFORT (in dieser Reihenfolge):
>
> 1. authority-routing 7.1 parken
>    - Schritt nach later/ verschieben.
>    - Roadmap-Text auf höchstens ca. 300 Wörter kürzen: Ergebnis bis jetzt, offene Frage(n), kleinster Schnitt, der 7.2 und Phase 8 entblockt.
>    - Wenn 7.2 eine Einstufung roter Trunk-Checks braucht: einen vorläufigen Default festlegen, als "revidierbar" markieren, weitermachen.
>    - Keine weiteren Council-Runden zu 7.1.
>
> 2. Owner-Fragen sammeln
>    - Alle offenen Fragen an mich (u. a. aus #2640, #2641, #2643) in EINE Datei: agents/owner-questions.md
>    - Pro Frage: ID, eine Zeile Kontext, Optionen, Empfehlung, was blockiert ist.
>    - Mir die Liste gesammelt vorlegen.
>    - Ab jetzt: Kein PR, dessen einziger Inhalt eine Frage an mich ist. Frage in die Liste, nächsten Schritt nehmen.
>
> 3. WIP-Limit einführen
>    - Höchstens 5 aktive Roadmaps. Mir vorschlagen, welche 5 aktiv bleiben (Kriterium: Nutzen und Nähe zum Abschluss); der Rest geht nach later/.
>    - Neue Inbox-Einträge erzeugen keine aktive Roadmap. Sie landen in later/ oder als Ergänzung an einer bestehenden Roadmap.
>    - Eine neue Roadmap wird erst gezogen, wenn eine aktive abgeschlossen ist.
>
> NEUE ARBEITSREGELN (ab sofort, bis ich sie ändere):
>
> 4. Timebox pro Schritt
>    - Ab dem 3. "(partial)"-PR oder nach 2 Tagen offen: Schritt automatisch parken, mit Ergebnisnotiz.
>    - Mehr als ca. 10 Entscheidungen (D-Nummern) in einem Schritt heißt: falsch geschnitten. Aufteilen statt weiterdiskutieren.
>
> 5. Zeremonie nach Risiko
>    - Council NUR bei irreversiblen, release- oder sicherheitsrelevanten Entscheidungen. Sonst ein Reviewer oder keiner.
>    - Evidence-Dateien unter agents/evidence/ nur, wenn sie später wirklich nachgelesen werden müssen (Release, Security, Owner-reserviert). Normale Schritte: PR-Beschreibung reicht.
>    - Ziel: Evidence-Zeilen deutlich unter src/-Zeilen.
>
> 6. Parallelität
>    - Höchstens 3 Sessions gleichzeitig, auf getrennten Bereichen. Keine zwei Sessions auf derselben Roadmap.
>    - vitest während der Arbeit nur für betroffene Tests (--changed / related). Volle Suite vor dem Merge.
>    - Pro Session Council- und vitest-Aufrufe zählen und im Abschluss ausgeben. Kein hartes Limit, aber sichtbar.
>
> 7. Tagesbericht (jeden Abend, kurz)
>    - Geschlossene Schritte gesamt, davon aus Roadmaps älter als 7 Tage
>    - Offene Schritte gesamt (Trend gegenüber gestern)
>    - Evidence-Zeilen vs. src/-Zeilen
>    - Geparkte Schritte (Timebox)
>    - Neue Owner-Fragen
