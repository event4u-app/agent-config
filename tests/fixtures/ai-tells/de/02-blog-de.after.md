Caching heißt: Eine Frage wird mit einer gespeicherten Antwort beantwortet statt neu berechnet. Das lohnt sich genau dann, wenn dieselbe Frage oft kommt und sich die Antwort selten ändert.

Next.js hat vier getrennte Schichten, in denen das passiert: Request-Memoization innerhalb eines Renders, den Data-Cache über Requests hinweg, den Route-Cache für statische Seiten und den Router-Cache im Browser. Jede Schicht hat eigene Invalidierungsregeln.

Die meisten Caching-Bugs, die ich debuggt habe, entstanden aus der Verwechslung von zwei dieser Schichten. Der erste Schritt ist deshalb immer: herausfinden, welche Schicht die veraltete Seite ausgeliefert hat.
