/**
 * Concern severity declaration (road-to-rule-coherence P0.2 / gate G5).
 *
 * Three PreToolUse concerns document themselves as advisory in PROSE —
 * `design_slop_hook.ts` says "FLAGS, NEVER A BLOCK" three times in its own
 * header — while the transport turned their WARN into a host-level deny. The
 * house correction for that class is: never infer from prose what code does not
 * enforce. So severity is declared in the manifest and the dispatcher enforces
 * the ceiling (`_is_advisory` + the downgrade in the concern loop).
 *
 * This test is the registration gate: a new concern cannot land without
 * declaring which side of the line it is on.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');

/**
 * The ONLY concerns allowed to block. Each is a real policy guard whose whole
 * purpose is refusal. Adding to this list is a security-relevant decision, so
 * the list is pinned here rather than derived.
 */
const BLOCKING_ALLOWLIST = new Set([
    'block-no-verify',
    'block-kernel-rule-writes',
    'block-config-weakening',
    // road-to-agent-behavior-conformance. Both refuse, and both refuse only
    // what a rule already declares never-autonomous — the deliberate decision
    // this allowlist exists to record:
    //
    //   block-unauthorized-git — blocks ONLY the irreversible subset
    //   non-destructive-by-default already names (npm publish, tag push,
    //   gh release create, gh pr merge) when the turn's prompt carries no
    //   authorization. Everything recoverable (commit, push, pr-create,
    //   branch) warns. The audit measured a full release chain — prod-trunk
    //   merge, tag, GitHub release, npm publish — shipped with no Go.
    //
    //   evidence-independence — blocks an evaluation prompt that pre-loads its
    //   verdict, and a second self-review dispatch in one turn. The audit found
    //   a fabricated NO-FINDINGS committed as binding gate evidence over a
    //   delta an unsteered pass then found a live critical in.
    'block-unauthorized-git',
    'evidence-independence',
]);

interface Concern {
    severity?: string;
    fail_closed?: boolean;
    script?: string;
}

function loadConcerns(): Record<string, Concern> {
    const doc = parseYaml(fs.readFileSync(MANIFEST, 'utf-8')) as { concerns?: Record<string, Concern> };
    return doc.concerns ?? {};
}

describe('hook concern severity declarations', () => {
    const concerns = loadConcerns();

    it('the manifest actually declares concerns (dead-scope guard)', () => {
        // A test that silently iterates an empty map exits green while checking
        // nothing — the repo's documented "gates that scan nothing" failure.
        expect(Object.keys(concerns).length).toBeGreaterThan(10);
    });

    it('every concern declares a severity', () => {
        const missing = Object.entries(concerns)
            .filter(([, c]) => !c.severity)
            .map(([name]) => name);
        expect(missing, `concerns missing \`severity:\` — declare advisory|blocking: ${missing.join(', ')}`).toEqual([]);
    });

    it('every severity is one of advisory|blocking', () => {
        const bad = Object.entries(concerns)
            .filter(([, c]) => c.severity !== 'advisory' && c.severity !== 'blocking')
            .map(([name, c]) => `${name}=${String(c.severity)}`);
        expect(bad).toEqual([]);
    });

    it('only allowlisted policy guards are blocking', () => {
        const blocking = Object.entries(concerns)
            .filter(([, c]) => c.severity === 'blocking')
            .map(([name]) => name)
            .sort();
        expect(blocking).toEqual([...BLOCKING_ALLOWLIST].sort());
    });

    it('the four self-declared-advisory PreToolUse concerns are advisory', () => {
        // design-slop, code-graph-nudge and rtk-wrap all say "never blocks" in
        // their own headers; block-config-weakening's baselines path does too,
        // but it keeps `blocking` severity because its non-baseline path is a
        // real refusal — its advisory branch is handled by the WARN mapping.
        for (const name of ['design-slop', 'code-graph-nudge', 'rtk-wrap']) {
            expect(concerns[name]?.severity, `${name} must be advisory`).toBe('advisory');
        }
    });

    it('injection-scan is advisory — it warns, it does not refuse', () => {
        expect(concerns['injection-scan']?.severity).toBe('advisory');
    });

    it('every fail_closed concern is blocking (a crash that must stop work)', () => {
        const inconsistent = Object.entries(concerns)
            .filter(([, c]) => c.fail_closed === true && c.severity !== 'blocking')
            .map(([name]) => name);
        expect(
            inconsistent,
            `fail_closed:true implies the concern may refuse, so severity must be blocking: ${inconsistent.join(', ')}`,
        ).toEqual([]);
    });
});
