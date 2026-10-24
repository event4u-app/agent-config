<!-- evidence-type: analysis -->

# Owner directive — throughput over ceremony

| Field | Value |
|---|---|
| Ordered by | the repository owner |
| Date | 2026-10-24 |
| Scope | how runs plan, review, record and parallelise work; standing until the owner changes it |
| Source of the order | drafted in an external chat at the owner's request ("ja, gib mir eine"), issued by the owner to an AC session the same day, and re-supplied by the owner in inbox round `inbox-2026-10-af` with the request to make it durable |
| Grants by itself | the working rules quoted below, nothing else |

## The instruction, verbatim

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

## What it does not grant

- No change to tests, required CI checks, the Hard Floor or the R3 depth — the
  directive says so in its first paragraph.
- It does not reverse the 2026-10-21 decision that R0/R1 depth is lowered only
  after a committed shadow reading
  (`2026-10-21-review-cap-and-depth-flip.md`); that question is on
  `agents/owner-questions.md`.
- It does not choose which five roadmaps stay active — item 3 asks for a
  proposal, and the choice is the owner's.
- A CI gate that requires a ratification artifact still requires one.
