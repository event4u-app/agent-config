/**
 * The masked-claim lint — road-to-done-claims-with-read-exit-codes 2.1.
 *
 * A `verify:` clause or an `exec:` pointer is a promise that one command's
 * exit code carries the verdict. Piped into `tail` or followed by `; echo`, the
 * code it carries is the filter's, so the promise is empty however the run
 * went. The fixture plants three such commands and one clean control.
 */
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    claimsFindings,
    main,
    roadmapFindings,
    scanRoot,
} from '../../src/scripts/lint_verify_exit_masking.js';

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'lint-verify-exit-masking');

describe('lint_verify_exit_masking', () => {
    it('finds the three masked commands in the fixture', () => {
        const findings = scanRoot(FIXTURE);
        expect(findings).toHaveLength(3);
        expect(findings.map((f) => f.masking).sort()).toEqual(['pipe', 'pipe', 'trailing']);
        expect(findings.map((f) => path.basename(f.file)).sort()).toEqual([
            'CLAIMS.md',
            'road-to-masked-clauses.md',
            'road-to-masked-clauses.md',
        ]);
    });

    it('finds nothing in the pipefail control', () => {
        const text = [
            '## Phase 1: x',
            '',
            '- [ ] **1.1 a.**',
            '      verify: `set -o pipefail; task ci | tail -3` -> 0',
        ].join('\n');
        expect(roadmapFindings('clean.md', text)).toEqual([]);
    });

    it('reads a verify clause inside a fenced block as an example, not a claim', () => {
        const text = ['```', '- [ ] **1.1 a.**', '      verify: `task ci | tail -3` -> 0', '```'].join('\n');
        expect(roadmapFindings('fenced.md', text)).toEqual([]);
    });

    it('reads exec pointers the way the claims gate does', () => {
        const text = '### claim: a\n\n- evidence: exec:vitest run x | head -5 -> 0\n';
        expect(claimsFindings('CLAIMS.md', text)).toHaveLength(1);
        expect(claimsFindings('CLAIMS.md', '### claim: a\n\n- evidence: exec:vitest run x -> 0\n')).toEqual([]);
    });

    it('exits 1 on the fixture through the CLI entry', () => {
        expect(main(['--root', FIXTURE, '--quiet'])).toBe(1);
    });
});
