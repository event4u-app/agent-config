/**
 * Mechanism tests for the retired-phrasings reach in `src/scripts/check_claims.ts`
 * (road-to-retired-claims-stay-retired, Phases 1 and 2).
 *
 * The defect these pin: retiring a claim in the ledger was a bookkeeping act
 * with no reach. `check_claims` validated a `withdrawn` row's own shape and
 * `lint_positioning` validated three publish surfaces against each other, and
 * neither read the other's input — so a row could go `withdrawn` while its
 * exact wording kept shipping on the npm page.
 *
 * The harness is the one `check_claims.test.ts` uses: the script resolves REPO
 * from `parents[2]` of its own location, so each fixture copies it into a
 * throwaway tree and runs it there under tsx.
 *
 * THE HISTORICAL STRING IS NOT SYNTHETIC. `zero runtime daemon` is the literal
 * wording `package.json.description`, `.github/about.yml` and the README H1
 * carried while `claim:no-runtime-daemon` was already `withdrawn` — recovered
 * from `git log -S"runtime daemon"` (d39eb5f32, 531327d46). A gate never seen
 * red on the real instance has unknown sensitivity, so it is what the red test
 * below publishes.
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
const LIB_SRCS = ['exec_evidence.ts', 'scan_scope.ts', 'gate_baseline.ts', 'gate_self_test.ts'].map((n) =>
    path.join(REPO_ROOT, 'src', 'scripts', '_lib', n),
);

/** The literal wording that shipped while the claim was already withdrawn. */
const HISTORICAL = 'zero runtime daemon';

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

/** A ledger holding one withdrawn entry, optionally with a phrasings field. */
function ledger(phrasingsLine: string | null): string {
    return [
        '# Claims Ledger',
        '',
        '### claim: no-runtime-daemon',
        '- claim: The whole layer is compiled into host agents with zero runtime daemon.',
        '- kind: qual',
        '- evidence: docs/evidence.md#ANCHOR',
        '- status: withdrawn',
        '- last_verified: 2026-07-04',
        '- retired_by: ADR-249',
        ...(phrasingsLine === null ? [] : [phrasingsLine]),
        '',
    ].join('\n');
}

beforeEach(() => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-retired-'));
    fs.mkdirSync(path.join(work, 'src', 'scripts', '_lib'), { recursive: true });
    fs.copyFileSync(SCRIPT_SRC, path.join(work, 'src', 'scripts', 'check_claims.ts'));
    for (const src of LIB_SRCS) {
        fs.copyFileSync(src, path.join(work, 'src', 'scripts', '_lib', path.basename(src)));
    }
    write('docs/evidence.md', 'This file contains the ANCHOR string.\n');
});

afterEach(() => {
    fs.rmSync(work, { recursive: true, force: true });
});

describe('check_claims — a retired phrasing may not ship (Phase 2)', () => {
    it('RED on the real historical wording in package.json.description', () => {
        write('docs/CLAIMS.md', ledger(`- retires_phrasings: ${HISTORICAL}`));
        write(
            'package.json',
            JSON.stringify(
                {
                    name: '@event4u/agent-config',
                    description: `Governed skills, rules and commands — every claim machine-checked, including "${HISTORICAL}".`,
                },
                null,
                4,
            ) + '\n',
        );
        const r = run();
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('publishes the retired phrasing');
        expect(r.stderr).toContain(HISTORICAL);
        expect(r.stderr).toContain('package.json');
    });

    it('GREEN on the same fixture once the wording is the current one', () => {
        write('docs/CLAIMS.md', ledger(`- retires_phrasings: ${HISTORICAL}`));
        write(
            'package.json',
            JSON.stringify(
                {
                    name: '@event4u/agent-config',
                    description:
                        'Governed skills, rules and commands — every claim machine-checked, including the counts in these badges.',
                },
                null,
                4,
            ) + '\n',
        );
        expect(run().code).toBe(0);
    });

    it('RED on .github/about.yml too — the set is the surfaces, not one file', () => {
        write('docs/CLAIMS.md', ledger(`- retires_phrasings: ${HISTORICAL}`));
        write('.github/about.yml', `description: "Every claim machine-checked, including \\"${HISTORICAL}\\"."\n`);
        const r = run();
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('.github/about.yml');
    });

    it('is case-insensitive — capitalising the wording does not clear it', () => {
        write('docs/CLAIMS.md', ledger(`- retires_phrasings: ${HISTORICAL}`));
        write('README.md', '# Agent Config — Zero Runtime Daemon\n');
        expect(run().code).toBe(2);
    });

    it('does not fire on docs/ — shipped is not the same as rendered as the pitch', () => {
        write('docs/CLAIMS.md', ledger(`- retires_phrasings: ${HISTORICAL}`));
        write('docs/history.md', `We used to claim ${HISTORICAL}, and no longer do.\n`);
        // README.md is present and CLEAN, so the watch-list resolves and the
        // scan really runs — without it this fixture would prove only that a
        // phantom watch-list fires, which is a different test.
        write('README.md', '# Agent Config\n\nGoverned skills, rules and commands.\n');
        expect(run().code).toBe(0);
    });

    it('a needle with no publish surface left to watch is a finding, not silence', () => {
        write('docs/CLAIMS.md', ledger(`- retires_phrasings: ${HISTORICAL}`));
        const r = run();
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('watching phantoms');
    });
});

describe('check_claims — retires_phrasings shape (Phase 1)', () => {
    it('accepts a closed entry WITHOUT the field (schema-optional)', () => {
        write('docs/CLAIMS.md', ledger(null));
        expect(run().code).toBe(0);
    });

    it('rejects a present-but-empty field', () => {
        write('docs/CLAIMS.md', ledger('- retires_phrasings:'));
        const r = run();
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('names no wording');
    });

    it('rejects a needle shorter than the minimum — it would match ordinary prose', () => {
        write('docs/CLAIMS.md', ledger('- retires_phrasings: daemon'));
        const r = run();
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('matches ordinary prose');
    });

    it('rejects the never-published sentinel with no stated reason', () => {
        write('docs/CLAIMS.md', ledger('- retires_phrasings: never-published'));
        const r = run();
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('states no reason');
    });

    it('accepts the never-published sentinel WITH a reason, and scans nothing for it', () => {
        write(
            'docs/CLAIMS.md',
            ledger(
                '- retires_phrasings: never-published — verified by `git log -S` over every publish surface: zero commits.',
            ),
        );
        write('README.md', `An unrelated page mentioning ${HISTORICAL} freely.\n`);
        expect(run().code).toBe(0);
    });

    it('rejects the field on a LIVE entry — a backed claim has retired nothing', () => {
        write(
            'docs/CLAIMS.md',
            [
                '# Claims Ledger',
                '',
                '### claim: alive',
                '- claim: A live claim.',
                '- kind: qual',
                '- evidence: docs/evidence.md#ANCHOR',
                '- status: backed',
                '- last_verified: 2026-07-04',
                `- retires_phrasings: ${HISTORICAL}`,
                '',
            ].join('\n'),
        );
        const r = run();
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('only meaningful on a closed entry');
    });

    it('splits a multi-phrasing list on `|` and fires on the SECOND one', () => {
        write('docs/CLAIMS.md', ledger(`- retires_phrasings: ${HISTORICAL} | with no resident process`));
        write('README.md', 'The suite runs with no resident process.\n');
        const r = run();
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('with no resident process');
    });
});
