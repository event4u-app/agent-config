<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# Which completeness do skills owe a consumer?

Repository: `event4u/agent-config`, a governed skill/rule/command suite installed into AI coding hosts (an Anthropic CLI agent as the first host, Codex CLI, Cursor, ...). It authors 300 skills.

## Authority for this question

The repository owner delegated the resolution of open decisions to this council on 2026-10-18, verbatim: "versuche die offenen entscheidungen im ai council zu lösen" ("try to resolve the open decisions in the AI council"). On 2026-10-16 the owner had written, verbatim: "frag so einen scheiß den council nicht mich. ich will nicht immer gestört werden" ("ask the council things like this, not me; I don't want to be disturbed all the time"). A council round on 2026-10-16 (same two providers) returned ESCALATE 2/2 on this question, on the ground that choosing the binding promise creates a public commitment; both seats then recommended (b). That round ran before the 2026-10-18 delegation.

## The question

Pick exactly one reading of what a consumer is promised to receive:

- **(a) presence:** every skill installed on every host with native skills.
- **(b) reach:** every skill reachable in one deterministic step with its declared semantics; presence decided per host.
- **(c) today's pack-scoped install**, recorded as the promise.

And the coupled sub-question (roadmap step 6.3): **may the default projection include the skills that surviving artefacts declare in `skills:` / `requires_skills:`?** Yes → the installer's scoped prune keeps every declared skill (default install grows from about 229 to about 242 of 300); no → prune the declaring commands instead; or (other) state it.

## Evidence

- `README.md:59` today: "**Pack-scoped install** — writes the active pack only, not a 500-artefact dump."
- ADR-267 § Decision 5 (rules, not skills): "every rule file is written for every host, and every body is delivered on match. A stub is a form, not a subset." No equivalent statement exists for skills.
- Measured 2026-10-12: a `--global --ai claude-code` install into an empty HOME writes 229 of 300 authored skills (plus 15 command wrappers). 71 skills are not installed; without the package's MCP server they are not reachable at all.
- Measured on the first host: on a default install the host itself stripped every skill description and dropped hundreds of entries from the model-visible list (it has a listing budget). Codex CLI lists skills within a budget and omits the rest with a warning. The full listing of all 300 is about 59,000 characters.
- Skill invocation here is deterministic: an activation census counted zero model-initiated invocations over 30 sessions; entry points are commands, flows, search and an explicit name.
- Step 6.3, reproduced offline 2026-10-18: 28 `skills:` declarations name a skill that exists in the package and that the default projection prunes; 13 distinct skills; every declaring artefact is an untagged command that survives the prune (e.g. `/implement-ticket` declares `refine-ticket` and `feature-planning`). So a default install today ships commands whose declared skills are absent. 23 of the 28 edges sit in one pack. A council round on 2026-10-18 escalated 6.3 2/2 because every remedy changes what `README.md:59` promises.
- The earlier seats' cost notes on (b): it makes the query/retrieval path a capability requirement (a host that cannot supply it is "unsupported"), and needs an operational definition — authoritative skill set, supported hosts, what "one step" means, version selection, failure behaviour, offline expectations, what counts as preserved semantics.
- A drafted sentence for README.md:59 under (b) exists: "Every skill included in this package is available with its documented behavior through one deterministic retrieval step on supported hosts; each host may decide which skills are installed locally."
- What depends on the answer: step 4.6 (on-demand materialisation on the first host) and a sibling roadmap's removal of the `projection.mode` setting. Other phases proceed regardless.

## Omitted

The roadmap's own recommendation paragraph and its risk register are not reproduced; the facts they rest on are above. No code was changed for this question.

## Answer format

Choose one option for each part (or name a different option explicitly), give your reasoning in one or two paragraphs, and state any condition your choice requires. If you choose (b), say whether the drafted README sentence is acceptable or give a replacement. End with exactly these lines:

CHOICE: <a|b|c|other> ; 6.3: <keep-declared|prune-commands|other>
OWNER-ONLY: <yes|no>

OWNER-ONLY is `yes` only if the decision requires a human action (a physical or forge/UI action, a human-run probe) or a governance self-amendment; otherwise `no`.
