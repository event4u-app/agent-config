<!-- evidence-type: analysis -->
# Language refusals by pin source — 2026-10-19

Step 4.1 of `road-to-agent-throughput-recovery`, and the B/C input step 4.4
waited for. Detector B (`language`) refuses a reply whose language differs from
the session's pin. The pin store keeps 7 days, so the split by pin source is
taken through the transcripts instead, as the step's 2026-10-17 note required.

## How it was read

- **Refusal side.** The main checkout's refusal store
  (`agents/runtime/state/turn-end-gate/*.json`, shadow files excluded) holds
  **125** `language` refusals in **35** sessions on 2026-10-19.
- **Join.** Each transcript under the host's project directories for this
  repository (78 files, main checkout and worktrees) is keyed by
  `deriveSessionKey(<transcript id>)` from `src/scripts/_lib/turn_end_refusals.ts`
  — the same sha256 prefix the gate names its record with. **22** of the 35
  sessions join; they carry **109** of the 125 refusals. The other 16 refusals
  (13 sessions) have no surviving transcript and are not classified.
- **Per refusal.** Every `system` entry carrying the gate's own refusal text
  (`the pinned reply language is "<pin>" but the reply classifies as "<reply>"`)
  is one refusal; the count found per session equals the store's count in all 22
  sessions (109 = 109). For each, two turns are classified: the **immediate**
  user turn before it, and the last **real** one (a turn that is not a task
  notification, a slash-command expansion or a local-command echo).
- **Language rule.** German vs English function-word counts, the larger wins;
  a turn opening with `<task-notification>` or a command marker, or a bare
  number, is classed by shape before counting.
- Aggregate only: no prompt text, path or session id leaves the run. The
  counting script was a one-off and is not committed; the rules above are the
  whole of it.

## Split

| pin-setting turn (last real) | immediate turn | pin → reply | refusals | reading |
|---|---|---|---:|---|
| none — session opened by a command | task notification | en → de | 52 | misfire |
| none — session opened by a command | slash command | en → de | 13 | misfire |
| German prompt | task notification | en → de | 16 | misfire |
| German prompt | German prompt | en → de | 10 | misfire |
| bare number | bare number | en → de | 7 | misfire |
| English prompt | task notification / English prompt | en → de | 4 | correct refusal |
| German prompt | German prompt | de → en | 3 | correct refusal |
| bare number | task notification | de → en | 2 | correct refusal |
| unclassified | unclassified | either | 2 | unknown |
| **total** | | | **109** | |

**98 of 109 (90 %) are misfires, 9 correct, 2 unknown.** The largest class is
the session **opened by a command** with no plain-prose owner turn before the
refusal: **65 of 109 (60 %)**, still firing on 2026-10-17 (12) and 2026-10-18
(23).

## What the largest class is — and the correction to the step's candidate list

The step listed "a first turn that is a slash command and pins from the locale".
The locale cannot be the source here: this machine's shell reads
`LANG=C.UTF-8`, and `systemLocaleVerdict` maps `C`/`POSIX` to `und`, which
writes no pin. So the `en` pin in a command-opened session comes from
`source: prompt` — the **expanded slash-command body**, an English `.md` file,
classified as the owner's words. Every later wake of an autonomous run is a task
notification, which since PR #2186/#2188 cannot set the pin and therefore cannot
replace it either, so one English pin stands for the rest of the run. That the
hook process sees the same `LANG` as the shell is an inference, not a reading of
the hook's environment.

The 26 "German prompt, pin en" rows are the second class: an owner turn in
German that did not replace an English pin — either too short to classify
(`mach weiter`, `weiter`) or the stub's English-paste-under-a-German-lead
defect. The surviving pin store cannot say which, so they are not attributed to
the stub.

## Not done here

The fix. Step 4.1 asks for the misfire class's turn as a fixture in
`tests/fixtures/self-repair-detector-corpus.yml`, red before the fix; the fix is
a change to `language_mirror_hook.ts`, a governance hook, and carries its own
review (ADR-268 § 4). It stays open on the roadmap.

## Step 4.4 — the demotion contract, run for B and C

Read against `docs/contracts/turn-end-detector-demotion.md` § Sample floor. Only
records stamped with `agent_config_version` are eligible.

| detector | eligible refusals | affected sessions | days | condition 4 | verdict |
|---|---:|---:|---:|---|---|
| B `language` | 116 | 26 | 63 | reset by the pin fixes of 2026-10-03, #2186 and #2188 (54 refusals in 11 sessions since) | **floor not met — bar not readable** |
| C `verification` | 166 | 77 | 63 | reset by the classifier changes of 2026-09-29, 2026-10-01 and 2026-10-12 (`verification_command.ts`); 71 in 24 sessions since 2026-09-30 | **floor not met — bar not readable** |

Q2 medians over the whole store, published as the contract's item 1 and **not**
read against the bars: B 1.5, C 1. No staged-demotion study is authorised for
either detector. B's cost is real (90 % misfires above), and the contract is
explicit that friction alone never demotes — the remedy for B is the misfire fix
in 4.1, not a demotion.

## Correction (2026-10-20) — the attributed cause does not reproduce

Step 4.1's fix was about to be written against the largest class above — "the
session **opened by a command**, pinned `en` from the expanded slash-command
body". Four readings against `main` at `c43740e6b` contradict that attribution,
and the fix is withheld rather than written against a cause that does not
reproduce.

**C1 — the expanded body is not what the hook saw.** The one surviving pin
record of that shape (`agents/state/language-mirror/18dea663….json`, session
`5a3f6210`, 2026-10-19T05:51:13.693Z) reads `language: en`, `source: prompt`,
`prompt_chars: 2188`, `de_markers: 1`, `en_markers: 68`. The command that
opened the session was `/roadmap:process-full`, whose body is **32,256**
characters in the installed copy and 36,774 in `src/`. 2,188 is neither, so the
expanded body is not the text that was classified.

**C2 — what actually set that pin was a cross-session message.** The user turn
at that exact timestamp in the session's transcript is 2,770 characters and
opens `Another Claude session sent a message:` followed by
`<cross-session-message from="uds:…" from-name="agent-config-d3" …>` — an
English message written by another agent, not by the owner.

**C3 — that defect is fixed, on `main`, since this analysis was written.**
Commit `0c85ece41` (2026-10-20, "a host-wrapped agent message never sets the
pin") added `cross-session-message` to `AGENT_MESSAGE_FRAME` in
`src/scripts/_lib/prompt_shape.ts`. Re-run against the current tree, the exact
string above returns `isSyntheticPrompt = true`, so it no longer sets a pin.

**C4 — the compact slash-command shape classifies correctly today.** The form
the transcripts actually carry is
`<command-message>…</command-message>\n<command-name>/…</command-name>\n<command-args>…</command-args>`.
Run through `classify`: with the owner's German arguments it returns `de`
(de 4 / en 0); with empty arguments it returns `und` (de 0 / en 0), which leaves
any previous pin untouched and writes none on a first turn, because this
machine's `LANG=C.UTF-8` maps to `und`. Neither outcome is the misfire.

**What this does and does not establish.** It establishes that the stated cause
is not reproducible and that one real defect in the same population was closed
on 2026-10-20. It does **not** establish that the 65 refusals had that single
cause: this traced one pin record end to end (n = 1, the only surviving `en` /
`source: prompt` record of that shape — the store keeps 7 days), while the 65
were classified from transcripts by a heuristic whose "last real turn" rule
recognised task notifications, slash-command expansions and local-command echoes
as non-real and had **no category for a cross-session message**, which is prose
and would have been read as a real English turn or as no real turn at all.

**What 4.1 needs next.** A re-run of the split over sessions that start after
`0c85ece41`, with `cross-session-message` added to the classifier's non-real
set. Until that window exists there is no misfire class to write a fixture
against, which is why no fixture and no hook change ship here.

**One further correction, to the section above.** `language_mirror_hook.ts` is
**not** a gated surface. `check_kernel_edit_ratified --files
src/scripts/language_mirror_hook.ts` on a clean tree reports "no kernel rule,
governance hook, hook-plumbing source or self edit in the diff"; the governance
pattern is `src/scripts/hooks/block_*.ts`, and this file is neither under
`hooks/` nor named `block_*`. So 4.1's fix does not carry an ADR-268 § 4 review,
and the sentence above saying it does is withdrawn. 4.3's does, because
`block_no_verify.ts` matches.

