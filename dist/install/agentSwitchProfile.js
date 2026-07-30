/**
 * Detect whether AC is currently running under an agent-switch (AS)
 * profile (`road-to-reciprocal-ecosystem.md` Phase 2 — correctness
 * work, not the Phase 1 promotion card).
 *
 * Pure and injectable: reads only the supplied environment map, no
 * filesystem I/O. Detection is deliberately topology-free — it never
 * needs to understand AS's on-disk share model (that lives in
 * `sharedWriteCheck.ts`, which DOES touch disk via `lstat`).
 *
 * AS root resolution mirrors `agent-switch/src/profiles.ts:11`:
 * `AGENT_SWITCH_HOME` env override, else `~/.agent-switch`. Profile
 * config dirs live at `<ROOT>/<provider>/<name>/config` (profiles.ts
 * :143-145). Provider env vars mirror `agent-switch/src/providers.ts`:
 * claude → `CLAUDE_CONFIG_DIR`, codex → `CODEX_HOME`. `HOME`
 * (antigravity's provider var) is deliberately NOT checked here — it
 * is set on every process, so treating it as an AS signal would
 * false-positive constantly; antigravity profile detection is left to
 * a future, more specific probe.
 */
import { homedir } from 'node:os';
import * as path from 'node:path';
const INACTIVE = { active: false, provider: null, profile: null };
/** Provider env vars checked, in priority order (claude wins on a tie). */
const PROVIDER_ENV_VARS = ['CLAUDE_CONFIG_DIR', 'CODEX_HOME'];
/** Expand a leading `~` the way a shell would, for env values set programmatically. */
function expandTilde(p) {
    if (p === '~')
        return homedir();
    if (p.startsWith('~/') || (process.platform === 'win32' && p.startsWith('~\\'))) {
        return path.join(homedir(), p.slice(2));
    }
    return p;
}
function normalize(p) {
    return path.resolve(expandTilde(p));
}
function nonEmpty(v) {
    return typeof v === 'string' && v.trim() !== '';
}
/**
 * Find the first provider env var whose (normalized) value lies
 * inside the AS root, and return the root + the path segments below
 * it. Shared by `detectAgentSwitchProfile` and `resolveAgentSwitchRoot`
 * so both stay in lockstep with a single matching rule.
 */
function resolveMatch(env) {
    const overrideRaw = env['AGENT_SWITCH_HOME'];
    const overrideRoot = nonEmpty(overrideRaw) ? normalize(overrideRaw) : null;
    for (const varName of PROVIDER_ENV_VARS) {
        const raw = env[varName];
        if (!nonEmpty(raw))
            continue;
        const candidate = normalize(raw);
        let root = null;
        if (overrideRoot !== null) {
            if (candidate === overrideRoot || candidate.startsWith(overrideRoot + path.sep)) {
                root = overrideRoot;
            }
        }
        else {
            const bareMarker = `${path.sep}.agent-switch`;
            const nestedMarker = `${bareMarker}${path.sep}`;
            if (candidate.endsWith(bareMarker)) {
                root = candidate;
            }
            else {
                const idx = candidate.indexOf(nestedMarker);
                if (idx !== -1)
                    root = candidate.slice(0, idx + bareMarker.length);
            }
        }
        if (root === null)
            continue;
        const rest = candidate === root ? '' : candidate.slice(root.length + 1);
        const afterRoot = rest === '' ? [] : rest.split(path.sep).filter((s) => s.length > 0);
        return { root, afterRoot };
    }
    return null;
}
/**
 * Detect the active AS profile (if any) from the current environment.
 *
 * - Not inside `.agent-switch` at all → `{ active: false, ... }`.
 * - Inside the AS root, but the env var points AT the root itself
 *   (no `<provider>/<profile>` segments below it) → treated as
 *   inactive; an env var pointing at the bare root is not a profile
 *   directory.
 * - Inside the AS root with only one segment below it (a provider dir
 *   with no profile name) → active, but unparseable (`provider`/
 *   `profile` both `null`).
 * - Inside the AS root with `<provider>/<profile>/...` below it →
 *   active, with `provider`/`profile` parsed from the first two
 *   segments.
 */
export function detectAgentSwitchProfile(env = process.env) {
    const match = resolveMatch(env);
    if (match === null)
        return INACTIVE;
    if (match.afterRoot.length === 0)
        return INACTIVE;
    if (match.afterRoot.length < 2)
        return { active: true, provider: null, profile: null };
    // `length >= 2` guaranteed above — `??` only satisfies noUncheckedIndexedAccess.
    return { active: true, provider: match.afterRoot[0] ?? null, profile: match.afterRoot[1] ?? null };
}
/**
 * Resolve the AS root directory implied by the environment (the same
 * matching rule `detectAgentSwitchProfile` uses), for callers that
 * need a boundary to stop an upward filesystem walk at — see
 * `sharedWriteCheck.ts`. Returns `null` when no provider env var
 * resolves inside an AS tree.
 */
export function resolveAgentSwitchRoot(env = process.env) {
    return resolveMatch(env)?.root ?? null;
}
//# sourceMappingURL=agentSwitchProfile.js.map