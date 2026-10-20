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
