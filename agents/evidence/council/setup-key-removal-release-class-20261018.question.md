<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# Two release questions: when do two settings keys leave, and does a merged behaviour change need a note?

Repository: `event4u/agent-config`, an npm package installed by consumers into AI coding hosts. Its install layout and settings keys are public contract.

## Authority for this question

The repository owner delegated the resolution of open decisions to this council on 2026-10-18, verbatim: "versuche die offenen entscheidungen im ai council zu lösen" ("try to resolve the open decisions in the AI council"). On 2026-10-16 the owner wrote, verbatim: "frag so einen scheiß den council nicht mich. ich will nicht immer gestört werden" ("ask the council things like this, not me; I don't want to be disturbed all the time"). On 2026-10-12 the owner directed that the setup decide itself and that these keys go; that directive orders the removal, not its release class or timing.

## Part A — release class and timing of the key removal

Roadmap `road-to-a-setup-that-decides-itself` Phase 4 removes `lean_projection.*` (including `lean_projection.mode`) and retires the value `projection.mode: tiered`, through a shipped tombstone mechanism, with a one-release window that reads old values once. The blocker `what-a-minor-may-remove` closed 2026-10-14 on its option (c): a key may leave in a minor only when no consumer can rely on it (default-neutral and derivable, proven by a named test); any other removal ships only in a major. `lean_projection.mode: delivery` written user-globally is a live opt-in that thins `~/.claude/rules`, and `projection.mode: tiered` is still acted on by `install.ts`, so removing either is relied-on behaviour: whichever release carries it is a **major**. A drain lane screened Phase 4 and did not land it, holding that landing it on `main` fixes the next release as a major, a release commitment.

Pick one (these options are this lane's framing):

- **(A1)** land Phase 4 on `main` when its steps are ready; the release that carries it is a major, with a `### Breaking` entry and a `BREAKING_CHANGES.md` row;
- **(A2)** hold Phase 4 off `main` until a major is being cut for another reason, and land it into that major (a separate question in this sweep asks whether the Node floor rises to 22 as a semver-major now);
- **(A3)** defer Phase 4 until the roadmap's Phase 5 non-inferiority result exists;
- **(other)**.

Also relevant: step 4.7 (`projection.mode` itself) waits for the separate skills-completeness question; step 4.1's ADR records the chosen class and timing.

## Part B — does PR #2455 need a breaking or behaviour-change note, and where does the release read it?

PR #2455 (merged 2026-10-18, squash `3f8c98e74`) made the claude hook command fall through to a staged dispatcher after the project-local install and before `PATH`. On machines where every hook concern used to exit silently (npx installs, launches with a bare `PATH`) the dispatcher now runs — including three `fail_closed` guards: `block-no-verify`, `block-kernel-rule-writes`, `block-plumbing-writes`. They may refuse for the first time after the upgrade. The PR body asked for the release head to name them; one inner commit carried `Consumer-Impact: notice`.

How the release reads consumer impact (`CONTRIBUTING.md` § Versioning, `src/scripts/_lib/consumer_impact.ts`): a `Consumer-Impact:` trailer counts **only in the final paragraph of the commit body**, and only if every line of that paragraph is a trailer; "for a squash merge, in the squash commit's body". Values: `none`, `automatic`, `notice` ("should read the release notes"), `action` ("must do something or the install breaks"). Recording is advisory; the numbering still follows breaking-ness. Separately, the release writes a curated head with labels "Behaviour changes", "Default changes + migration", "Security and correctness", "Honest nulls", "Known limitations", pre-filled by the generator and edited by a human; and `BREAKING_CHANGES.md` has a hand-kept "Pending — landed on `main`, not yet in a released major" table that the release moves into its per-major table.

**Measured 2026-10-18 by running the release's own parser** over the first-parent commits `16.5.0..origin/main` (161 commits): 5 squash commits carry `Consumer-Impact:` lines only in inner paragraphs (GitHub's squash body ends with a `Co-authored-by:` paragraph), so the parser reads them as `none, recorded: false`. Two of the five carry `notice` inside: `3f8c98e74` (#2455) and `3245c7e7c` (a setup roadmap PR). So as the tree stands the next release records neither notice.

Pick one (this lane's framing), and say where the note must live:

- **(B1)** treat it as breaking: a `BREAKING_CHANGES.md` "Pending" row now;
- **(B2)** not breaking, a `notice`: no Pending row; the next release head's "Behaviour changes" line must name the three guards, and the lost trailer is recovered (state how: e.g. a `Pending`-style record the release reads, a correction to the release span reading, or a manual head line verified at release);
- **(B3)** no note needed;
- **(other)**.

## Omitted

The PR body and the roadmap Phase 4 step texts are summarised. Fixing the squash-trailer loss in code is out of scope for this decision record; it is reported as a defect either way.

## Answer format

Answer Part A and Part B separately, each with one paragraph of reasoning. End with exactly these lines:

CHOICE: A=<A1|A2|A3|other> ; B=<B1|B2|B3|other>
OWNER-ONLY: <yes|no>

OWNER-ONLY is `yes` only if the decision requires a human action (a physical or forge/UI action, a human-run probe) or a governance self-amendment; otherwise `no`.
