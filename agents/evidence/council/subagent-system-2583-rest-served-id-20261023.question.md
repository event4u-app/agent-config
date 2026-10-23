<!-- evidence-type: analysis -->

# Council question — a keyless route whose listed model id is an alias of the id it serves

Choose one option and give a two-sentence reason, then name the strongest objection to your
choice. Options are listed in no order of preference.

## Observed, 2026-10-23

The free-hands shadow window (`internal/bench/free-hands-shadow/run.ts`, owner-approved) sends
public-artifact asks to the keyless route `https://text.pollinations.ai/openai`. Its two first
free calls were absent: `policy_model_mismatch … requested openai-fast, served gpt-oss-20b`.

- `GET <base_url>/models` lists exactly one id: `openai-fast`.
- The route's first-party list (`https://text.pollinations.ai/models`) has one entry, name
  `openai-fast`, aliases `openai, gpt-oss, gpt-oss-20b, ovh-reasoning`, tier `anonymous`.
- A request with `model: openai-fast` answers with `model: gpt-oss-20b`. A request with
  `model: gpt-oss-20b` answers with `model: gpt-oss-20b`.

`discoverRouteModels` (`src/scripts/ai_council/free_route_catalog.ts:198`) builds the roster from
the `/models` ids filtered by the first-party names and aliases, so the roster is `[openai-fast]`.
`FreeRouteClient.ask` (`src/scripts/ai_council/free_route_client.ts:80`) keeps an answer only when
`servedMatches(requested, served)`; otherwise the member is absent. The rule in
`src/scripts/ai_council/free_route.ts` header: "identity is derived from the served id, and a route
serving another model than the one requested is absent". So today this route can never answer, on
the shadow harness and on every production path that reaches it.

## Options

- (1) **Resolve the served id once, keep the identity rule exact.** Discovery adds the first-party
  aliases of each listed id to the roster as candidates; a run (or `free_route_catalog discover`)
  makes one probe call with the listed id, and when the served id is one of that entry's declared
  aliases it records the served id as the model to request. Later calls request `gpt-oss-20b`, get
  `gpt-oss-20b`, and the exact match holds. A served id outside the declared aliases stays a
  mismatch.
- (2) **Accept a declared alias at match time.** `servedMatches` also passes when the served id is
  a declared alias of the requested id in the route's own first-party list; no probe, roster
  unchanged.
- (3) **Change nothing in the code; record the route as unusable** and close the shadow window as
  not runnable on this route.
