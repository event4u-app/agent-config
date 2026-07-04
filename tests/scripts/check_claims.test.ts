/**
 * Mechanism tests for `src/scripts/check_claims.ts` (Claims-Ledger gate, B1).
 *
 * The acceptance test of the mechanism itself (roadmap B1.4): a deliberately
 * unbacked / dangling / unregistered markered claim MUST turn CI red (exit 2),
 * and a fully-bound claim MUST pass (exit 0). The script resolves its REPO from
 * `parents[2]` of its own location, so each fixture copies the one script into
 * `<work>/src/scripts/` and runs it inside a throwaway tree via tsx.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
const SCRIPT_SRC = path.join(REPO_ROOT, 'src', 'scripts', 'check_claims.ts');

let work: string;

function run(): { code: number; stdout: string; stderr: string } {
    const r = spawnSync(TSX, [path.join(work, 'src', 'scripts', 'check_claims.ts')], {
        cwd: work,
        encoding: 'utf8',
    });
    return { code: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function write(rel: string, body: string): void {
    const abs = path.join(work, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
}

beforeEach(() => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-test-'));
    fs.mkdirSync(path.join(work, 'src', 'scripts'), { recursive: true });
    fs.copyFileSync(SCRIPT_SRC, path.join(work, 'src', 'scripts', 'check_claims.ts'));
    write('docs/evidence.md', 'This file contains the ANCHOR string.\n');
});

afterEach(() => {
    fs.rmSync(work, { recursive: true, force: true });
});

const backedLedger = [
    '# Claims Ledger',
    '',
    '### claim: good',
    '- claim: A bound claim.',
    '- kind: qual',
    '- evidence: docs/evidence.md#ANCHOR',
    '- status: backed',
    '- last_verified: 2026-07-04',
    '',
].join('\n');

describe('check_claims — mechanism', () => {
    it('clean: a markered claim bound to a backed, resolving entry → exit 0', () => {
        write('docs/CLAIMS.md', backedLedger);
        write('README.md', 'We do a good thing.<!-- claim:good -->\n');
        const r = run();
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('1 markered claim');
    });

    it('unbacked: markered claim whose ledger entry is status:unbacked → exit 2', () => {
        write(
            'docs/CLAIMS.md',
            ['# Claims Ledger', '', '### claim: wip', '- claim: Not yet proven.', '- kind: quant', '- evidence: TODO', '- status: unbacked', '- last_verified:', ''].join('\n'),
        );
        write('README.md', 'A shaky claim.<!-- claim:wip -->\n');
        const r = run();
        expect(r.code).toBe(2);
        expect(r.stderr).toContain("not 'backed'");
    });

    it('missing entry: markered claim with no ledger entry → exit 2', () => {
        write('docs/CLAIMS.md', backedLedger);
        write('README.md', 'An orphan claim.<!-- claim:ghost -->\n');
        const r = run();
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('no ledger entry');
    });

    it('dangling: backed entry whose evidence path does not exist → exit 2', () => {
        write(
            'docs/CLAIMS.md',
            ['# Claims Ledger', '', '### claim: rotten', '- claim: Points nowhere.', '- kind: qual', '- evidence: docs/gone.md', '- status: backed', '- last_verified: 2026-07-04', ''].join('\n'),
        );
        write('README.md', 'no markers here\n');
        const r = run();
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('dangling evidence');
    });

    it('documentation is exempt: a marker shown in an inline-code span is not a live claim', () => {
        write('docs/CLAIMS.md', backedLedger);
        write('docs/guide.md', 'To bind a claim, add `<!-- claim:example -->` to the sentence.\n');
        write('README.md', 'We do a good thing.<!-- claim:good -->\n');
        const r = run();
        expect(r.code).toBe(0);
    });
});
