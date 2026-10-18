<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# When does the minimum Node.js version rise from 20 to 22?

Repository: `event4u/agent-config`, an npm package (`@event4u/agent-config`) installed globally by consumers into AI coding hosts. Its hooks run on every host event through Node.

## Authority for this question

The repository owner delegated the resolution of open decisions to this council on 2026-10-18, verbatim: "versuche die offenen entscheidungen im ai council zu lösen" ("try to resolve the open decisions in the AI council"). On 2026-10-16 the owner wrote, verbatim: "frag so einen scheiß den council nicht mich. ich will nicht immer gestört werden" ("ask the council things like this, not me; I don't want to be disturbed all the time"). A council round on 2026-10-16 (same two providers) returned ESCALATE 2/2 on this question — dropping Node 20 removes a compatibility commitment — and both seats picked (a) framed as a semver-major. That round ran before the 2026-10-18 delegation.

## The question

Pick exactly one:

- **(a)** raise `engines.node` to `>=22` in the next release and move the Node-20 CI pins with it in the same change, cut as a semver-major and as the first release classed `action` (consumer must act);
- **(b)** raise it with the next release that is a major for other reasons, and keep Node 20 working until then;
- **(c)** do not raise it yet, and record the date the decision is revisited.

## Evidence

- `package.json` declares `"node": ">=20.11.0"`.
- Re-measured 2026-10-16: the workflows carry 38 literal `node-version: '20'` pins across 20 files, plus 3 matrix lists `node: ['20', '22']` in 2 more — 41 sites in 21 files.
- Node 20 passed its upstream support window on 2026-04-30.
- `SECURITY.md:21-22`: fixes land on the latest published version; older releases are not backported.
- `BREAKING_CHANGES.md`: install layout and settings keys are public contract; majors are frequent and each names what broke. The repository's release numbering follows breaking-ness of commits.
- The roadmap this blocks (`road-to-an-update-that-installs-itself-only-when-it-is-safe`) is building an unattended updater with an `engines` refusal gate already landed (step 2.1): an install whose local runtime does not satisfy `engines` is refused. Step 4.5, the only step blocked, wants the raise to be the first real `action` release so the "ask the user" path is exercised on a real case rather than a fixture. Phases 1–3 and steps 4.1–4.4 proceed without the answer.
- Other open questions in the same council sweep (asked separately) touch major-release timing: removal of two settings keys (`lean_projection.mode`, `projection.mode: tiered`) is already known to make the next release that carries it a major.
- Both earlier seats required, under (a): the `engines.node` change and the CI pins move atomically; migration notes name the last Node-20-compatible version and state plainly that it gets no backports. One seat's reading: CI pinning Node 20 while nothing is backported to it emits "a compatibility signal the project will not actually honor".
- Resolution requires an ADR or release decision under `docs/decisions/` recording the choice.

## Omitted

The roadmap's own recommendation paragraph is not reproduced; its facts are above. No code is changed by this decision record itself — implementing it is the roadmap's step 4.5.

## Answer format

Choose one option (or name a different option explicitly), give your reasoning in one or two paragraphs, and state the conditions your choice carries (for (c), the revisit date). End with exactly these lines:

CHOICE: <a|b|c|other>
OWNER-ONLY: <yes|no>

OWNER-ONLY is `yes` only if the decision requires a human action (a physical or forge/UI action, a human-run probe) or a governance self-amendment; otherwise `no`.
