> Clean by construction: Vorfallbericht mit sachlichem Subjekt.

Die Warteschlange war um 03:40 leer, der Rückstand um 04:05 abgearbeitet. Der
Alarm kam neun Minuten nach dem ersten fehlgeschlagenen Auftrag.

Ursache war eine Verbindungsgrenze, die wir auf Anwendungsseite erhöht und auf
Datenbankseite vergessen haben. Die Datenbank hat die zusätzlichen Verbindungen
abgelehnt, die Worker haben die Ablehnung als vorübergehenden Fehler gewertet
und es erneut versucht.

Beide Grenzen stehen jetzt in derselben Konfigurationsdatei.
