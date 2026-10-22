<!-- evidence-type: council-question -->

# Decision 2, second round — admit a keyless route for the free-hands shadow?

Context and options are unchanged from round 1
(`agents/evidence/council/subagent-system-2583-rest-decisions-20261022.question.md`,
Decision 2). Round 1 split: one seat chose (c) do not admit, one chose (a) admit as
maintainer-only with the distribution field `unknown`. Their arguments, stated neutrally:

- For (c): the 30 s per-call limit makes 333 samples per kind take at least 2.8 hours; "community
  providers may follow different practices" weakens the training attestation; no billing class
  is verifiable; a maintainer-only route does not advance consumer defaults.
- For (a): it is the only keyless first-party route found, so (c) prevents the shadow from
  starting; absence of a distribution prohibition is not evidence for `permitted`, so `unknown`
  keeps it maintainer-only; admission enables the experiment but closes nothing by itself.
  Condition: enforce first-party models at run time, fail closed when provenance cannot be
  established, and record served-model provenance per call.

New facts, read 2026-10-22:

- The route's public model list (`GET https://text.pollinations.ai/models`) returns exactly one
  model for anonymous use, with `"community": false` and `"tier": "anonymous"`. A roster filter
  admitting only `community: false` entries is therefore enforceable at discovery time, and the
  existing identity rule (free-hands 2.4) already makes a call absent when the served model id
  differs from the requested one.
- The provider's published sub-processor list says "The model you choose, or its fallback,
  decides which of these receives your request", naming about twenty inference hosts. Downstream
  retention is therefore per host and not stated for the anonymous model.
- Billing: the route takes no key and no account, so there is nothing that could be billed;
  over its limit it answers HTTP 402, which free-hands 2.2 already maps to `policy_unproven_cost`
  (absent, never a paid fallback).
- Content: only `public-artifact` payloads are admissible on any free route (decision A10), and
  the corpus here is tracked files of a public repository, already published under its licence.
- Purpose: free-hands step 6.2 and the owner thresholds O5 (333 shadow calls per kind before a
  flip) measure whether free hands hold quality; AC-3 needs one live rung-0.5 call served by a
  real free route. Consumer defaults are a separate later question either way.

Choose (a), (b) or (c) as defined in round 1, give the deciding facts, the condition under which
your choice would be wrong, and reversibility.
