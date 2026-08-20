<!-- evidence-type: analysis -->
<!-- analyzed: 2026-08-20 | commit: 74a29ed20 | files: 5 -->

# Migration note — flipping the `project.audience` default from `public` to `internal`

**What this is.** The decision input `road-to-demand-gate-audience-followup.md`
Item 1 asks for: *what changes for a repo that never sets the key.* It does not
take the decision, and does not argue for either value. The flip is a
consumer-facing default change and is reserved to the maintainer.

Every claim below is read from the tree at `74a29ed20`; the file:line is given
so a reader can re-check rather than trust this note.

## The default IS supplied at read time — a template-defaults layer exists

This is the load-bearing finding, and it contradicts what three artefacts in
this tree currently say about themselves.

§ 8-pre `:115-123`, the template comment `:398-400`, and
`docs/contracts/settings-classes.md:113-120` all justify "absent resolves to
`public`" with the same reason: *this package has no defaults layer, so absent
means nobody said*. **That reason is stale.** `_DEFAULTS` no longer exists —
`src/scripts/_lib/agent_settings.ts:378` describes it as "the predecessor" —
and `load_agent_settings` now merges a real template-defaults layer beneath
every file layer at `agent_settings.ts:873`:

```
const merged: SettingsDict = template_defaults(template_path ?? undefined);
```

`template_defaults()` (`:381-392`) reads the shipped template and prunes only
the `settingsCarveOut` keys. `project.audience` is **not** carved out
(`src/shared/settingsCarveOut.ts` — 9 keys, none of them this one), so the
template value is what an absent key resolves to, mechanically. Measured, not
inferred — with every file layer pointed at a nonexistent path:

```
$ npx tsx -e "…load_agent_settings({project_path:'/nonexistent/a.yml',
                                    user_global_path:'/nonexistent/b.yml'})"
project = {"pr_template":".github/pull_request_template.md","upstream_repo":"",
           "improvement_pr_branch_prefix":"improve/agent-","audience":"public"}
audience resolves to = public
```

The *conclusion* those three artefacts state is therefore right and the
*reason* is wrong — which matters here because the reason is what decides the
blast radius of the flip:

| | If there were no defaults layer | What actually happens |
|---|---|---|
| Edit the template default | Reaches only settings files written afterwards | **Reaches every install that never set the key**, at its next read |
| Prose edit to § 8-pre | Would be the only thing that moved existing installs | Documentation of a mechanism, not the mechanism |

So the flip is **one edit with a wide blast radius**, not two edits with narrow
ones. Every install whose settings file has no `audience:` line — i.e. every
install created before the key shipped — changes behaviour on upgrade, with no
action by its maintainer and nothing in the diff they would read. That is a
larger consumer-facing change than the parent roadmap's framing implies, and it
is the single fact a decision on Item 1 should turn on.

Two consequences for whoever takes the decision:

- An install that has `audience: public` written out literally (any settings
  file created from the template since the key shipped) is **unaffected** — its
  own file layer outranks the defaults layer.
- `tests/contracts/demand_gate_audience.test.ts` (test: *documents whichever
  default the template actually ships*) fails if the template moves and the
  § 8-pre prose does not, so the two cannot silently disagree.

**Not repaired here.** The stale reason in `settings-classes.md:113-120` is a
shared contract passage governing the nine carve-out keys and every reader that
relies on them, well outside this roadmap's scope; it is surfaced rather than
edited. The two `audience`-local statements — § 8-pre and the template comment —
are corrected in the same change as this note, since they describe this key.

## What changes, behaviourally, for a repo that never sets the key

From the § 8-pre branch table (`:125-130`):

| | `public` (today) | `internal` (after the flip) |
|---|---|---|
| Demand questions asked | all three (`:134-136`) | question 2 only — *what breaks if you don't build it?* |
| The L0–L4 ladder | full ladder, `Build` only at L-self / L3 / L4 (`:149-150`) | not reached; the requester is taken as known |
| Recommendation for an internal hunch | **Defer** (L0, `:143`) | no deferral on demand grounds |

**The material one is not in that table.** § 8-pre `:159-162` reads: *"At
`L-self`, or at `audience: self` / `internal`, never write a roadmap gate, exit
criterion, or opening condition that names an external user population, a
market, or an external measurement."* Flipping the default to `internal` makes
that **prohibition** the default for every unconfigured install. That cuts both
ways, and both directions belong in the decision:

- It is exactly the prohibition that fixes the reported defect — the 33-step
  roadmap held closed on "external installations with write activity".
- It would also, by default, forbid a genuinely public product's roadmap from
  gating on a market measurement, in a repo whose maintainer never set the key.
  The repair is one line (`audience: public`), but the maintainer has to know to
  write it.

## What does NOT change under either value

- The `L-self` row and the honest scoping sentence (`:142`, `:111-120`) — Phase 1
  of the parent roadmap fixed the acute damage with **no** settings change.
- The L3 / L4 market rows (`:146-147`) and `Build now`. The ladder is extended,
  never flattened.
- Any install that sets `audience:` explicitly, at any value.
- Every safety floor. `project.audience` governs a demand *recommendation*; it
  gates nothing in `non-destructive-by-default`, `scope-control`, or any domain
  safety floor.
- `lint_roadmap_complexity`'s external-population warning (parent Phase 3). It
  reads the roadmap text, not the audience, so it fires identically under both
  values. It is the only deterministic backstop in this area and it is
  audience-independent by construction.

## Reversal

One line in the consumer's own settings file:

```yaml
project:
  audience: public
```

No code change, no reinstall, no migration script. This is the cheapest reversal
in the settings surface, which is a real argument for the flip being low-risk —
and equally an argument that the flip buys little, since setting the key is
already this cheap in the other direction.

## Mechanical steps the flip would require

1. **The mechanism** — template `:401` and schema `:144`
   (`z.enum(...).default('internal')`). This one edit is the behaviour change,
   for new and absent-key installs alike; the rest of this list is documentation
   catching up to it.
2. The § 8-pre absent-value sentence `:115-123` — and while it is being touched,
   drop the falsified "no defaults layer" clause rather than re-pointing it at
   the new value.
3. Update the template's own comment block `:397-400`, which currently explains
   `public` as *"the behaviour every install had before this key existed"* — a
   sentence that stops being the default's justification the moment it is not
   the default.
4. `docs/contracts/settings-classes.md:439` — the class-C row records the
   default and the reason *"the default is today's behaviour, so an install that
   never sets it is unchanged"*. That clause becomes false.
5. Rebuild the committed install bundle (`npm run build:install-bundle`) — the
   schema changed. Parent Phase 2 hit this; Risk 4 of the parent's register
   records that skipping it reds Install-Aux with a message naming the bundle
   rather than the schema.
6. `docs/MIGRATION.md` — the flip is the class of change that file exists for.

## Enforcement, honestly

Nothing reads `project.audience` to change what § 8-pre does; the branch table
is **model-carried** and says so in its own text (`:172-177`). This note
therefore describes a change in what the agent is *told*, not in what any gate
*enforces*. A consumer who flips the default and observes no behaviour change
has not found a bug — they have found the honesty boundary the section already
declares.

## What this note deliberately does not contain

A position on whether an unconfigured repo running this package is more likely
internal than public. That is the other half of Item 1, and no instrument in
this tree can produce it: there is no telemetry directory, no install-population
record, and `project.audience` is a class-C key the agent never writes and
nothing reports. The evidence half of that question is a measured zero; only a
maintainer judgement can close it.
