<!-- evidence-type: analysis -->

# Owner directive — the graph is an index, never the truth

| Field | Value |
|---|---|
| Ordered by | the repository owner, in chat |
| Date | 2026-10-26 |
| Scope | every graph and map AC builds, per project and on the machine |
| Grants by itself | the working rules below; it lowers no test, CI gate or Hard-Floor obligation |

## The owner's words

Turn 13 of the round's transcript (codename `round-7c3e91`), verbatim:

> Alle Graphen sollten am Ende auch im selben map ordner in einer passenden Struktur liegen und nicht überall verstreut sein. <!-- md-language-check: ignore -->
>
> und was wichtig ist, AC soll die Graphen als Quelle aber nicht als Wahrheit sehen. Es muss ggf. immer geprüft und aktualisiert werden. Ein Graph kann unbemerkt oder durch einen Fehler veraltet sein. Also ist die Frage, gibt es das DB-Feld noch? Oder ist es weg? Oder kam ein neues Hinzu. - Uns soll nur die Suche und der Zugang zur Info erleichtert werden. Wie, in welchem Model liegt das Feld? Wo im Code wird es genutzt? Aber es kann immer sein, dass es öfter im Code genutzt wird oder auch weniger. D.h. wenn wir an etwas arbeiten, sollten wir immer die Wahrheit am Ende prüfen und aktualisieren. <!-- md-language-check: ignore -->

English: every graph ends up in the same map folder in a fitting structure,
not scattered. AC treats the graphs as a source, never as the truth; a graph
can be stale without anyone noticing. The questions are whether a database
field still exists, is gone, or a new one appeared; the map should only make
search and access easier — which model holds the field, where the code uses
it — but usage can always be more or less than the graph shows. When working
on something, check the truth at the end and update.

The invocation of 2026-10-26 adds, for the map interface: build the new design,
but "nur weil es im html steht ist es nicht immer richtig" — logo, icon and <!-- md-language-check: ignore -->
flyouts were already corrected on main.

## Working rules

1. A graph answer is a pointer with a witness, never a fact on its own.
2. Before acting on a graph fact, confirm its witness against the working tree.
3. Usage counts are lower bounds and are paired with a text search.
4. After acting, re-read what was touched and update the map.
5. Every graph, map and cache of a project lives under `agents/map/`; the
   machine-wide hub mirrors that layout in the user-global home.
