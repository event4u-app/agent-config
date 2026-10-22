# Three open roadmap blockers — pick one option each, with your reasoning

You are reviewing three blockers recorded in this repository's roadmaps. Each lists its
options. For each, answer with: the option you choose, the two or three facts that decide it,
the condition under which you would choose differently, and whether the chosen option is
reversible (can be undone by a later code or config change without lasting effect outside the
repository).

Context common to all three: the repository is a governed rule/skill suite for AI coding
tools. A paid host model is the "head" that plans and verifies; "hands" are bounded,
tool-less, typed calls whose output is a proposal the head checks. ADR-257 already permits an
unpaid route to propose and score, never to decide. The owner's directive of 2026-10-22: free
endpoints only for uncritical work that does not touch data protection; customer data
filtered or replaced; code reduced to what is needed; paid or self-hosted models repair and
finish; results at the usual quality, cost down. The owner also said that distributing work
means no single free provider learns the whole project.

Read the files yourself where you can:

- `agents/roadmaps/road-to-free-hands-a-paid-head-checks.md` — `## Blockers`, Phases 1-7,
  `## Kill register`, `## Decisions`.
- `agents/roadmaps/road-to-a-tier-the-dispatch-carries.md` — `## Blockers`, T5.
- `agents/roadmaps/road-to-one-detector-and-the-senders-we-own.md` — N4 and step 2.3.

## Blocker 1 — `free-route-admission` (free-hands roadmap)

What to do: pick exactly one —
(a) admit OpenAI-compatible `base_url` routes as free hands and jurors under ADR-257, first a
keyless endpoint, spend ceiling USD 0.00 enforced by billing class `free-quota`, shadow capped
at 2,000 calls, termination on the Phase 6 bars or three consecutive `model_unservable` per
route; or
(b) keep the slot unspent and park Phases 2-7 in `later/` with this question recorded as the
wake condition.

## Blocker 2 — `project-content-ceiling` (free-hands roadmap)

What to do: pick exactly one —
(a) a keyed free route may be raised to `project-content` only with a dated data-use
attestation (no training, no retention, source URL) and the egress engine in front, and
routes whose terms allow training on prompts stay `public-artifact` permanently; or
(b) every free route stays `public-artifact` permanently.
Under either option a keyless anonymous route stays `public-artifact`.

## Blocker 3 — `realistic-fakes-for-hands` (tier roadmap)

What to do: pick exactly one —
(a) keep N4: values leave as `__TYPE_n_fp__` tokens everywhere; record the quality question
of T5 as a pre-registered comparison to run if hands' verify-fail rate on token-bearing
payloads exceeds the paid arm by more than 5 pp; or
(b) admit fakes drawn only from ranges reserved for documentation or test use — domains under
`example.*` and `.test`, documentation IP ranges, a fixed list of conventional placeholder
names, IBAN shapes with a deliberately failing check digit — on free-route payloads only, each
fake reversible through the existing token scope, never on a paid seat, and only after a
pre-registered bar shows fakes raise the hands' verify pass rate over tokens.
