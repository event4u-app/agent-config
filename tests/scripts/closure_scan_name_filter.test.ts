/**
 * The `unfalsifiable-verify` family's name-filtered-run case: a
 * `vitest run <target> -t <name>` clause whose target exists but carries no
 * test title containing the filter exits 0 with every test skipped — a
 * failure mode a plain exit-code read cannot see. This case stays a listing,
 * reading titles and running nothing.
 */
import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { unfalsifiableReason } from '../../src/scripts/closure_scan.js';
import type { VerifyClause } from '../../src/scripts/_lib/verify_clause.js';

function clause(command: string): VerifyClause {
    return { command, expect: { kind: 'exit', code: 0 }, raw: `verify: \`${command}\` -> 0` };
}

describe('unfalsifiableReason — name-filtered vitest run with no matching title', () => {
    let tmp: string;
    let originalCwd: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'closure-scan-name-filter-'));
        originalCwd = process.cwd();
        process.chdir(tmp);
    });

    afterEach(() => {
        process.chdir(originalCwd);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function writeTestFile(rel: string, body: string): void {
        const full = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, body, 'utf-8');
    }

    it('reports a non-null reason when the filter matches no title in the target file', () => {
        writeTestFile(
            'a.test.ts',
            "describe('rollback', () => { it('reverts the write', () => {}); });\n",
        );
        const reason = unfalsifiableReason(clause("npx vitest run a.test.ts -t 'pending reinstall'"));
        expect(reason).not.toBeNull();
        expect(reason).toContain('pending reinstall');
    });

    it('returns null when a title in the target file contains the filter', () => {
        writeTestFile(
            'b.test.ts',
            "describe('upgrade', () => { it('shows pending reinstall', () => {}); });\n",
        );
        const reason = unfalsifiableReason(clause("npx vitest run b.test.ts -t 'pending reinstall'"));
        expect(reason).toBeNull();
    });

    it('returns null for a directory target when ANY file under it matches', () => {
        writeTestFile('dir/one.test.ts', "it('unrelated case', () => {});\n");
        writeTestFile('dir/two.test.ts', "it('hits the ceiling', () => {});\n");
        const reason = unfalsifiableReason(clause('npx vitest run dir -t ceiling'));
        expect(reason).toBeNull();
    });

    it('reports a reason for a directory target when NO file under it matches', () => {
        writeTestFile('dir2/one.test.ts', "it('unrelated case', () => {});\n");
        writeTestFile('dir2/two.test.ts', "it('also unrelated', () => {});\n");
        const reason = unfalsifiableReason(clause('npx vitest run dir2 -t ceiling'));
        expect(reason).not.toBeNull();
    });

    it('returns null when the target does not exist (nothing to read)', () => {
        const reason = unfalsifiableReason(clause('npx vitest run nope.test.ts -t ceiling'));
        expect(reason).toBeNull();
    });

    it('returns null for a plain vitest run with no -t filter', () => {
        writeTestFile('c.test.ts', "it('anything', () => {});\n");
        const reason = unfalsifiableReason(clause('npx vitest run c.test.ts'));
        expect(reason).toBeNull();
    });

    it('does not fire on an unrelated command', () => {
        const reason = unfalsifiableReason(clause('./scripts-run src/scripts/lint_roadmap_complexity'));
        expect(reason).toBeNull();
    });
});
