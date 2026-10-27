import { describe, expect, it } from 'vitest';

import { splitLineSuffix, wellFormedExhibit } from '../../src/scripts/_lib/finding_exhibits.js';
import { findingId, parseFindings } from '../../src/scripts/self_review_gate.js';

const base = { kind: 'correctness' as const, title: 'a real finding' };

describe('findingId — stable across line moves', () => {
    it('two findings that differ only in the line suffix share one id', () => {
        expect(findingId({ ...base, file: 'src/x.ts:12' })).toBe(findingId({ ...base, file: 'src/x.ts:40-44' }));
    });
    it('a finding without a suffix keeps its old id', () => {
        expect(findingId({ ...base, file: 'src/x.ts' })).toBe(findingId({ ...base, file: 'src/x.ts:7' }));
    });
    it('splitLineSuffix leaves a plain path alone', () => {
        expect(splitLineSuffix('src/x.ts')).toEqual({ path: 'src/x.ts' });
        expect(splitLineSuffix('src/x.ts:9-12')).toEqual({ path: 'src/x.ts', line: 9 });
    });
});

describe('parseFindings — keeps exhibits and lifts the line', () => {
    const reply = JSON.stringify({
        findings: [
            {
                severity: 'high',
                kind: 'correctness',
                title: 't',
                file: 'src/x.ts:42',
                exhibits: [
                    { type: 'presence', path: 'src/x.ts', line: 42, quote: 'const a = 1;', commit: 'ac6c60802a' },
                    { type: 'presence', path: 'src/x.ts' },
                ],
            },
        ],
    });
    it('keeps the good exhibit, drops the malformed one, keeps the finding', () => {
        const [f] = parseFindings(reply);
        expect(f?.file).toBe('src/x.ts');
        expect(f?.line).toBe(42);
        expect(f?.exhibits).toHaveLength(1);
        expect(f?.exhibits?.[0]?.type).toBe('presence');
    });
    it('wellFormedExhibit rejects a pair with one bad leg', () => {
        expect(wellFormedExhibit({ type: 'pair', legs: [{ type: 'presence' }, { type: 'presence' }] })).toBeNull();
    });
});
