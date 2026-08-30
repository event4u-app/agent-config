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
    // road-to-source-silence Phase 4.2. It refuses ONE thing: the creation of a
    // NEW first-level directory under agents/tmp(.old)/ whose name is not an
    // opaque round identifier or a named working set. The three questions this
    // allowlist exists to have answered, on this concern's own terms:
    //
    //   · SCOPE. Not a settings flag and not a whole path prefix. A scratch file
    //     directly under agents/tmp/ passes, an already-existing directory
    //     passes (refusing every later write would wedge a round mid-flight
    //     WITHOUT removing the name — the fix there is a rename, which the
    //     creating call's deny message already asked for), and both acceptance
    //     predicates are read from _lib/source_shape.ts so the guard and
    //     check_no_external_sources cannot drift on what "opaque" means.
    //   · fail_closed: FALSE, unlike its three neighbours here. A detected
    //     violation refuses; a malformed envelope, an unreadable path or any
    //     crash ALLOWS. A scratch-directory guard must never be the reason an
    //     unrelated edit fails, and the guarantee is only ever about the case
    //     the guard actually decided.
    //   · WHY REFUSAL RATHER THAN A NUDGE. The directory name is the root of a
    //     measured leak chain — Phase 0 counted 190 block-tier occurrences of
    //     quoted non-opaque agents/tmp(.old)/<name>/ paths in the TRACKED tree,
    //     plus one tracked findings file named after a round. Every other gate
    //     in that programme catches the quote, after the name is already
    //     citable. This is the only point at which removing it is free.
    //
    // Kill switch: AGENT_CONFIG_ALLOW_SPEAKING_INBOX=1.
    'block-speaking-inbox-dir',
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
    // road-to-conformance-round5 Phase 3. The FIRST concern that refuses a
    // turn-END rather than a tool call, so it is the first entry here whose
    // blast radius is every session rather than one command. Three things
    // make that decision recordable rather than reckless:
    //
    //   · it is default OFF (`hooks.turn_end_gate.enabled`), so it
    //     soaks before it binds — the shape the round-6 council asked for;
    //   · `fail_closed: false`, so a crash lets the turn END. A turn-end
    //     gate that fails closed does not degrade, it wedges the session;
    //   · re-entrancy is two independent layers (`stop_hook_active`, and a
    //     marker keyed on the last USER message, never the reply), stated
    //     and tested BEFORE registration — round 6 recorded that hole as the
    //     one a soak would otherwise discover the expensive way.
    //
    // It refuses only what a rule already declares: an unfulfilled promise
    // closing a turn (verify-before-complete § turn-completion) and a reply
    // in the wrong language (language-and-tone Iron Law).
    'turn-end-gate',
    // road-to-long-horizon-execution Phase 1, and it declares `blocking`
    // because `advisory` made it INERT — the R2 review's critical finding.
    // The dispatcher enforces advisory as a ceiling (`_is_advisory` downgrades
    // EXIT_BLOCK to EXIT_WARN) and `host_semantics.emitFor` maps stop+warn to
    // exit 0, so the concern ran, logged `engage`, injected its continuation as
    // passive context, and let the turn end. Every other assertion about it
    // passed the whole time.
    //
    // The second turn-END refusal after `turn-end-gate`, so the same three
    // questions, answered on this concern's own terms rather than by analogy:
    //
    //   · SCOPE, not a settings flag. It refuses only a session that made a
    //     `sessions:claim` on a roadmap whose frontmatter declares
    //     `execution.mode: autonomous` and still carries an open phase step.
    //     A session that claimed nothing is untouched — which is most of them,
    //     and is why this needs no soak switch to be narrow. Kill switch:
    //     `AGENT_CONFIG_NO_RUN_CONTINUATION=1`.
    //   · `fail_closed: false`, so a crash lets the turn END. A continuation
    //     that fails closed does not degrade the session, it wedges it.
    //   · TERMINATION is the property that makes a blocking loop safe, and it
    //     is three independent rungs — 25 iterations, a 4 h wall clock, and a
    //     3-engagement stall — each of which now STAMPS the state instead of
    //     deleting it. Deleting was the same defect one layer down: the next
    //     Stop read a fresh budget and re-armed the loop the rungs had just
    //     ended.
    //
    // It defers to `turn-end-gate` by chain order — concerns run sequentially
    // and this one is registered last, so a quality-gate refusal for this turn
    // is on disk before this concern reads it. Quality gates outrank
    // continuation, always.
    'run-continuation',
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
