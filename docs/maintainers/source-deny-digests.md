# Cutting the source deny set over to keyed digests

`src/scripts/external_sources_denylist.json` currently publishes, in plaintext
in a public repository, the harvest-source names it exists to hide. The list is
the disclosure. This page is the recipe for ending that.

## Read this first: the four steps below are ONE change

AI council 2026-08-28, blocker `where-the-key-lives` in
`road-to-source-silence`, 2/2 convergent and unqualified:

> Shipping the executable half as a **replacement** for the current gate is
> net-negative. The half that can be built without repository secrets is
> precisely the half that enforces nothing — landing it alone leaves the gate
> either failing every run for want of a key, or silently degraded to warn mode,
> which is the exact failure the roadmap was written about.

One seat: *"you've added complexity without adding protection, and you've broken
a gate that at least worked before."* The other: *"the security cutover must be
atomic … missing keys in CI must fail, never warn."*

So steps 1–4 land together or not at all. **Do not do step 2 in one PR and step
4 in the next.** An interim gitignored plaintext list with graceful degradation
to warn mode was proposed by one seat and is recorded as **not adopted**, for
the reason the other seat gave.

## What already shipped, dormant

| Piece | Where | State |
|---|---|---|
| HMAC-SHA256 matching, folding, tokenisation | `src/scripts/_lib/source_digest.ts` | built, unused |
| The no-key contract (loud warn, `exit 3` under strict) | same, `digestMode` | built, tested |
| Digest generation from a private master | `src/scripts/build_source_digests.ts` | built, unused |
| The gitignore rule for the private master | `.gitignore` | active |
| `deny_digests` key in the tracked config | `external_sources_denylist.json` | present, **empty** |
| Tests, against a **non-production fixture key** | `tests/scripts/source_digest.test.ts` | green |

Because `deny_digests` is empty, the digest code path does nothing and costs
nothing. The plaintext `deny` array stays in force and is **not** deleted.

## The cutover, in one change

**1. Provision the key.** Generate a high-entropy secret and store it as the
repository secret `SOURCE_DENY_KEY`. Keep a copy wherever your other maintainer
secrets live — losing it means regenerating every digest from the master, which
is survivable, but losing the *master* is not.

**2. Create the private master.** `src/scripts/external_sources_denylist.private.json`
is gitignored. Move the current plaintext `deny` array into it verbatim:

```json
{ "deny": ["\\bsome-token\\b", "some-owner/some-repo"] }
```

Add the token families the census surfaced (Phase 0.3): decrypt with
`./scripts-run src/scripts/sweep_source_surfaces --decrypt agents/evidence/reports/source-attribution-census.md`
and read its `candidates` array. It over-reports by design — a human decides
which entries are real source families.

**3. Generate the digests and delete the plaintext.**

```bash
export SOURCE_DENY_KEY='…'
./scripts-run src/scripts/build_source_digests          # writes deny_digests
```

Then remove the `deny` array from the tracked config in the same commit. Keep
`_deny_digests_README`, `skip_paths` and `skip_reason`.

**4. Make CI strict.** In the workflow step that runs the gate:

```yaml
env:
  SOURCE_DENY_KEY: ${{ secrets.SOURCE_DENY_KEY }}
  SOURCE_DENY_STRICT: '1'
```

`SOURCE_DENY_STRICT` makes a missing key **exit 3**, never 0. Add a step before
the gate that asserts the secret is non-empty, so a mis-scoped secret fails
visibly rather than as a confusing gate error.

## After the cutover

- `./scripts-run src/scripts/build_source_digests --check` verifies the tracked
  digests still match the private master. Run it when you edit the master.
- Contributors without the key get a **loud stderr warning** and a run that
  explicitly says it did not check the hashed set. That is deliberate: it is the
  one state where the gate is weaker than it looks, and it says so.
- Update `tests/scripts/source_digest.test.ts` — its last case asserts the
  shipped config is still dormant (`deny_digests` empty, `deny` non-empty). That
  assertion is the tripwire that catches a half-cutover, so invert it rather
  than deleting it.

## What this does not fix

Keyed digests still cannot discover a source nobody listed. The shape heuristic
in `src/scripts/_lib/source_shape.ts` covers form rather than membership, and
the census sweep covers discovery; neither is made redundant by this. And
nothing here touches history — commit messages and merged PR bodies remain
recoverable by anyone with repository access, by the recorded decision of the
`whether-history-gets-rewritten` blocker.
