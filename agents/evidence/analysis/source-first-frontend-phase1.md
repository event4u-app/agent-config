# Source-first frontend — Phase 1 measurement

> `road-to-source-first-frontend` Phase 1, Steps 1 and 2. Measured
> 2026-08-13 against `origin/main` @ `7ebbd10b5`, host Claude Code on macOS.

## Verdict in one line

**The falsifier did not fire, and it did not fire because the test could not
reach the symptom — not because the symptom is absent.** Both port arms came
back faithful, under two conditions that exclude the reported failure by
construction. Reporting this as "symptom not reproducible" would have been a
null manufactured by the setup.

## Step 1 — the ad-hoc port, two arms

The roadmap's step names one run. It was run twice, because the first arm's
prompt contained a `design-fidelity` trigger verbatim (`1:1 um`, shipped in the
rule's `triggers:` list) and a single arm could not separate "the rule fired"
from "the agent would have done this anyway".

| Dimension | Arm A (with trigger) | Arm B (no trigger) |
|---|---|---|
| Artifact file read before any write | yes | yes |
| Screenshot / vision path used | **not measurable** — see Step 2 | **not measurable** |
| 3 handlers survived | yes (3 `addEventListener`) | yes (3) |
| 1 keyframe survived | yes (1 `@keyframes`) | yes (1) |
| Losses / deviations stated | yes | yes |
| Diff vs. the fixture | 11 lines, comment block only | 39 lines, comment block only |

Arm A's prompt: `"Setz das 1:1 um"` + the fixture path.
Arm B's prompt: `"Ich brauche eine eigenständige HTML-Seite, die so aussieht wie
diese hier"` + the fixture path — no keyword, phrase, or file pattern from the
rule's trigger set.

Both arms cited `design.fidelity_mode` → `strict` unprompted. On this host that
is expected and is **not** evidence the trigger set works: Claude Code loads the
projected rule tree as project instructions, so `design-fidelity` is in context
whether or not a trigger matches. **The router is not the delivery channel on
this host.** Any claim about trigger efficacy needs a host where the router is
the only channel — this measurement cannot make one.

## Step 2 — the screenshot-tool census, and why it voids the second row

The census is the matcher list Phase 3 was to be built from. Measured, not
recalled:

| Tool surface | Name | Present on this host |
|---|---|---|
| macOS binary via `Bash` | `screencapture` (`/usr/sbin/screencapture`) | **yes** |
| Playwright MCP | `browser_take_screenshot` | no — not in the session tool surface |
| Chrome DevTools MCP | (equivalent) | no |
| Claude-in-Chrome | `mcp__claude-in-chrome__*` | skill present, tools **not connected** |
| Package tool registry (`agent-config mcp:available`) | github, jira | both read-only, neither captures |

**One capture tool, and it is the one that cannot photograph a web page.**
`screencapture` grabs the physical display; with no browser process rendering
the artifact, it has nothing to capture. So the "screenshot instead of source"
path was not declined by either arm — it was **unreachable**, and a dimension
that cannot vary is not measured.

The census also carries a finding for the roadmap's own Phase 3: its matcher
list was to be censused "across the supported hosts". This host contributes
exactly one entry, and it is a shell binary rather than a browser tool. A
matcher built from this census alone would watch the wrong surface.

## What the two arms DO establish

- **On a local, path-addressable artifact with no capture tool available, the
  faithful path is the one taken** — including the interaction inventory the
  engine normally owns, volunteered by both arms without being asked.
- **Both arms scoped their own verdict honestly.** Arm A stated it had no render
  capability and that its result was static-only; Arm B named the two
  non-changes it deliberately made. That is the `design-review` verdict-scoping
  duty holding outside the engine.

## What they do NOT establish, stated so the next run does not re-derive it

1. **Nothing about screenshot preference.** No capture tool existed.
2. **Nothing about the URL / live-page handover class** (W5). Both arms received
   a local filesystem path — the easiest case, and not the one the operator
   reported.
3. **Nothing about trigger efficacy**, because rule delivery on this host does
   not run through the trigger set.

## Step 3 — the instrument, and the population it does not have

> **Corrected 2026-08-13 after the second review round.** An earlier revision of
> this section described a design that no longer exists and endorsed a
> denominator the shipped code tells readers not to quote. Both are fixed below;
> the wrong version is left named rather than silently swapped, because an
> evidence file that quietly re-describes itself is worth less than one that
> records being wrong. It claimed the metric was captured by the nudge in two
> session fields, and that the rate rides "the consultation rate's own
> denominator". Neither holds: those fields were removed in the same review
> pass, and the quotable rate uses handover sessions.

The measurement lives in **one** place — `report_consultation_rate`, over
transcripts — and the nudge contributes only the shared `isArtifactRead`
predicate, which no decision branches on. Two rates are published:

- `artifact read (all UI turns)` — shares the consultation denominator, kept for
  comparability with that rate and for nothing else.
- **`READ BEFORE FIRST WRITE`** — the quotable one. Denominator: sessions that
  read a provided artifact **at all**, because a session with no handover cannot
  fail to read one, and including it would dilute the rate toward the size of
  the estate rather than the behaviour.

Run live on both stores the same day:

| Store | Sessions scanned | Sessions with a UI write | Artifact-read rate |
|---|---:|---:|---|
| this worktree | 2 | 0 | `n/a (0/0)` |
| the main checkout | 40 (truncated) | 0 | `n/a (0/0)` |

**Zero UI-write turns across 40 sessions, and that is correct rather than
broken.** This repository is a governed instruction suite: it has almost no
`*.tsx` / `*.blade.php` / component surface for `isUiPath` to match. The
instrument works — `measureSession`'s three new branches and `measureStore`'s
handover accumulation are unit-tested, including the first-write ordering and
the predicate overlap — but **it cannot be baselined here**, because the
behaviour it measures barely occurs in this repo.

> Those tests exist because the second review round found they did not. The
> earlier claim here ("its unit tests exercise every branch") was false when
> written: the three fields appeared in tests only inside a hand-built report
> literal fed to the renderer, so the measurement logic — the load-bearing
> half — was uncovered.

That matters for the roadmap's Phase 6, which plans a before/after on these
numbers: a re-measurement in this repo would compare `n/a` to `n/a`. The rate
needs a **consumer** repo with real UI writes to mean anything. Recorded now, so
Phase 6 is not planned against a denominator that does not exist.

The report also prints `⚠ 0 session(s) with a UI write — below the
pre-registered floor of 20` rather than a clean zero, which is the store-absent
vs store-empty distinction the script already defends.

## Consequence for the roadmap

The Phase 1 falsifier reads: *"Step 1 shows the ad-hoc run reading the source,
adopting the markup, and reporting losses without any of the changes below →
the symptom is not reproducible on current main; publish the null, park Phases
2–4."*

Its literal condition is met and it is **not** honoured, for the reason above:
the arms satisfied it in a setting where the failure mode had no way to occur.
Phases 2, 4 and 5 therefore proceed. The defects those phases repair are
verified statically and independently of this measurement — W2's contradicting
reference, W3's missing ad-hoc coverage duty, W4's absent adopt-the-code duty
and W5's trigger gap are all readable in the tree today.

**What would actually settle it:** the same two arms on a host with a connected
browser tool, and a third arm whose artifact arrives as a URL rather than a
path. Neither is available here; that is a host limitation, recorded rather than
worked around.
