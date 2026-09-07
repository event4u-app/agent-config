> Clean by construction: ordinary engineering prose. Near-miss for
> `tell-ai-vocabulary` — `seamless` and `underscore` here are technical terms
> with their plain meanings, not stock adjectives.

The migration is not seamless and we are not going to pretend otherwise. Reads
switch over first, writes follow a week later, and during that week both stores
are authoritative for different columns. The schema uses an underscore prefix
for the shadow columns so a `SELECT *` in an old query cannot pick them up by
accident.

If the read path regresses, we flip one flag and traffic returns to the old
store within a minute. That path is tested nightly.
