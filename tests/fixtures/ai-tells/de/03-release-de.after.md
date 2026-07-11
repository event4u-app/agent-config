## Version 4.2.0

Die Einstellungsseite wurde neu gebaut. Optionen aus drei Tabs liegen jetzt auf einer durchsuchbaren Seite, und die Tastaturnavigation funktioniert durchgängig.

Der Sync großer Arbeitsbereiche ist schneller: 10.000 Elemente brauchten bisher 40 Sekunden, jetzt 6, weil der Client Deltas statt Voll-Snapshots anfragt.

Direktnachrichten sind ab sofort Ende-zu-Ende verschlüsselt. Bestehende Verläufe bleiben lesbar, neue Nachrichten nutzen das neue Format.

Eine Breaking Change gibt es: Der Endpunkt v1/export entfällt. Der Ersatz v2/export liefert dieselben Felder plus Paginierung.
