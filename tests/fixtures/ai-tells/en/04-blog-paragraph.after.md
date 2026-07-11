Caching is the art of answering a question with a saved answer instead of recomputing it. That saves time exactly when the same question comes up often and the answer changes rarely.

Next.js gives you four separate layers where this happens: request memoization inside one render, the data cache across requests, the full route cache for static pages, and the router cache in the browser. Each one has its own invalidation rules, and most caching bugs I have debugged came from confusing two of these layers.

Start by finding out which layer actually served your stale page. The rest follows from there.
