# Update concerns — lifecycle contract and moved done notes

<!-- evidence-type: analysis -->

> **Source:** `agents/roadmaps/road-to-an-update-that-installs-itself-only-when-it-is-safe.md`,
> moved here verbatim on 2026-10-21 when the roadmap reached its line and step caps.

## Round 3 and the lifecycle contract

**Round 3 and the lifecycle contract (2026-10-21):** moving `update-auto-invite`
ahead of `journal-record` in the claude `stop` chain changed the ratified
digest. That round returned `refused` (one seat `ratified`, one `refused`):
the reorder was sound, but condition 6, host-equivalent consent and rollback
criteria were still open. A clarification round named what would close
them, and the change now carries it:
- **Consent, stated honestly.** The invite is one-way text on every host; it
  collects no answer, and `ask: native` changes how it is shown, not what it
  decides. It stays registered on every host on that basis.
- **One stop mechanism.** Option 3 tells the user to set `update.mode` back to
  `notify`; the advertised `upgrade --never-ask-auto`, which never existed,
  is gone, and so is the dormant `never` field.
- **Staged-state lifecycle.** `update-notice.json` (user-global): written
  atomically at 0600 with `schema: 1`, replaced whole, `staged` reset to
  `null` once nothing newer than the installed version is cached; a record
  that does not parse or carries another schema reads as empty. Deleting it
  is always safe, and no install path reads it.
  `update-invite.json`: `{invited_at}` per user-global config home, shared by
  every repository; a corrupt record counts as invited; deleting it resets.
- **Disable without a release.** `AGENT_CONFIG_NO_UPDATE_CHECK=1` silences
  both concerns; `update.mode: off` silences both; any mode but `ask`
  silences the invite. Disabled sessions neither write nor delete state.
- **Rollback criteria.** Revert the two registrations if the invite appears
  with any gate unmet, if a module outside the two concerns reads their
  state, or if either concern gains a write, a spawn or a deletion. The
  second is a CI assertion (`update_concerns_lifecycle.test.ts`, read gate);
  the third is `update_concerns_declared_effects.test.ts` for spawns. Every
  lifecycle clause above is a test in the lifecycle file, each seen red.

## Round 4 additions — the claim, the gate's reach, and the thresholds

Round 4 refused on four points; each is answered here.

- **"Once" is a claim, not a read.** `claimInvite` creates `update-invite.json`
  with `O_CREAT | O_EXCL`, and only the session whose create succeeds prints.
  Three processes started against one config home in five rounds produce
  exactly one invitation each round (`update_concerns_lifecycle.test.ts`); with
  the exclusive flag removed the same test is red.
- **What the read gate proves, and what it does not.** Two CI assertions: no
  module but the two owners names either state file or its reader, and no
  module but the concern registry and the invite hook imports either concern.
  A reader that builds the path at runtime escapes both. That residue is a
  review invariant, stated as one, not a guarantee.
- **The mode disables, tested with existing state.** `update.mode` `notify`,
  `off` and `auto` each ask nothing and leave an existing invite record
  byte-identical; the env kill switch does the same for both concerns.
- **Operational rollback thresholds.**
  - One confirmed report of a second invitation on one config home → remove the
    `update-auto-invite` registration.
  - The hook-latency gate (`bench_hook_latency --gate`) failing on
    `session_start` or `stop` with either concern as the measured cause →
    remove that concern's registration.
  - Any module found reading either state file outside its owner → remove both
    registrations, and the next registration needs a new ratification.
  - A host where the invite's text demonstrably does not reach the user → drop
    that host's `stop` binding.
  The first and last are reports, not monitors; this package has no runtime
  telemetry for them, and says so rather than implying one.

## Step 3.1 — done note, moved verbatim

Written and tested 2026-10-20 as `update-notice`
(`src/scripts/update_notice_hook.ts`), and **not registered**: the
manifest binds it on no event of any host, and its test asserts exactly
that, so the commit that registers it turns the test red and has to carry
the new council verdict. File reads only — the cached registry probe, the installed
`package.json` and `CHANGELOG.md`, the session register — so it opens no
socket; measured p95 over 20 in-process runs is asserted under 100 ms
against the 1.3 `session_start` baseline of 160 ms for the WHOLE
dispatch. **Registering it will need room first.** The conditional chunk
that made room for it (D10) was split out of this change on 2026-10-20:
it touches four ratification-watched files, the round that would ratify
it alone could not run on exhausted council quota, and without the two
concerns it buys nothing. Without it the bundle stands at 1,549,984 of
1,550,000 B, so the next round has to bring the room back with the
registration.

## Step 3.3 — done note, moved verbatim

visible token from it.
Landed 2026-10-20, as a SHAPE rather than as a scrubbing pass. The
update-check cache is the sanitising boundary: `_cacheable_impact` keeps
only keys that parse as versions and values from the published enum, so
a hostile description, version label or nested object is dropped once at
write time instead of being re-checked by every reader, and
`sanitiseImpactMap` applies the same reduction again on read. Prose comes
from `parseCuratedHead` over the INSTALLED `CHANGELOG.md` or from
sentences written in `_lib/update_notice.ts`; a cached version string
that does not parse produces no line at all. The concern exits 0 and
writes to stderr, so nothing it emits is model context on any host.

## Step 4.3 — done note, moved verbatim

`--json` output and a subagent run.
Landed 2026-10-20 as `update-auto-invite`
(`src/scripts/update_invite_hook.ts`), bound on `stop` and nowhere else.
All five contexts are asserted to produce zero prompts, and so are a
recorded "never", a second run, a mode the user already chose, and a turn
that did not end on a verified success — the last read through
`readRunEvidence`, the same evidence the turn-end gate uses.
**It is closed today by the 4.2 record, not by a flag:** it returns
before reading anything else while `ring-0-exit: no`, which is every
install. It never writes `update.mode`; the invitation says how, and the
"never" it records lives in its own state file and binds nothing else.
The question reaches the user through the warn path, in the host's
declared `ask:` shape (native tool where a host offers one, the numbered
text block otherwise).
**Narrowed 2026-10-20 to the council's (d):** the invitation now needs
`update.mode: ask` — a class-C value only a human can write — before it
reads the ring-0 record, which stays as a second kill switch. An absent
key and `notify` ask nothing, asserted. Not registered, like 3.1.
