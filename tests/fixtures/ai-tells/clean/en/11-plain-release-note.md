> Clean by construction: an ordinary release note, no near-miss, included so
> the corpus is not made entirely of hard cases.

Version 4.2 adds keyboard shortcuts to the review queue and fixes two bugs.

The shortcut list is on the help overlay, which opens with a question mark.
The two fixes: attachments over 20 MB no longer fail silently, and the export
now writes UTC timestamps instead of the server's local time. The second one
changes existing exports, so if you have a downstream parser that assumed local
time, check it before you upgrade.

No database migration. Rolling back is a redeploy of the previous tag.
