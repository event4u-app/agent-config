import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { REFERENCE, refresh, renderBlock } from '../../src/scripts/generate_git_convention_grammar.js';
import { REGISTRY } from '../../src/scripts/check_generator_sync.js';
import { TICKET_GRAMMAR } from '../../src/scripts/_lib/git_convention_grammar.js';
import { MIN_N, SHARE_BAR, SMALL_TEAM_SHARE_BAR, pct } from '../../src/scripts/_lib/git_convention_measure.js';

const ROOT = path.resolve(__dirname, '..', '..');
const committed = (): string => fs.readFileSync(path.join(ROOT, REFERENCE), 'utf8');

describe('the commit-subject reference grammar block', () => {
    it('is the block the module renders', () => {
        const r = refresh(committed());
        expect(r.ok).toBe(true);
        expect(r.ok ? r.text : '').toBe(committed());
        expect(renderBlock()).toContain(TICKET_GRAMMAR);
    });

    it('renders the measurement bar from the constants git:convention measure applies', () => {
        const bar = renderBlock().split('\n').find((l) => l.startsWith('measure bar')) ?? '';
        expect(bar).toContain(`n >= ${MIN_N}`);
        expect(bar).toContain(pct(SHARE_BAR));
        expect(bar).toContain(pct(SMALL_TEAM_SHARE_BAR));
    });

    it('reds when the block is edited by hand', () => {
        const doctored = committed().replace(TICKET_GRAMMAR, '[A-Z]{2}-[0-9]+');
        const r = refresh(doctored);
        expect(r.ok ? r.text : '').not.toBe(doctored);
    });

    it('refuses a page without its markers', () => {
        expect(refresh('# no markers\n').ok).toBe(false);
    });

    it('is registered in check_generator_sync over the module, the generator and the page', () => {
        const triple = REGISTRY.find((t) => t.output === REFERENCE);
        expect(triple).toBeDefined();
        const s = triple?.sourcesOf(ROOT);
        expect(s?.ok ? s.sources.map((m) => m.value) : []).toEqual(
            expect.arrayContaining(['src/scripts/_lib/git_convention_grammar.ts', 'src/scripts/_lib/git_convention_measure.ts', 'src/scripts/generate_git_convention_grammar.ts', REFERENCE]),
        );
    });
});
