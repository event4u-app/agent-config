# Enterprise & offline installation

> **Status:** experimental · contract-shaped output of
> `agents/roadmaps/road-to-distribution-maturity.md` Phase 2. Four
> documented happy-paths for environments where the public npm
> registry is not freely reachable from the developer's machine, plus
> a "no-internet developer" runbook.

## Why no Composer fallback

Re-introducing a Composer-published distribution was evaluated in the
Phase 0 council session
(`agents/council-questions/composer-fallback-feasibility.md`) and
**rejected** on three grounds:

1. **Lock-shape mismatch.** `installed.lock` is npm-shaped (flat dep
   model + npm pin in `.agent-settings.yml`). A Composer fallback
   would need either a parallel manifest (breaks the "lock is
   canonical" invariant) or a translation layer (defeats the
   "minimal" claim).
2. **Dual-distribution attack surface.** Two pipelines means two
   SBOMs, two CVE response surfaces, two signing roots. Supply-chain
   risk doubles for a fallback most operators will never use.
3. **"Minimal fallback" is an oxymoron.** Partial functionality
   shipped on a parallel pipeline confuses operators more than it
   helps — the failure mode of a half-working Composer install is
   worse than a documented npm-only path.

The supported alternative is the **four-path enterprise/offline
matrix** below, all of which keep npm as the single distribution
channel.

## Path A — pinned-npx via internal registry

For environments where the public registry is unreachable but an
internal mirror (Verdaccio, Nexus, JFrog, Sonatype) is configured:

```bash
# .npmrc at repo root or ~/.npmrc
registry=https://npm.internal.example.com/
@event4u:registry=https://npm.internal.example.com/
always-auth=true
```

Pin the consumed version in the consumer project's
`.agent-settings.yml`:

```yaml
# .agent-settings.yml
agent_config_version: "2.6.1"  # matches the version your mirror has indexed
```

`scripts/install.py` reads `agent_config_version` at install time and
records it in `~/.event4u/agent-config/installed.lock` per ADR-007.
The registry-mirror caveat: your mirror **must** index the
`@event4u/agent-config` scope before the first `npx` call — `npx`
does not transparently fall back from a private mirror to the public
registry.

> **Consumer npm-pinning ≠ release-shape pinning.** This path pins
> what the consumer's `npx` resolves to. The package's own release
> cadence (semver, tags, deprecation windows) is not pinned here per
> `.augment/rules/scope-control.md` § "no version pinning in
> roadmaps". The `agent_config_version` field is a consumer choice.

## Path B — offline cache strategy

For environments where the developer's machine has no network egress
at all but a pre-staged npm cache is delivered out-of-band:

```bash
# On a machine with internet access:
npm cache add @event4u/agent-config@2.6.1
tar -czf agent-config-npm-cache.tgz ~/.npm/_cacache

# On the offline machine:
tar -xzf agent-config-npm-cache.tgz -C ~/
npx --prefer-offline @event4u/agent-config init
```

Corepack-pinning the npm version makes the cache reproducible across
developers:

```bash
corepack enable
corepack prepare npm@10.5.0 --activate  # whatever version your cache was built with
```

`agent_config_version` in `.agent-settings.yml` must match the cached
version exactly — otherwise `npx` will try (and fail) to resolve a
different version from the registry.

## Path C — CI-safe install pattern

CI agents (GitHub Actions runners, GitLab runners, Jenkins agents
behind a corporate proxy) get a narrower happy-path:

- **Cached tarball** in the runner's artifact store
  (`actions/cache@v4` or equivalent), keyed on
  `agent_config_version`.
- **`npm install --offline`** against the cache so the runner never
  hits the registry.
- **`scripts/install.py validate`** instead of `init` — `validate`
  re-reads `installed.lock` and checks the worktree matches; `init`
  scaffolds tool directories which a CI agent typically does not
  need.
- **No global writes.** CI runners are ephemeral; the
  `~/.event4u/agent-config/installed.lock` write is harmless but the
  CI job should not rely on it persisting between runs.

## Path D — verified-offline install (`scripts/hermetic-install.sh`)

> **Naming note.** The file name is `scripts/hermetic-install.sh` for
> roadmap continuity (Phase 2 Step 5). The **semantic** per the
> Anthropic council verdict is **verified-offline install** — the
> checksum manifest is delivered via a separate channel (not bundled
> in the tarball), so the trust model is not circular. "Hermetic" is
> used in the colloquial sense (reproducible + verifiable), not the
> Bazel-strict sense.

For air-gapped or strict-supply-chain environments where (a) network
egress is fully blocked, (b) tarball integrity must be verifiable
against an external manifest, and (c) installation must be auditable
end-to-end:

```bash
# 1. Out-of-band: operator obtains
#    - agent-config-2.6.1.tgz                (from a separate channel)
#    - agent-config-2.6.1.sha256             (separate-channel manifest, GPG-signed)
#    - public.gpg                            (operator-supplied trust root)

# 2. On the target machine:
bash scripts/hermetic-install.sh \
  --tarball ./agent-config-2.6.1.tgz \
  --manifest ./agent-config-2.6.1.sha256 \
  --gpg-key ./public.gpg
```

Outcomes recorded in `~/.event4u/agent-config/installed.lock`:

```yaml
schema_version: 1
agent_config_version: "2.6.1"
installation_mode: "hermetic"             # additive field (schema_v1 + extension)
package_checksum: "sha256:<hex>"          # sha256 of the verified tarball
signature_verified: true                  # GPG verification result
installed_at: "2026-05-13T09:42:00Z"
tools:
  - claude
```

> **Platform support.** Unix-only (macOS + Linux). The script depends
> on `bash`, `sha256sum`/`shasum`, and `gpg`. Windows support is
> future scope per the Phase 2 council session (o1 verdict). Windows
> users go through Path B (offline cache) on WSL.

> **Schema cadence.** The three additional fields are written under
> `schema_version: 1` as additive keys. The bump to
> `schema_version: 2` is captured as a deferred ADR candidate in
> `agents/roadmaps/road-to-distribution-maturity.md` Notes § "Phase 2
> lock-schema extension — ADR candidate" — not opened this PR.

## No-internet developer runbook

A developer arrives on Monday with no network and finds a broken
`npx` cache (corrupted, stale, or never staged). Recovery:

1. **Confirm no-network.** `curl -m 5 https://registry.npmjs.org/ ||
   echo "offline as expected"`.
2. **Inventory what is local.**
   - `ls ~/.npm/_cacache/` — is the offline cache present?
   - `cat ~/.event4u/agent-config/installed.lock` — was a prior
     install successful?
3. **Pick a path:**
   - Cache present + lock present → **Path B**, `npx --prefer-offline`.
   - Cache present + lock missing → **Path B**, then `validate`.
   - Cache missing + tarball + manifest present → **Path D**.
   - Cache missing + nothing else → ask the IT contact to deliver
     either a fresh tarball (for Path D) or a fresh cache archive
     (for Path B). Do not attempt to bridge to the registry.
4. **Verify.** After whichever path, run `npx --prefer-offline
   @event4u/agent-config validate` and confirm exit code zero. If
   `validate` fails on a checksum or version mismatch, the cache
   or tarball is stale — re-acquire, do not edit `installed.lock`
   by hand.

> No code recovery path goes through editing `installed.lock`
> manually. The file is atomic (`os.replace`) by design — hand-edits
> bypass the schema invariant and will be overwritten on the next
> `init`/`update`.

## See also

- `agents/roadmaps/road-to-distribution-maturity.md` § Phase 2 — the
  roadmap entry that produced this document.
- `agents/council-questions/composer-fallback-feasibility.md` — the
  question that rejected the Composer path.
- `agents/council-questions/hermetic-install-scaffolding.md` — the
  question that shaped Path D.
- `docs/decisions/ADR-007-agent-discovery-scopes.md` — the lock
  manifest contract that Phase 2 extends additively.
