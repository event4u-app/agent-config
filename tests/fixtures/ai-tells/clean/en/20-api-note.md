> Clean by construction: an API deprecation notice with ordinary technical
> vocabulary throughout.

The `v1/reports` endpoint is deprecated and will stop responding on 1 March.
Its replacement, `v2/reports`, takes the same filters and returns the same
fields with two differences: totals are strings rather than floats, and the
cursor is opaque.

Both changes exist because the old shape lost precision on large currency
totals and because the offset pagination broke whenever a row was inserted
mid-scan. If you parse the cursor today, stop.
