---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "A grep across agents/roadmaps/ and docs/decisions/ for any host traffic environment variable returns zero, so no roadmap, stub or later/ entry can absorb this; the change is a documentation and diagnostic surface with no owner to merge into."
relates: []
---
# Road to host traffic knobs that ship

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t03/` — a four-file supplied-plan set
> (two independent agent proposals, each revised once) plus the transcript that
> commissioned them. Class: external agent proposals about this repo. One proposal's
> later revision corrects the earlier one's mapping of these variables; this roadmap
> carries the corrected mapping.

## Goal

The package documents, and `doctor` reports, which host environment variables govern
non-essential network activity — with each variable mapped to what it actually
controls and nothing more. Falsifiable: today
`grep -rnE "DISABLE_NONESSENTIAL_TRAFFIC|DISABLE_AUTOUPDATER|BASH_MAX_OUTPUT_LENGTH|MAX_MCP_OUTPUT_TOKENS" src docs`
returns **0 hits**, so a consumer running on a metered link has no surface here at all.
The goal is met when that grep returns documented entries and `doctor --json` reports
the observed state of each.

## Why this is not already the case, and what must not happen

Two things are true at once and only one of them is in the tree. The package ships
consumer settings templates and an onboarding document; neither mentions a traffic
knob. And the correct mapping is **not** the obvious one: the earlier of the two
supplied proposals treated one blanket variable as also disabling the host's
auto-updater, and its own later revision retracts that — the updater has its own
separate variable. Shipping the wrong mapping would silently leave security updates
running while the settings claim otherwise, or silently disable them while the
settings claim only telemetry was touched. Either is worse than the current zero.

This roadmap therefore **flips no default**. It documents, it reports, it does not
decide. Writing a value into a consumer's environment is a consumer-facing default
change and stays with the owner.

## Phase 1 — Get the mapping right before writing it anywhere

- [x] **1.1 Record one variable per line with what it actually controls.** In a
      documentation surface under `docs/setup/`, one row per variable: the variable, the
      behaviour it governs, the behaviour it does **not** govern, and the dated host
      version the row was checked against. The blanket non-essential-traffic variable and
      the auto-updater variable are separate rows and must not be described as
      interchangeable.
      verify: the new rows exist and each carries a dated `checked against` field;
      `grep -c 'DISABLE_AUTOUPDATER' docs/setup` is at least 1

      <!-- done 2026-09-29: `docs/setup/host-traffic-environment.md`, four rows, each a
      `Governs` / `Does NOT govern` / `Checked against` table. Blanket variable and
      auto-updater variable are separate `###` sections.

      $ grep -rc 'DISABLE_AUTOUPDATER' docs/setup/host-traffic-environment.md
      docs/setup/host-traffic-environment.md:2
      $ grep -c 'Checked against' docs/setup/host-traffic-environment.md
      5
      $ grep -o 'Claude Code 2.1.284 · 2026-09-29' docs/setup/host-traffic-environment.md | wc -l
             4

      (`grep -c` counts LINES, not occurrences: 2 lines mention `DISABLE_AUTOUPDATER` —
      its own section heading and the blanket row that names it as a neighbouring rung.
      `Checked against` is 5 = four row fields plus the one intro sentence that states the
      default. The dated string appears exactly 4 times, once per row, which is the count
      the step actually cares about.)

      ROADMAP CLAIM THAT DID NOT REPRODUCE — this is the step's main finding.
      The roadmap's header and its Risk-1 row both assert a "corrected mapping" in which
      the blanket non-essential-traffic variable does NOT disable the host's auto-updater,
      the updater having "its own separate variable". Measured against the shipped host,
      that is FALSE and the retraction it came from is the error, not the fix.

      Measurement unit, published before the number it produces: one row = one named
      environment variable whose effect was traced to at least one named branch in the
      SHIPPED HOST BINARY at a pinned version, by locating the code that reads
      `process.env.<NAME>` and following the branch that value controls. Not a vendor
      document, not recall. Reproduction:

      $ claude --version
      2.1.284 (Claude Code)
      $ strings -n 6 "$(npm root -g)/@anthropic-ai/claude-code/node_modules/@anthropic-ai/claude-code-darwin-arm64/claude" > /tmp/cc.strings
      $ grep -oaE '.{260}DISABLE_AUTOUPDATER.{260}' /tmp/cc.strings

      The update-disabled-reason resolver reads, in order: `DISABLE_UPDATES`, then
      `DISABLE_AUTOUPDATER`, then a helper that returns the literal string
      `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` when that variable is set. The blanket
      variable is therefore the resolver's THIRD rung — setting it does stop background
      auto-updates. The same posture also gates telemetry, error reporting, `/bug` and
      `/feedback`, plugin-archive downloads, `/design-sync` and Projects.

      NEITHER number is carried forward as received: the doc ships the MEASURED mapping,
      names the discrepancy in its own `A correction this page carries` section, and tells
      a reader to set each behaviour's narrow variable explicitly rather than rely on any
      one variable's fan-out. The acceptance criterion "neither row claims the other's
      effect" is met in substance — each row describes only its own variable — and is not
      allowed to suppress a verified fact about the blanket variable's own reach, because
      the direction of the roadmap's error is the dangerous one: a reader who believed the
      retraction would silently stop receiving updates while believing only telemetry was
      touched. That is exactly the outcome Risk 1 exists to prevent.

      Two further rows corrected against the same binary: `BASH_MAX_OUTPUT_LENGTH`
      (default 30000, non-positive falls back, above 150000 is capped) and
      `MAX_MCP_OUTPUT_TOKENS` (default 25000) are output-SIZE caps, not traffic switches —
      they bound request size, never request count, and the doc says so under
      `Does NOT govern` because treating them as traffic knobs is the available mistake. -->

- [x] **1.2 State where the mapping came from and how stale it can go.** These are
      third-party behaviours; a row with no date is a claim with no expiry.
      verify: every row carries a date, and the surface states that an undated row is
      to be treated as unverified

      <!-- done 2026-09-29: the surface carries a `How these rows were established — the
      measurement unit` section giving the method and a three-command reproduction, and an
      Iron-Law block immediately under the intro:

      $ sed -n '/A ROW WITH NO/,/OWN HOST/p' docs/setup/host-traffic-environment.md
      A ROW WITH NO `CHECKED AGAINST` DATE IS UNVERIFIED AND MUST BE TREATED AS
      UNVERIFIED — NOT AS A FACT THAT SIMPLY LOST ITS DATE. RE-CHECK IT AGAINST YOUR
      OWN HOST BEFORE ACTING ON IT.

      Every row carries the date (verified in 1.1: 4 occurrences, one per row). The method
      section also states its own limit rather than implying completeness — it establishes
      what a variable is WIRED to, not that the branch is reached in a given
      configuration. The date is carried in the code too: `TRAFFIC_VARIABLES` in
      `src/scripts/_cli/doctor_network_posture.ts` stamps each row's `checked_against`,
      and a test asserts the field ends in a `YYYY-MM-DD`, so an undated row reds rather
      than shipping as a fact (sensitivity probe recorded under 2.2). -->


## Phase 2 — Report the observed state, change nothing

- [x] **2.1 Add a traffic-environment section to `doctor --json`.** For each
      documented variable: set or unset, and the value if set. Read-only; `doctor`
      reports, it does not write.
      verify: `agent-config doctor --json` emits the section, and running it twice
      leaves the environment and every settings file byte-identical

      <!-- done 2026-09-29: `src/scripts/_cli/doctor_network_posture.ts` supplies
      `trafficEnvironmentJson(env)`; `cmd_doctor.ts` wires it in one line beside the
      existing `execution` and `forge_protection` blocks.

      $ ./agent-config doctor --json | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['traffic_environment'], indent=2))"
      {
        "host": "claude-code",
        "host_observed": true,
        "doc": "docs/setup/host-traffic-environment.md",
        "read_only": true,
        "rows": [
          { "variable": "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "state": "unset", "value": null, "checked_against": "claude-code 2.1.284 · 2026-09-29" },
          { "variable": "DISABLE_AUTOUPDATER",                     "state": "unset", "value": null, "checked_against": "claude-code 2.1.284 · 2026-09-29" },
          { "variable": "BASH_MAX_OUTPUT_LENGTH",                  "state": "unset", "value": null, "checked_against": "claude-code 2.1.284 · 2026-09-29" },
          { "variable": "MAX_MCP_OUTPUT_TOKENS",                   "state": "unset", "value": null, "checked_against": "claude-code 2.1.284 · 2026-09-29" }
        ]
      }

      (rows re-indented here for width; the `·` escape is `cmd_doctor`'s documented
      `ensure_ascii=True` JSON parity, not a defect in this section.)

      Byte-identity across two consecutive runs — the property, not the intent:

      $ ./agent-config doctor --json > doc1.json          # + git status --porcelain, shasum of every .agent-settings.yml
      $ ./agent-config doctor --json > doc2.json          # + the same two snapshots again
      $ diff doc1.json doc2.json    && echo "JSON IDENTICAL"
      JSON IDENTICAL
      $ diff st_before.txt st_after.txt && echo "TREE IDENTICAL"
      TREE IDENTICAL
      $ diff set_before.txt set_after.txt && echo "SETTINGS IDENTICAL"
      SETTINGS IDENTICAL

      Read-only is also structural, not only observed: the function's whole input is an
      injected `env` map and its whole output is a fresh object — it opens no socket,
      resolves no path and holds no reference to a settings file, so there is no write
      for a later convenience to grow out of. A unit test asserts both that two calls are
      deep-equal and that the env map handed in is unmutated.

      SOURCE-SIZE RATCHET, paid rather than raised. Wiring cost 2 lines in
      `cmd_doctor.ts`, which sits ~2,100 lines past the 1,500 cap where every added line
      is an added violation, and `check_source_size_budget` sat at its baseline with zero
      headroom. So `_check_offline_readiness` (17 lines) moved into the new module as a
      PURE MOVE — same id, status, message and remedy, asserted by two tests — leaving a
      1-line delegate in the style of the `_check_python_runtime` precedent.
      cmd_doctor.ts 3,618 -> 3,604; total excess 17,762 -> 17,748, exit 0.

      The baseline is deliberately NOT lowered to 17,748: this is a local reading on a
      branch, and the committed number has to be the gate's reading on the MERGED tree.
      The gain is real and the gate is green with headroom; a later lowering commit
      measured after merge can bank it. -->

- [x] **2.2 Report unknown rather than guess.** On a host where the variable has no
      documented meaning, the row reads `not applicable on this host` rather than being
      omitted — an omitted row reads as "fine" and is the failure this whole surface
      exists to stop.
      verify: on a non-Claude host fixture the section is present and every row reads
      `not applicable on this host`

      <!-- done 2026-09-29: `trafficEnvironmentJson(env, hostOverride?)` takes the host as
      an injectable seam; `tests/scripts/doctor_network_posture.test.ts` drives it with the
      non-Claude fixture `{ host: 'cursor', observed: true }`, and with an unidentified
      host, which resolves to `unknown` — a host that documents nothing, so every row reads
      the literal. A guessed host is never reported: `host_observed` carries the same
      observed-vs-assumed distinction `routing:doctor` draws for its platform field.

      $ npx vitest run tests/scripts/doctor_network_posture.test.ts
       ✓ tests/scripts/doctor_network_posture.test.ts (12 tests) 64ms
       Test Files  1 passed (1)
            Tests  12 passed (12)

      SENSITIVITY — the tests were shown red against the exact bug they guard, twice, and
      the module was restored from a `/tmp` copy each time, never by `git checkout`.

      Probe A, the omission bug (row list filtered to applicable variables — the "obvious
      implementation" this step names):

       × ... > emits every row, and every row reads the literal not-applicable state
       × ... > still reports the value of a variable that is set but not read here
       × ... > resolves an unidentified host the same way, with host_observed false
       Tests  3 failed | 9 passed (12)

      The FIRST run of probe A failed only 2 of those 3 — and that is a finding about the
      test, not about the code. The third assertion was a `for` loop over the row array,
      which an omitting implementation leaves EMPTY, so it passed vacuously: the test that
      existed to catch omission was itself blind to omission. A `toHaveLength` assertion
      was added ahead of the loop and probe A was re-run, giving the 3-failure result
      above. Without the probe that hole would have shipped looking like coverage.

      Probe B, an undated row (the `checked_against` date stripped), confirming 1.2's
      guard is sensitive too:

       × the documented variable set > carries the four variables the roadmap names, each with a dated check
       Tests  1 failed | 11 passed (12)

      $ cp /tmp/.../dnp.bak.ts src/scripts/_cli/doctor_network_posture.ts   # restore, both times
      $ npx vitest run tests/scripts/doctor_network_posture.test.ts
       Tests  12 passed (12) -->


## Phase 3 — Say it once, in the place a reader is already looking

- [x] **3.1 Point `ONBOARDING.md` at the new surface in one line.** No second copy of
      the table; a pointer, per this repo's thin-root discipline.
      verify: `ONBOARDING.md` gains exactly one pointer line and no table

      <!-- done 2026-09-29: the pointer went into
      `src/templates/consumer-settings/ONBOARDING.md` § See also.

      $ git diff --stat src/templates/consumer-settings/ONBOARDING.md
       src/templates/consumer-settings/ONBOARDING.md | 1 +
       1 file changed, 1 insertion(+)
      $ git diff src/templates/consumer-settings/ONBOARDING.md | grep "^+" | grep -c "^+.*|.*|"
      0

      Exactly one added line, zero added table rows.

      WHICH `ONBOARDING.md` — the roadmap names the file without a path and the tree holds
      two. The root `ONBOARDING.md` is an internal subagent / role / persona integration
      map; `src/templates/consumer-settings/ONBOARDING.md` is the consumer-facing tour
      that ships to a project. The phase title is "say it once, in the place a reader is
      already looking", and a developer on a metered link is looking at the consumer
      onboarding, not at a subagent composition map — so the pointer went there. It is
      also the only one of the two in `src/`, which is the source of truth this repo
      edits. The choice is recorded rather than assumed because a reader checking the
      acceptance criteria against the root file would otherwise find nothing. -->


## Phase 4 — Deferred, owner-reserved

- [~] **4.1 A settings profile that writes these variables.** Writing a value into a
      consumer's environment changes behaviour the consumer did not ask to change,
      including possibly their security updates. Deferred to an owner decision; the
      blocker below states it.
- [~] **4.2 Any figure for what these variables save.** No byte metric exists in the
      tree yet, so any saving figure would be unbacked. Deferred until a byte metric
      lands and one paired run measures it.

### blocker: traffic-profile-writes-consumer-environment

**Status:** open
**Owner:** maintainer
**Blocks:** Phase 4.1
**What to do:** pick exactly one — (a) ship documentation and the `doctor` report only,
and never have this package write a traffic variable into a consumer environment;
or (b) authorise a settings profile that writes them, with the auto-updater variable
excluded from every profile so security updates are never disabled by this package;
or (c) authorise a settings profile that may include the auto-updater variable, on the
condition that `doctor` reports the disabled updater on every run.
**Resolved when:** the maintainer states (a), (b) or (c) in a comment on the roadmap or
in an ADR, and Phase 4.1 is either cancelled or rewritten to the chosen shape.
**Recommendation:** (b). The documented gap is real and the reporting surface is
risk-free, but silently disabling a host's security updates is not a thing this package
should be able to do, and (b) keeps that specific outcome impossible by construction.
**If you do nothing:** Phases 1 to 3 still ship and are useful on their own — the
mapping is documented and `doctor` reports it — and a consumer on a metered link sets
the variables themselves. Nothing regresses; the automation simply does not arrive.

## Acceptance criteria

- A documentation surface under `docs/setup/` carries one row per host traffic
  variable, each naming what it controls, what it does not, and the dated host version
  it was checked against.
- The blanket non-essential-traffic variable and the auto-updater variable appear as
  two separate rows and neither row claims the other's effect.
- `doctor --json` emits a traffic-environment section listing the observed state of
  each variable, and two consecutive runs leave the tree byte-identical.
- On a host where a variable has no documented meaning, its row is present and reads
  `not applicable on this host`.
- `ONBOARDING.md` carries exactly one pointer line and no duplicate table.
- No default is flipped and no value is written into any consumer environment by this
  change.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The documented mapping is wrong and a reader disables more than they intended | product | This is not hypothetical here: the earlier of the two supplied proposals described the blanket non-essential-traffic variable as also disabling the host's auto-updater, and its own later revision retracts that. A consumer who follows a wrong row on a metered link can silently switch off security updates while believing they suppressed telemetry. That outcome is strictly worse than today's zero rows, because a wrong instruction is acted on and an absent one is not. | Step 1.1 gives each variable its own row naming both what it governs and what it does **not** govern, and requires the blanket variable and the auto-updater variable to be separate rows that never claim each other's effect. Its verify greps for the auto-updater variable by name, and the acceptance criteria repeat the two-row separation as a pass condition. | Phase 1 — Get the mapping right before writing it anywhere |
| 2 | The mapping goes stale silently as the host changes | product | These are third-party environment variables whose meaning is set by a vendor on their own release schedule. A row that was accurate when written stays in the tree reading as current after the behaviour behind it changes, and nothing in this package can observe the drift — so the surface degrades from correct to confidently wrong with no signal at any point. | Step 1.1 requires every row to carry the dated host version it was checked against, and Step 1.2 states in the surface itself that an undated row is to be treated as unverified. A row with no date therefore fails 1.2's verify rather than passing as fact, which makes staleness visible to the reader instead of invisible. | Phase 1 — Get the mapping right before writing it anywhere |
| 3 | A reader takes the documentation as permission for this package to set the variables | product | Documenting a knob and reporting its state is one short step from writing it, and an operator reading a complete mapping plus a `doctor` row naturally asks why the package does not just set them. Writing a traffic variable into a consumer environment changes behaviour the consumer never asked to change, and under the wrong mapping it could disable their security updates. | Phase 4.1 is deferred rather than scheduled, and the open blocker names the decision as owner-reserved with three explicit options and a recommendation. The roadmap states plainly that it flips no default and writes no value, and the acceptance criteria carry that as a pass condition rather than as prose. | Phase 4 — Deferred, owner-reserved |
| 4 | `doctor` grows a section that writes state while reporting it | implementation | `doctor` already touches settings surfaces, so a new section that resolves traffic variables is one convenience away from normalising a value, seeding a default or caching an observation into a file. A reporting command that mutates the tree makes its own output unreliable — the second run describes the state the first run created. | Step 2.1 specifies the section as read-only, and its verify is the property rather than the intent: running `agent-config doctor --json` twice must leave the environment and every settings file byte-identical. The acceptance criteria restate the two-consecutive-runs check, so a write introduced later fails a test. | Phase 2 — Report the observed state, change nothing |
| 5 | A host with no such variable silently gets no row and reads as healthy | implementation | The obvious implementation skips variables that do not apply to the current host, which produces a section listing only the variables that resolved. An operator reading a short clean section concludes their traffic is governed, when in fact the package simply had nothing to say about that host — an omission that reads as a clean bill of health is the precise failure this surface exists to prevent. | Step 2.2 requires the row to be present and to read `not applicable on this host` rather than being omitted, and its verify runs against a non-Claude host fixture where every row must read that way. The acceptance criteria carry the same requirement, so an omitting implementation fails rather than looking tidy. | Phase 2 — Report the observed state, change nothing |
