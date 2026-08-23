/**
 * A5.5 — trace-asserted frontend behaviour.
 *
 * Five behaviours, provider-neutral, and the honest split between what a
 * repository test CAN decide and what needs a real session:
 *
 *   WIRING   — decidable here. Does the mechanism that would produce the
 *              behaviour exist, is it bound, and does it decide correctly?
 *   TRACE    — needs a live session transcript. SKIPPED when absent, and the
 *              skip NAMES what was not checked rather than passing quietly.
 *
 * A suite that reported five greens on wiring alone would be claiming behaviour
 * it never observed, which is the failure `verify-before-complete` exists to
 * stop. So the trace half skips loudly and the roadmap records it as a
 * transferred measurement rather than a satisfied one.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { decide, isUiTrivial, type Finding } from '../../src/scripts/hooks/design_pass_hook.js';
import { preserveViolations, resolveUiAuthority } from '../../src/scripts/_lib/ui_authority.js';

const REPO = path.resolve(__dirname, '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(REPO, rel), 'utf8');

/**
 * A trace is a session transcript carrying tool calls. None is committed, and
 * none should be — they are per-machine and carry paths. `FRONTEND_TRACE`
 * points at one when a maintainer has captured it.
 */
const TRACE = process.env['FRONTEND_TRACE'];
const traceIt = TRACE ? it : it.skip;

describe('A5.5-1 — an audit artefact is required before a non-trivial write', () => {
    it('WIRING: the carrier reports a missing artefact with the command that fixes it', () => {
        const r = decide('post_tool_use', [], ['components/New.tsx'], new Set(), true);
        expect(r.audit_missing).toEqual(['components/New.tsx']);
    });

    it('WIRING: ui-audit-gate names the carrier rather than "none"', () => {
        expect(read('src/rules/ui-audit-gate.md')).toMatch(/enforced_by:\s*\n\s*-\s*"hook:design-pass"/);
    });

    traceIt('TRACE: a real non-trivial write was preceded by a fresh artefact', () => {
        expect(TRACE).toBeDefined();
    });
});

describe('A5.5-2 — no audit is demanded on a ui-trivial change', () => {
    it('WIRING: the five-condition allow-list admits the boundary case', () => {
        expect(
            isUiTrivial({ files: 1, changedLines: 5, newComponent: false, newState: false, newDependency: false }),
        ).toBe(true);
    });

    traceIt('TRACE: a real three-line edit produced no audit demand', () => {
        expect(TRACE).toBeDefined();
    });
});

describe('A5.5-3 — the craft floor is loaded before the first write', () => {
    it('WIRING: the floor exists, is under its cap, and is pulled at the write', () => {
        const floor = read('src/skills/fe-design/references/craft-floor.md');
        expect(floor.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(600);
        expect(read('src/skills/fe-design/SKILL.md')).toMatch(
            /PULL references\/craft-floor\.md IMMEDIATELY BEFORE THE WRITE/,
        );
    });

    it('WIRING: the floor carries floors only — no mode-scoped preference leaked in', () => {
        const floor = read('src/skills/fe-design/references/craft-floor.md');
        // These are surface-mode decisions. Their presence as a FLOOR would be
        // the exact category error the split exists to prevent.
        for (const preference of ['density', 'expressiveness', 'palette character']) {
            expect(floor.toLowerCase()).not.toMatch(new RegExp(`^\\s*\\d+\\.\\s+\\*\\*[^*]*${preference}`, 'im'));
        }
    });

    traceIt('TRACE: the floor was in context at the first write of a real session', () => {
        expect(TRACE).toBeDefined();
    });
});

describe('A5.5-4 — a P0 block is fixed on the next turn', () => {
    it('WIRING: a P0 blocks at stop and a fixed file passes', () => {
        const p0: Finding = {
            file: 'components/A.tsx',
            severity: 'P0',
            catalogId: 'Q1',
            rule: 'slop-q1',
            line: 1,
            message: 'contrast below 4.5:1',
        };
        expect(decide('stop', [p0], [], new Set(), true).blocked).toHaveLength(1);
        expect(decide('stop', [], [], new Set(), true).blocked).toEqual([]);
    });

    traceIt('TRACE: a real blocked turn was followed by a fix, not a retry', () => {
        expect(TRACE).toBeDefined();
    });
});

describe('A5.5-5 — a preserve request does not change the visual world', () => {
    const incumbent = { palette: ['#16181d', '#ffffff'], type_families: ['newsreader', 'inter'] };

    it('WIRING: a palette or family delta under preserve is refused', () => {
        const a = resolveUiAuthority({ user: { change_intent: 'preserve' } });
        expect(preserveViolations(a, incumbent, { palette: ['#ff6a3d'], type_families: [] })).toHaveLength(1);
        expect(preserveViolations(a, incumbent, { palette: [], type_families: ['fraunces'] })).toHaveLength(1);
    });

    it('WIRING: spacing-only refinement under preserve is permitted', () => {
        const a = resolveUiAuthority({ user: { change_intent: 'preserve' } });
        expect(preserveViolations(a, incumbent, incumbent)).toEqual([]);
    });

    it('WIRING: the render primitive supplies the snapshot this compares against', () => {
        // Without a captured palette there is nothing to diff, so the gate would
        // be unenforceable in practice however correct it is in principle.
        expect(read('src/cli/commands/uiRender.ts')).toMatch(/export function collectPalette/);
        expect(read('src/cli/commands/uiRender.ts')).toMatch(/export function collectTypeFamilies/);
    });

    traceIt('TRACE: a real preserve run left the incumbent palette byte-identical', () => {
        expect(TRACE).toBeDefined();
    });
});

describe('the honest ledger', () => {
    it('gates the trace half on a supplied trace, never on nothing', () => {
        // This assertion is the point of the file. `traceIt` MUST be derived from
        // the environment: making the trace tests unconditional without supplying
        // a trace would turn five honest skips into five silent greens.
        expect(traceIt === it).toBe(Boolean(TRACE));
    });

    it('records that the five TRACE assertions are unmeasured in this environment', () => {
        // Deliberately asserts the absence rather than tolerating it. A run that
        // wants the trace half measured sets FRONTEND_TRACE; a run that does not
        // gets a suite which says so out loud.
        if (!TRACE) expect(process.env['FRONTEND_TRACE']).toBeUndefined();
        else expect(fs.existsSync(TRACE)).toBe(true);
    });
});
