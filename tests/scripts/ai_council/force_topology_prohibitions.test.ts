// Pins `road-to-inbox-harvest-2026-08-e-council-topology-evidence` step 12.3:
// "A force-topology debug control may exist but cannot override user-required
// decisions, destructive authorization, spend authorization, the Hard Floor, or
// turn same-provider subagents into an external council."
//
// The step's verify line asks for ONE TEST PER PROHIBITION. Written naively that
// is a check over a population of zero: grepped 2026-09-01, no force-topology
// control exists anywhere in `src/` — `force.topology`, `forceTopology` and
// `force_topology` all return zero hits, and `council_cli.ts` contains the
// substring `topology` not at all. A suite that exercised such a control would
// therefore be exercising nothing, and this repository's own standard is that a
// check over an empty population discharges no condition.
//
// So each prohibition is written as an ABSENCE ASSERTION with a live anchor: the
// control does not exist (P0), and for each named authority the gate that
// implements it is pinned in place and shown not to be reachable from a topology
// input. The day someone adds a force-topology control, P0 goes red and the
// author is sent to the four gates below before the control can ship.
//
// HONEST SCOPE, and it is narrower than the step's sentence. These are
// naming-and-shape gates over source text plus two live imports. They cannot
// prove that a future control fails to override an authority — only that no
// control exists today and that each authority gate is still where the step
// assumed it was. That is why 12.3 closes as a guarded baseline and not as a
// discharged claim. Per this repo's gate-authoring discipline the DENIAL is
// tested explicitly (P0b), so a zero in P0a means something.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { LOCKED_IMPACT_CLASSES } from '../../../src/scripts/ai_council/necessity.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');

/** The council command surface: the option tables plus the help text they print. */
const SURFACE = [
    path.join(REPO_ROOT, 'src', 'scripts', 'council_cli.ts'),
    path.join(REPO_ROOT, 'src', 'scripts', 'ai_council', 'cli_help.ts'),
];

function read(...parts: string[]): string {
    return readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');
}

function surfaceText(): string {
    return SURFACE.map((f) => readFileSync(f, 'utf8')).join('\n');
}

/**
 * Fires on a force-topology control in any of the three spellings the tree
 * would plausibly use. One exported-shaped constant so the polarity test below
 * scores the same detector the claim test uses — two regexes would drift.
 */
const FORCE_TOPOLOGY_RE = /force[-_ ]?topolog|forceTopolog|--topology\b/i;

/** A synthetic control, used only to prove the detector is not inert. */
const SABOTAGE_LINE =
    "    { flag: '--topology', takesValue: true, choices: ['star', 'mesh'] },";

describe('12.3 P0 — no force-topology control exists, and the detector can see one', () => {
    it('P0a — the council command surface declares no force-topology control', () => {
        expect(FORCE_TOPOLOGY_RE.test(surfaceText())).toBe(false);
    });

    it('P0b — polarity: the same detector fires on a planted control', () => {
        expect(FORCE_TOPOLOGY_RE.test(`${surfaceText()}\n${SABOTAGE_LINE}`)).toBe(true);
    });

    it('P0c — non-vacuity: the surface files are non-empty and really are the CLI', () => {
        for (const f of SURFACE) {
            const t = readFileSync(f, 'utf8');
            expect(t.length).toBeGreaterThan(500);
        }
        expect(surfaceText()).toContain('--confirm');
    });
});

describe('12.3 P1 — user-required decisions stay locked to the user', () => {
    it('the locked classes are exactly high_impact and user_required', () => {
        expect([...LOCKED_IMPACT_CLASSES].sort()).toEqual(['high_impact', 'user_required']);
    });

    it('the lock is refused at the config schema, not at a caller a flag could skip', () => {
        // The refusal is two branches in `_build_decision_resolution`: a locked
        // class may not be remapped away from `user`, and `dispatch` is not
        // configurable for one. Both are asserted against the code rather than
        // against a comment — an earlier draft of this test matched the prose at
        // `necessity.ts:553`, which names the file `config.py` and would have
        // gone green on a stale sentence.
        const cfg = read('src', 'scripts', 'ai_council', 'config.ts');
        expect(cfg).toMatch(/const _LOCKED_IMPACT_CLASSES: ReadonlySet<string>/);
        expect(cfg).toMatch(/_LOCKED_IMPACT_CLASSES\.has\(cls\) && mode !== 'user'/);
        expect(cfg).toMatch(/_LOCKED_IMPACT_CLASSES\.has\(cls\) && 'dispatch' in entry_raw/);
        // And the runtime router agrees with the schema.
        expect(read('src', 'scripts', 'ai_council', 'necessity.ts')).toMatch(
            /LOCKED_IMPACT_CLASSES\.has\(verdict\.impact_class\)/,
        );
        // Neither file can be reached by a topology input, because neither
        // mentions one.
        expect(FORCE_TOPOLOGY_RE.test(cfg)).toBe(false);
    });
});

describe('12.3 P2 — spend authorization stays behind --confirm', () => {
    const cli = () => read('src', 'scripts', 'council_cli.ts');

    it('the --confirm gate returns before any seat is contacted', () => {
        expect(cli()).toMatch(/if \(!args\.confirm\)/);
        expect(cli()).toMatch(/estimate only\. Re-run with --confirm/);
    });

    it('no topology vocabulary appears anywhere in the spending command file', () => {
        // Stronger than "no --topology flag": the whole word is absent, so a
        // topology value cannot be threaded past the gate under another name
        // without this going red.
        expect(/topolog/i.test(cli())).toBe(false);
    });
});

describe('12.3 P3 — destructive authorization and P4 — the Hard Floor', () => {
    it('neither authority is parameterised by anything topology-shaped', () => {
        // The council surface is the only place a force-topology control could
        // live, and it names neither authority — so there is no path from a
        // topology input to either gate. Pinned as a shape, because the
        // authorities themselves live in always-loaded rules, not in this code.
        const s = surfaceText();
        expect(/topolog/i.test(s)).toBe(false);
    });

    it('the council command cannot self-authorize: the spend doors are pinned at three', () => {
        const cli = read('src', 'scripts', 'council_cli.ts');
        // Measured 2026-09-01: three `if (!args.confirm)` gates, at :2490, :2542
        // and :3080 — one per spending subcommand, not one global gate. Pinned
        // as a COUNT rather than asserted as a single door, because the first
        // draft of this test assumed one and was wrong; a fourth door is the
        // event worth a human look, and it turns this red.
        expect(cli.match(/if \(!args\.confirm\)/g)?.length).toBe(3);
        // No door is reachable from a topology input, because the file has none.
        expect(/topolog/i.test(cli)).toBe(false);
    });
});

describe('12.3 P5 — same-provider subagents are not an external council', () => {
    it('the subagent orchestration gate never constructs a council member', () => {
        const gate = read('src', 'scripts', '_lib', 'orchestration_gate.ts');
        expect(gate).toContain('host_subagent_spawn');
        // The distinction the step protects: a host subagent lane must not
        // import, name, or fabricate a council seat.
        expect(/MemberConfig|ai_council\/config/.test(gate)).toBe(false);
        expect(FORCE_TOPOLOGY_RE.test(gate)).toBe(false);
    });

    it('council membership is resolved from the council config alone', () => {
        expect(read('src', 'scripts', 'ai_council', 'config.ts')).toMatch(
            /export interface MemberConfig/,
        );
    });
});
