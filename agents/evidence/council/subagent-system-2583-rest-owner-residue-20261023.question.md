<!-- evidence-type: analysis -->

# Council question — three open decisions on feat/subagent-system-2583-rest (PR #2588)

For each item below give: (1) your chosen option and a two-sentence reason; (2) whether the
transition is **council-decidable** or **owner-reserved**, judged by this test: does it weaken an
owner-reserved invariant, amend governance authority, create an undelegated external, irreversible
or spend-bearing commitment, or lower a security/privacy floor? Yes, or not establishable from the
facts given → owner-reserved. Otherwise, reversible inside the repository → council-decidable.
Answer each item on its own; options are listed in no order of preference.

## Item A — blocker `delegated-owner-defaults`

The repository's ownership classes lock `product-owned`, `business-owned` and `destructive-owned`
decisions to the owner (`src/scripts/ai_council/ownership_classes.ts`). An earlier autonomous run applied
council answers to decisions of a locked class. This PR added a roadmap checker that now refuses a
locked-class decision row whose resolver is not `owner`; four older council rows are recorded as a
baseline. The question is whether a run delegation may ever settle a locked-class decision.

- (a) Never. A council answer on a locked class is recorded as a recommendation; work behind it
  may be built only dormant (no default, no configured route, no network) while the item stays
  open for the owner.
- (b) Only under a written, dated owner delegation committed under `agents/evidence/delegations/`,
  naming the exact blocker ids, and only when both seats call the choice fully reversible; the
  checker then accepts resolver `owner:delegation:<file>` for exactly those ids.

The one recorded case that exercised this: one seat could not read the cited files, and both seats
called the choice only partially reversible.

## Item B — hook dispatch bundle ceiling

`dist/hooks/dispatch.js` is built from source on every hook call path. Its ceiling is
1,550,000 B (`src/config/hook-bundle-budget.json`, `shrink_only: true`, a raise needs a
`raise_log` entry and a council ratification record). The current reading is 1,549,949 B — 51 B of
room. Roadmap step 2.4 needs a carrier that delivers the consumer's project instructions to a
subagent that skips them (a `SubagentStart` injection, or a delegation-nudge dispatch rule). Its
size is not measured; it does not exist yet. The same budget file already supports **chunks**:
modules loaded only when a caller needs them, each with its own ceiling, so their bytes are not
paid on every dispatch (precedent: the egress-detection chunk, ceiling 32,000 B).

- (1) Raise the dispatch ceiling now by a fixed headroom (for example to 1,560,000 B) so 2.4 can
  be built.
- (2) No raise now; build the carrier, measure it, and raise to the measured size plus margin in
  the same change, with its own ratification.
- (3) No raise; the carrier is built as a lazily loaded chunk with its own ceiling, and only the
  loader stub enters `dispatch.js` — which may itself need a few hundred bytes the 51 B cannot hold.

## Item C — `ask_transport`

`src/scripts/ask_transport.ts` sends one bounded completion to a configured route (council seats,
or free/self-hosted routes the user configures), hard-capped, no session, no tools. It is not a
consumer CLI command. The shipped `delegation_nudge_hook.ts` nevertheless tells agents to run
`./scripts-run src/scripts/ask_transport …`, a path that exists only in this repository's own
checkout. So in a consumer install the nudge names a command that is not there, and the free-route
chooser and hand payload behind it are reached from no consumer entry point.

- (1) Declare it maintainer-only: the nudge cites it only when the session runs inside this
  repository's checkout (a package-checkout check the hook does not have yet), and the roadmaps record the
  free-hands routes as maintainer tooling.
- (2) Ship it as a consumer CLI command (`agent-config ask …`) and make the nudge cite that. Note:
  a consumer-facing command that sends project content to a user-configured external route.
- (3) Leave it as it is.
