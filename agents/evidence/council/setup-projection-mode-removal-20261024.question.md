<!-- evidence-type: analysis -->

# Step 4.7 of `road-to-a-setup-that-decides-itself` — removing `projection.mode`: who decides, and in which release class

Repository `event4u/agent-config`. Answer briefly; do not restate the question.

## The step

> **4.7 `projection.mode` last.** Removed only after the skills roadmap's completeness question is answered; on hosts with a listing lever, scoping moves to visibility; elsewhere the active profile decides, reversing the template's "never inferred from profile.id" deliberately in the 4.1 ADR.

Its precondition is now met: ADR-289 point 4 ("not removed before the reach mechanism and its tests exist") holds, the second-host reachability blocker is resolved (council 2/2, 2026-10-20), and `agent-config doctor --check skill-reach` reports `unreachable 0` on claude-code and codex. The owner's 2026-10-12 directive ordered the lean settings removed "only if the package does not get worse"; ADR-293 (Phase 4) removed three other keys in the semver-major 17.0.0, its release class decided by the council.

## What `projection.mode` does today

- Values `scoped` | `legacy-all` (a leftover `tiered` reads as `legacy-all`). Template default `scoped`; schema default `legacy-all`.
- At a GLOBAL install (`src/scripts/install.ts` `_resolve_scoped_projection`): an existing global settings file is authoritative — a missing key, an unreadable file or any non-`scoped` value resolves to `legacy-all` (full skill/command surface); only a machine with NO global settings file falls through to the template's `scoped`, which prunes skills/commands whose `packs:` miss the active profile's packs.
- `agent-config use --profile=legacy-all` (`src/scripts/profile_use.ts`) writes `projection.mode: legacy-all` as the documented "full surface" escape hatch.

So today: fresh installs are pruned by profile; upgraded installs without the key, and anyone who ran `use --profile=legacy-all`, get everything.

## What the step would change

The key goes (tombstone + one-window read). On claude-code (a listing lever exists: `skillOverrides` name-only) every skill would be installed and scoping becomes visibility — fresh installs gain skills they do not have today. On hosts without that lever the active profile prunes — upgraded and `legacy-all` installs lose skills they have today. The `legacy-all` profile command loses its meaning or needs a non-settings replacement.

## Policy that binds the release class

`BREAKING_CHANGES.md`: a settings key may leave in a minor only when no consumer can rely on it — default-neutral and derivable, proven by a named test; otherwise only in a major. ADR-300 (owner, 2026-10-24): a release is a major when a commit declares `Consumer-Impact: action` or touches a major-listed surface; a key removed with an **automatic** migration is not a major; command removal is on the major list.

## What to answer

1. Is this removal default-neutral in the policy's sense (yes/no, one sentence)?
2. Release class: major, or minor under ADR-300's automatic-migration exception — and what migration would that require?
3. **Routing:** council-decidable, or owner-reserved (owner-reserved covers: removing or weakening a public compatibility commitment; changing a declared outcome; anything not boundable from evidence)? One sentence.
4. If owner-reserved: the question the owner should be asked, as numbered options.

End with exactly one line: `ROUTING: council-decidable` or `ROUTING: owner-reserved`.
