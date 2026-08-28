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
// check_claims imports the exec: evidence lib, the scan-scope assertion, and —
// since the non-inference ratchet landed — the baseline reader. The throwaway
// tree needs all three. Each imports only node builtins, so the chain ends
// here; a fourth arriving without this line fails as a module-resolution error
// in every case at once, which is what it did.
//
// The fixture writes no `src/config/gate-violation-baselines.json`, and that is
// deliberate rather than an omission: check_claims SKIPS the ratchet when the
// baselines file is absent (a fixture) and still fails when the file exists
// with no entry (a repository silencing a gate). This harness exercises the
// first branch by construction.
const LIB_SRCS = ['exec_evidence.ts', 'scan_scope.ts', 'gate_baseline.ts'].map((n) =>
    path.join(REPO_ROOT, 'src', 'scripts', '_lib', n),
);

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
    fs.mkdirSync(path.join(work, 'src', 'scripts', '_lib'), { recursive: true });
    for (const src of LIB_SRCS) {
        fs.copyFileSync(src, path.join(work, 'src', 'scripts', '_lib', path.basename(src)));
    }
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
    // A quantitative entry. The witness sweep requires `kind: quant` to clear a
    // FIGURE: a qualitative claim says nothing about a quantity, so `good` above
    // deliberately cannot license "saves 65% of tokens".
    '### claim: good-quant',
    '- claim: A bound quantitative claim.',
    '- kind: quant',
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

    it('witness sweep: an unmarkered quantified claim in README fails; markered or unverified passes', () => {
        write('docs/CLAIMS.md', backedLedger);
        write('README.md', 'This layer saves 65% of tokens.\n');
        const bad = run();
        expect(bad.code).toBe(2);
        expect(bad.stderr).toContain('quantified claim without a claim marker');

        write(
            'README.md',
            [
                'This layer saves 65% of tokens. <!-- claim:good-quant -->',
                'Rough guess: maybe 3x faster (unverified, not measured).',
                '```',
                'benchmark output: 99% — fenced, never scanned',
                '```',
                '',
            ].join('\n'),
        );
        const good = run();
        expect(good.code).toBe(0);
    });

    it('witness sweep: a qualitative marker cannot license a figure on its line', () => {
        // The regression that shipped. README carried "compiled into 7+ host
        // agents" on a line already markered `claim:no-runtime-daemon` — a
        // `kind: qual` claim about having no daemon. Any-marker-exempts-the-line
        // let the figure ride along on it for months.
        write('docs/CLAIMS.md', backedLedger);
        write('README.md', 'Compiled into 7+ host agents.<!-- claim:good -->\n');
        const bad = run();
        expect(bad.code).toBe(2);
        expect(bad.stderr).toContain('cannot license a number');

        // The same line clears once a quantitative entry backs it.
        write('README.md', 'Compiled into 20 host agents.<!-- claim:good-quant -->\n');
        expect(run().code).toBe(0);
    });


    // road-to-inbox-harvest-2026-08-b-authoring-contract 4.2 — the documented
    // external-pointer grammar is `https://… (YYYY-MM-DD)`, WITH a space. The
    // enforcing pattern used to require the stamp to abut the URL, so every
    // pointer written the documented way was rejected; the form had zero usage,
    // so nothing caught it. Both spellings must clear.
    it('accepts an external cite with a dated stamp, spaced or abutting', () => {
        for (const pointer of [
            'https://arxiv.org/abs/2306.05685 (2026-08-11)',
            'https://arxiv.org/abs/2306.05685(2026-08-11)',
        ]) {
            write(
                'docs/CLAIMS.md',
                [
                    '# Claims Ledger',
                    '',
                    '### claim: external',
                    '- claim: A claim resting on an external paper.',
                    '- kind: qual',
                    `- evidence: ${pointer}`,
                    '- status: backed',
                    '- last_verified: 2026-08-11',
                    '',
                ].join('\n'),
            );
            write('README.md', 'Implements the judge pattern.<!-- claim:external -->\n');
            const r = run();
            expect(r.code, `${pointer} → ${r.stderr}`).toBe(0);
        }
    });

    it('still rejects an external cite with no dated stamp', () => {
        write(
            'docs/CLAIMS.md',
            [
                '# Claims Ledger',
                '',
                '### claim: external',
                '- claim: A claim resting on an external paper.',
                '- kind: qual',
                '- evidence: https://arxiv.org/abs/2306.05685',
                '- status: backed',
                '- last_verified: 2026-08-11',
                '',
            ].join('\n'),
        );
        write('README.md', 'Implements the judge pattern.<!-- claim:external -->\n');
        const r = run();
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('missing a (YYYY-MM-DD) stamp');
    });


    // road-to-inbox-harvest-2026-08-b-authoring-contract 4.3 — `superseded_by` is
    // parsed and gated, not merely documented. An unparsed field would be a
    // documented claim the code does not honour.
    function supersedeLedger(fields: string): string {
        return [
            '# Claims Ledger',
            '',
            '### claim: closed',
            '- claim: A question that was asked and answered null.',
            '- kind: quant',
            '- evidence: docs/evidence.md#ANCHOR',
            '- status: resolved-null',
            '- last_verified: 2026-08-11',
            fields,
            '',
            '### claim: reopened',
            '- claim: The same question, asked by a different mechanism.',
            '- kind: quant',
            '- evidence: docs/evidence.md#ANCHOR',
            '- status: unbacked',
            '- last_verified: 2026-08-11',
            '',
        ].join('\n');
    }

    it('accepts a successor pointer that names a real entry', () => {
        write('docs/evidence.md', 'ANCHOR\n');
        write('docs/CLAIMS.md', supersedeLedger('- superseded_by: reopened'));
        write('README.md', 'No markers here.\n');
        expect(run().code).toBe(0);
    });

    it('rejects a successor pointer that names nothing', () => {
        write('docs/evidence.md', 'ANCHOR\n');
        write('docs/CLAIMS.md', supersedeLedger('- superseded_by: ghost'));
        write('README.md', 'No markers here.\n');
        const r = run();
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('not in the ledger');
    });

    it('rejects a successor pointer on a live entry', () => {
        write('docs/evidence.md', 'ANCHOR\n');
        const ledger = supersedeLedger('- superseded_by: reopened').replace(
            '- status: resolved-null',
            '- status: backed',
        );
        write('docs/CLAIMS.md', ledger);
        write('README.md', 'No markers here.\n');
        const r = run();
        expect(r.code).toBe(2);
        // Wording widened when `withdrawn` joined `resolved-null` as a closure
        // that may carry a successor. The BEHAVIOUR under test is unchanged:
        // a `backed` entry still may not point at one.
        expect(r.stderr).toContain('only meaningful on a closed entry');
    });

    it('rejects a successor pointer at its own entry', () => {
        write('docs/evidence.md', 'ANCHOR\n');
        write('docs/CLAIMS.md', supersedeLedger('- superseded_by: closed'));
        write('README.md', 'No markers here.\n');
        const r = run();
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('points at its own entry');
    });

    // road-to-runtime-governance-flip Phase 2 — `withdrawn`, the ledger's third
    // closure. A claim that was TRUE and was retired by a decision fits neither
    // `unbacked` (debt somebody should discharge) nor `resolved-null` (a
    // pre-registered threshold was missed), and the status column in
    // `docs/proof.md` is what a reader scans.
    function withdrawnLedger(fields: string, status = 'withdrawn'): string {
        return [
            '# Claims Ledger',
            '',
            '### claim: retired',
            '- claim: A property the package decided to stop having.',
            '- kind: qual',
            '- evidence: docs/evidence.md#ANCHOR',
            `- status: ${status}`,
            '- last_verified: 2026-07-04',
            fields,
            '',
            '### claim: successor',
            '- claim: The policy that replaced it.',
            '- kind: qual',
            '- evidence: docs/evidence.md#ANCHOR',
            '- status: unbacked',
            '- last_verified: 2026-08-27',
            '',
        ].join('\n');
    }

    it('accepts a withdrawn entry that names its decision and its successor', () => {
        write('docs/evidence.md', 'ANCHOR\n');
        write(
            'docs/CLAIMS.md',
            withdrawnLedger('- retired_by: ADR-249\n- superseded_by: successor'),
        );
        write('README.md', 'No markers here.\n');
        expect(run().code).toBe(0);
    });

    it('rejects a withdrawal that cannot name the decision that retired it', () => {
        write('docs/evidence.md', 'ANCHOR\n');
        write('docs/CLAIMS.md', withdrawnLedger('- superseded_by: successor'));
        write('README.md', 'No markers here.\n');
        const r = run();
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('no `retired_by` names the decision');
    });

    it('rejects retired_by on an entry that is not withdrawn', () => {
        write('docs/evidence.md', 'ANCHOR\n');
        write('docs/CLAIMS.md', withdrawnLedger('- retired_by: ADR-249', 'unbacked'));
        write('README.md', 'No markers here.\n');
        const r = run();
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('retired_by is only meaningful on a withdrawn entry');
    });

    it('still refuses a marker in public prose for a withdrawn claim', () => {
        write('docs/evidence.md', 'ANCHOR\n');
        write(
            'docs/CLAIMS.md',
            withdrawnLedger('- retired_by: ADR-249\n- superseded_by: successor'),
        );
        write('README.md', 'We have no daemon.<!-- claim:retired -->\n');
        const r = run();
        expect(r.code).toBe(2);
        expect(r.stderr).toContain("ledger status is 'withdrawn', not 'backed'");
    });

});
