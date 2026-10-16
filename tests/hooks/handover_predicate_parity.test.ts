import { describe, expect, it } from 'vitest';

import { HANDOVER_TRIGGERS, handoverTouched } from '../../src/scripts/hooks/design_pass_hook.js';
import { isHandoverPath } from '../../src/scripts/hooks/source_first_gate_hook.js';
import { isArtifactRead } from '../../src/scripts/hooks/ui_route_nudge_hook.js';

/**
 * One example path per shipped trigger, derived from the list itself, so a
 * trigger added to the list is probed against every carrier without editing
 * this file. Repo-relative and lower-case: the shape all three carriers see.
 */
function examplesFor(trigger: (typeof HANDOVER_TRIGGERS)[number]): string[] {
    if ('file_pattern' in trigger) {
        const pat = String(trigger.file_pattern);
        const tail = pat.startsWith('*') ? pat.slice(1) : pat;
        return [`todo${tail}`, `artifacts/nested/x${tail}`];
    }
    if ('path_prefix' in trigger) {
        return [`${String(trigger.path_prefix)}tokens.json`];
    }
    return [];
}

const NEAR_MISSES = [
    'src/app.ts',
    'index.html',
    'design-system/tokens.json',
    'src/design.htm',
    'sync/config.json',
    'notes/dc.html.md',
];

function verdicts(file: string): [boolean, boolean, boolean] {
    return [isHandoverPath(file), isArtifactRead({ file, isWrite: false }), handoverTouched([file])];
}

describe('handover predicates — one path set', () => {
    it('control: isHandoverPath, isArtifactRead and HANDOVER_TRIGGERS accept one path set', () => {
        const accepted = HANDOVER_TRIGGERS.flatMap(examplesFor);
        expect(accepted.length).toBeGreaterThanOrEqual(HANDOVER_TRIGGERS.length);
        const disagreements = accepted.filter((f) => verdicts(f).some((v) => !v));
        expect(disagreements).toEqual([]);
    });

    it('rejects the near-misses on every carrier', () => {
        const leaks = NEAR_MISSES.filter((f) => verdicts(f).some(Boolean));
        expect(leaks).toEqual([]);
    });
});
