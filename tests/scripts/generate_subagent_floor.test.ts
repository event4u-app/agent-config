// The generated subagent floor carries the question cascade, sourced from the ownership data rather
// than from a hand-copied list.
import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { OWNER_LOCKED_CLASSES, OWNER_MONEY_ROW } from '../../src/scripts/ai_council/ownership_classes.js';
import {
    classes_resolved_by,
    render_floor,
    render_routing,
    render_who_answers,
    WHO_ANSWERS_FILES,
} from '../../src/scripts/generate_subagent_floor.js';

/** The numbered floor line that starts with `6.`, unwrapped to one line. */
function cascadeLine(floor: string): string {
    const lines = floor.split('\n');
    const start = lines.findIndex((l) => /^6\. /.test(l));
    if (start === -1) return '';
    const out: string[] = [];
    for (let i = start; i < lines.length; i += 1) {
        const l = lines[i] as string;
        if (i > start && !/^ {3}\S/.test(l)) break;
        out.push(l.trim());
    }
    return out.join(' ');
}

describe('generate_subagent_floor — the question cascade', () => {
    it('carries a sixth line', () => {
        expect(cascadeLine(render_floor())).not.toBe('');
    });

    it('decides a dominant option, returns a trade-off with its class, sends only owner classes up', () => {
        const line = cascadeLine(render_floor());
        expect(line).toMatch(/one option clearly dominates/i);
        expect(line).toContain('NEEDS_CONTEXT');
        expect(line).toContain('ownership_class');
        expect(line).toMatch(/only these reach the owner/i);
    });

    it('names every owner-locked class and the money row, read from the data', () => {
        const line = cascadeLine(render_floor());
        for (const cls of OWNER_LOCKED_CLASSES) expect(line).toContain(cls);
        expect(line).toContain(OWNER_MONEY_ROW);
    });

    it('changes when the owner set changes', () => {
        const line = cascadeLine(render_floor({ ownerClasses: new Set(['fixture-owned']) }));
        expect(line).toContain('fixture-owned');
        for (const cls of OWNER_LOCKED_CLASSES) expect(line).not.toContain(cls);
    });
});

describe('generate_subagent_floor — routing and the who-answers section', () => {
    it('the routing list sends an owner class to one end-of-run ask and never mid-run', () => {
        const r = render_routing();
        for (const cls of OWNER_LOCKED_CLASSES) expect(r).toContain(cls);
        expect(r).toMatch(/ONE ask at the end of the run/);
        expect(r).toMatch(/Never forward a worker's question to the user mid-run/);
    });

    it('the who-answers section names three rungs and the owner set from the data', () => {
        const w = render_who_answers();
        expect(w).toContain('## Who answers a question');
        expect(w).toMatch(/1\. \*\*Agent\*\*/);
        expect(w).toMatch(/2\. \*\*Council\*\*/);
        expect(w).toMatch(/3\. \*\*Owner\*\*/);
        for (const cls of OWNER_LOCKED_CLASSES) expect(w).toContain(cls);
        expect(w).toContain(OWNER_MONEY_ROW);
        for (const cls of classes_resolved_by('council')) expect(w).toContain(cls);
    });

    it('the mechanics context carries the current span', () => {
        for (const f of WHO_ANSWERS_FILES) {
            expect(fs.readFileSync(f, 'utf-8')).toContain(render_who_answers());
        }
    });
});

describe('generate_subagent_floor — an owner decision names its source', () => {
    const unwrap = (t: string): string => t.replace(/\n {3}/g, ' ').replace(/\s+/g, ' ');

    it('every generated floor carries the provenance line', () => {
        const floor = unwrap(render_floor());
        expect(floor).toMatch(/An owner decision you cite names its source/);
        expect(floor).toMatch(/Without a source it is your proposal, and you say so/);
    });

    it('the who-answers section carries it too', () => {
        expect(render_who_answers()).toMatch(/An owner decision you cite names its source/);
    });
});
