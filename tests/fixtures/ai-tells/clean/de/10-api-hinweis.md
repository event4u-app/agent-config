> Clean by construction: Hinweis zur Abkündigung einer Schnittstelle.

Der Endpunkt `v1/reports` ist abgekündigt und antwortet ab dem 1. März nicht
mehr. Der Nachfolger `v2/reports` nimmt dieselben Filter und liefert dieselben
Felder mit zwei Unterschieden: Summen sind Zeichenketten statt Gleitkommazahlen,
und der Cursor ist undurchsichtig.

Beides gibt es, weil die alte Form bei großen Beträgen Genauigkeit verloren hat
und weil die Offset-Blätterung brach, sobald mitten im Durchlauf eine Zeile
eingefügt wurde. Wer den Cursor heute auswertet, hört damit auf.
