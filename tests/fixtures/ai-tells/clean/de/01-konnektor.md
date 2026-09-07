> Clean by construction: gewöhnliche deutsche Fachprosa. Near-miss für
> `tell-de-connector-stack` — "zudem" ist hier ein normales Bindewort.

Der Import läuft seit Dienstag wieder stabil. Zudem haben wir die
Wiederholungslogik angepasst, weil die alte Variante bei einem Timeout dreimal
denselben Datensatz geschrieben hat.

Wer die Exporte weiterverarbeitet, sollte die Spaltenreihenfolge prüfen. Sie
hat sich nicht geändert, aber die letzte Spalte ist jetzt leer statt null, und
manche Parser behandeln das unterschiedlich.
