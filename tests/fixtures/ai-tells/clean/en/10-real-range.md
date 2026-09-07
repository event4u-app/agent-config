> Clean by construction: a range whose endpoints really are on a scale.
> Near-miss for `tell-false-range`.

Response times ran from 40 milliseconds to 2.1 seconds across the sample, and
from the p50 to the p99 the curve is almost flat until the last percentile.
The tail is one endpoint doing a synchronous lookup that should have been
cached at the edge.

We cached it. The p99 is now 310 milliseconds and the p50 did not move.
