> Clean by construction: a genuine rhetorical question in an ordinary internal
> memo. Near-miss for the signposting and authority-trope families.

So why did we not catch this in staging? Staging has one tenant and production
has four hundred, and the bug only appears when two tenants write to the same
row inside the same second. We could seed staging with four hundred tenants.
That would cost about a day of setup and would still not reproduce the timing.

The cheaper fix is the one we took: a unique index, and a test that writes from
two connections at once. It fails without the index. I checked.
