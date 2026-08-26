---
complexity: lightweight
review_by: 2026-12-24
---
# Stub: command runtime prerequisites

> **Stub — not active work, and a DRAIN-RUN TRANSFER** per [`README.md`](README.md)
> § The two classes. **Capability-gated:** the scope is decided and the work is
> wanted; what is missing is a schema-ownership decision no autonomous run may
> take. Promoted by its own named probe, never by the shared demand criteria.

## What was transferred

Phase 1 of `road-to-inbox-harvest-2026-08-e-command-surface-legibility`, on an AI
council verdict of 2026-08-24 (2/2 convergent; owner-reserved dispositions were
delegated to the council for that drain run).

- **1.1** declare command prerequisites using the existing `runtime_requires`
  vocabulary (`bins`, `env`, `primary_env`, `network`) from
  `src/scripts/schemas/skill.schema.json:45-89`.
- **1.2** the `check_command_needs` gate — a static invocation scan against the
  declaration, forward-only ratchet on the `command-verbs.yml` precedent.
- **1.3** probe declared prerequisites from an **existing** doctor entry point,
  reusing the reach probe taxonomy rather than building a parallel doctor.
- **1.4** hold the non-goals: no auto-install, no network on the default path.

## Why an autonomous run may not take it

`src/scripts/schemas/command.schema.json` is `additionalProperties: false` at
`:8`. Adding a key is therefore a **schema change plus four regenerations**, and
`requires` as a bare key is **reserved** for ADR-015 pack-dependency edges and
must not be used. The parent roadmap knows all of that and gates 1.1 on
`blocker: command-schema-additionalproperties`, whose owner is the maintainer.

A schema is a contract every consumer's frontmatter validates against. Widening
one to admit a new key is the kind of change this repository reserves, and the
blocker exists to say so.

**1.2's cost, measured on this run rather than estimated:** a new gate costs
**three ratchets** — `gate-coverage.yml` registration with a `scanned:` line and a
canary, the `gate-self-test:registered-non-adopters` shrink-only ratchet (which
reds immediately on a new registered gate with no `--self-test`), and the
`ci-parity:local-only` direction. Every one of those was hit and paid on this
run's other branches; a later reader should not rediscover them.

## Probe and named producer

**Producer:** the maintainer, on the schema-ownership decision.

**Probe — `probe-command-schema-runtime-requires`.** Returns true when **all**:

1. the schema-ownership question is resolved and `command.schema.json` accepts a
   `runtime_requires` key (or an agreed alternative name that is **not**
   `requires`);
2. the four regeneration targets are identified and run in order — `task sync`
   then `task generate-tools`;
3. the three registration obligations above are enumerated for
   `check_command_needs` before it is written, not after.

```bash
# Condition 1, mechanically:
python3 -c "import json;print(json.load(open('src/scripts/schemas/command.schema.json')).get('additionalProperties'))"
# false -> still gated.  true or a declared runtime_requires property -> condition 1 holds.
```

**Baseline on the transfer date:** `additionalProperties: false`; no
`runtime_requires` property; `check_command_needs` does not exist.

## The corrected 1.2 baseline travels with it

The parent pre-registered *"8 invoking / 14 mentioning, of 202"*. **Measured
2026-08-24: 8 invoking / 6 mentioning-only, of 202** recursive command files,
heuristic `(?:^|[`$\s(])<bin>\s+[a-z]` over `gh`, `docker`, `kubectl`,
`terraform`.

The **invoking** figure — the half the ratchet gates — is confirmed exactly. The
mentioning figure is not, and the council directed it corrected in place with the
population, heuristic and date recorded rather than investigated first, on the
ground that the gated quantity is the confirmed one. Whoever promotes this stub
starts from 8/6, not 8/14.

## What this stub does NOT cover

- **Phase 0**, complete: the gate now scans published `.md` with a zero-unapproved
  floor and twelve pinned exceptions.
- **Phase 2 and Phase 3**, which the council ruled **executable without any
  transfer** and which this run did not reach. They are open and un-executed in the
  parent, not blocked — see its § Step ledger.
- **Phase 4**, transferred separately to
  [`road-to-make-it-stick-telemetry.md`](road-to-make-it-stick-telemetry.md).
