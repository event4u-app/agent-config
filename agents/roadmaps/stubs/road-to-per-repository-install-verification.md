---
complexity: structural
review_by: 2026-09-25
---

# Stub: road to per-repository install verification

> **Stub — not active work.** A **drain-run transfer**, not a demand-gated stub.
> Created 2026-08-26 when
> [`road-to-internal-estate-fit`](../archive/road-to-internal-estate-fit.md) was
> drained and its **step 0.1 refuted the premise Phase 1 rests on**. Framework
> of record:
> [`drain-blocker-dispositions-b.md`](../../evidence/council/drain-blocker-dispositions-b.md).
> Outcome state recorded on the parent: **transferred**.
>
> **Transferred, not completed. No manifest writer was added and no drift report
> was built.**
>
> Unlike most transfers, this one is **not** blocked on a missing environment.
> It is blocked on a recorded architectural decision — **ADR-020, consumer
> installs are global-only** — whose reopening is owner-reserved.

## The criteria, verbatim from the parent

> **1.1 Write the manifest on every install path that projects a surface.**
> `verify:` a scratch install into a temp directory produces
> `agents/installed-tools.lock`; a second install updates it; the file validates
> against its own contract's schema version.

> **1.2 Report per-surface drift, not one number.**
> The measured case has three surfaces from three dates. A single "you are
> behind" line would have hidden exactly the fact that made it diagnosable.
> `verify:` the report names each projected surface with its recorded version
> and the package version, and a fixture with two surfaces at different versions
> prints two rows.

> **1.3 Sabotage the drift check before believing it.**
> Roll one surface back in a scratch tree, confirm the report names it, restore.
> A check never seen fire has unknown sensitivity.
> `verify:` the deliberate rollback is reported; after restore the report is
> clean. Record both outputs.

And the goal sentence they serve, which is the reason re-scoping was refused:

> *"The suite can state, with a command rather than a claim, whether it is
> correctly installed **in a given repository** and whether the shapes that
> repository actually has are ones it recognises."*

## What 0.1 found — the premise, refuted with measurements

0.1 asked whether the absent manifest was *"a writer fix or a migration"*. It is
**neither**. Measured at HEAD on 2026-08-26:

**1. A project-scope install is refused outright.**

```
$ ./scripts-run src/scripts/install --project /tmp/probe --scope project \
    --tools claude --no-ui --quiet --no-smoke --core-only
❌  --scope=project is reserved for maintainers (ADR-020 — consumer installs are
    global-only). Set AGENT_CONFIG_DEV_MODE=1 to opt in.
```

No `agents/` directory was created in the scratch project.

**2. THERE ARE TWO MANIFESTS, and the parent roadmap conflates them.** This is
the finding, and it is worth more than the phase it blocked.

| | `~/.event4u/agent-config/installed.lock` | `agents/installed-tools.lock` |
|---|---|---|
| Scope | **user-global** | **project** |
| Written by | `write_lockfile` (`_lib/installed_lock.ts:228`), 5 call sites | nothing on a consumer path |
| Path resolved by | `lockfile_path()` (`:98-109`) | `_lib/installed_tools.ts:100` |
| Schema | `schema_version: 1` | `SCHEMA_VERSION = 2` (`installed_tools.ts:47`) |
| Present on this machine | **yes**, 489 bytes | **no** |

The five writers of the global lockfile: `install.ts:3657`, `install.ts:3751`,
`_cli/cmd_update.ts:548`, `_cli/cmd_uninstall.ts:800`,
`install/partitionEligibility.ts:338`. It exists here carrying
`agent_config_version: "14.12.0"`, `installed_at: "2026-08-25T12:28:34Z"`, a
`host_layer_fingerprint` and a tools list.

**So "four of four consumer repositories carry no `agents/installed-tools.lock`"
is not four oversights and not a defect. It is ADR-020 working as decided.**

Two files with similar names, different schemas and different scopes produced a
roadmap phase built on the wrong one. Both council seats asked for that
conflation to be recorded durably, independently of the disposition; this table
is that record.

## What was promised, what is reachable, and the gap

Both seats asked for these three to be separated rather than blurred:

1. **Promised** — *"whether it is correctly installed **in a given
   repository**"*: per-repository projection state, per surface, with dates.
2. **Reachable today without touching ADR-020** — *"whether this USER has a
   valid global install"*: tools present, version, host-layer fingerprint,
   schema valid. Genuinely useful, and **not what the roadmap promised**.
3. **The gap** — per-repository projection state is **unverifiable by design**
   under the current architecture. One lockfile per user cannot say what any
   particular repository received, whether files were changed there afterwards,
   or even whether that repository took part in the recorded install.

## Why re-scoping was refused — the disposition, and its argument

AI council 2026-08-26, **2/2 convergent on transfer**
(anthropic/claude-sonnet-4-5 + openai/codex-default, two rounds, blind peer
review). Four options were put: execute as written, re-scope onto the global
lockfile, transfer whole, or something else.

**Re-scoping was refused as a goalpost move, in both seats' words.** The
discriminator both applied: a **generic** goal may legitimately be re-scoped
when its premise is refuted; a **specific, measurable** one may not.
*"In a given repository"* is specific and measurable, and the global lockfile
does not satisfy it. One seat: *"It changes the observable promise from
repository verification to global installation verification."* The other: *"A
council cannot quietly redefine success to match what it's permitted to
execute."*

**Executing as written was refused too** — it would make consumer installs write
a project-scope manifest into every consumer repository, contradicting ADR-020
as a side effect of a roadmap step rather than as a reopening of that decision.

## The unresolved product decision this stub holds

> **Does repository-specific install verification justify reopening ADR-020's
> global-only decision?**

Owner-reserved: it changes what a consumer install writes into a consumer's
repository. Nothing in this stub proposes an answer. What it records is the
cost of each side — the gap above is what "no" preserves, and a project-scope
artefact in every consumer repository is what "yes" introduces.

## Probe — a decision record, not a measurement

- **Producer:** the **repository owner**, ruling on the question above. No
  measurement substitutes for it: this is an authority gate, not an evidence
  gate, and the evidence is already complete.
- **Probe — one reading:** does a decision record exist that either reopens
  ADR-020 for this purpose, or declines it with the gap accepted in writing?

  ```bash
  ./scripts-run src/scripts/adr_cite_check ADR-020     # status, amendments, successors
  ```

- **Measured on this tree, 2026-08-26, as the transfer-date baseline:** ADR-020
  stands unamended for this purpose; `--scope=project` is maintainer-gated; no
  decision record proposes otherwise; `agents/installed-tools.lock` is absent
  from every consumer repository inspected and from this worktree.

## The narrower phase that could be proposed separately

Both seats named it explicitly so it is not lost: a **global-install
verification** phase — validate `~/.event4u/agent-config/installed.lock` on
every install path, check its completeness and its `host_layer_fingerprint`,
report drift against the package version. That is worthwhile and it is
**reachable without reopening anything**.

It is **not** this stub, and must not be presented as completing it. One seat
was explicit: *"it should become a new, explicitly narrower phase or follow-up,
not be presented as completion of the existing repository-specific goal."*

## Promotion gates

The README's shared promotion criteria (recruited customer, funded security
audit, ADR sign-off) do not govern a drain-run transfer — see that file's
§ The two classes. One gate governs this one:

1. **A recorded owner decision on the ADR-020 question above.** Either
   direction promotes or closes this stub; see below.

## Closing in the other direction — the honest-null path

A recorded decision that **repository-specific verification does not justify
reopening ADR-020** closes this stub completely and legitimately. The gap in
§ What was promised then becomes an accepted, written limitation of the
architecture rather than an open item — which is strictly better than a stub
that sits here forever because nobody said no out loud.

## Seed content on promotion

- Re-read § What was promised first. If the decision is "yes", 1.1's verify is
  already the right acceptance test and needs no rewrite.
- Do **not** reuse the global lockfile's schema. `installed_tools.ts` already
  defines the project-scope schema at version 2, with `scope` values
  `global | project`, and it is the one 1.1's verify names.
- 1.2's per-surface requirement is the load-bearing half and the parent explains
  why: the measured case had **three surfaces from three dates**, and a single
  "you are behind" line would have hidden the fact that made it diagnosable.
- 1.3's sabotage is unchanged and non-negotiable: roll one surface back, confirm
  the report names it, restore, record both outputs.
- The refined `doctor` behaviour from the parent's 0.2 already ships and should
  be revisited alongside this: it currently reports a manifest-less consumer
  install as **expected**, which stops being true the moment this stub is
  promoted.
