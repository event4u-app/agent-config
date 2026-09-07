> Clean by construction: a short changelog entry, longer than the density floor
> but written in the clipped register a changelog uses.

Fixed: the CSV export dropped the last row when the file ended without a
newline.

Fixed: timezone selector no longer resets to UTC after a failed save.

Changed: the session cookie is now marked `SameSite=Lax`. Embedded views in a
third-party iframe will need the new embed token; the old flow stops working on
the first of next month and there is no grace period, because the cookie
setting is what closes the bug.
