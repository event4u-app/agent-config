/**
 * Acceptance item A4 of road-to-authority-routing-mechanism step 7.1: the two
 * branches that reach ledger rows in two modes are executed under every flag
 * combination, and each run must select exactly the row its precedence entry
 * names. The ledger says a default run of these warnings is an observation
 * (exit 0) and a `--strict` run is an invariant (exit 1); this asserts it at
 * runtime instead of trusting the classifier's own tables.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO = path.resolve(__dirname, '..', '..');
const TSX = path.join(REPO, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

interface Run {
    status: number | null;
    out: string;
}

function run(script: string, args: readonly string[], cwd: string): Run {
    const res = spawnSync(TSX, [script, ...args], { cwd, encoding: 'utf8', timeout: 60_000 });
    return { status: res.status, out: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

function write(p: string, content: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
}

// The script resolves its root from its own location, so the fixture repo
// carries a copy of the script and the one helper it imports.
function publicLinksRepo(marker: boolean): { dir: string; script: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-cpl-'));
    for (const rel of ['src/scripts/check_public_links.ts', 'src/scripts/_lib/scan_scope.ts']) {
        write(path.join(dir, rel), fs.readFileSync(path.join(REPO, rel), 'utf8'));
    }
    write(path.join(dir, 'docs/contracts/STABILITY.md'), 'stability: stable\n');
    write(path.join(dir, 'docs/contracts/beta-thing.md'), '---\nstability: beta\n---\n# beta\n');
    write(path.join(dir, 'README.md'), `See [the thing](docs/contracts/beta-thing.md)${marker ? ' (beta)' : ''}.\n`);
    write(path.join(dir, 'AGENTS.md'), '# agents\n');
    write(path.join(dir, 'docs/architecture.md'), '# architecture\n');
    return { dir, script: path.join(dir, 'src/scripts/check_public_links.ts') };
}

function consumerRepo(legacy: boolean): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-lal-'));
    fs.mkdirSync(path.join(dir, 'agents', 'overrides'), { recursive: true });
    if (legacy) fs.mkdirSync(path.join(dir, 'agents', 'legacy-stuff'));
    return dir;
}

const BETA_WARNING = 'lacks visible (beta) marker';
const CONSUMER_WARNING = 'legacy artefact outside the consumer-target shape';

describe('A4 — check_public_links c11-beta-marker: default → R11.e, --strict → R11.f, --list excluded', () => {
    let warn: { dir: string; script: string };
    let clean: { dir: string; script: string };
    beforeAll(() => {
        warn = publicLinksRepo(false);
        clean = publicLinksRepo(true);
    });
    afterAll(() => {
        for (const r of [warn, clean]) fs.rmSync(r.dir, { recursive: true, force: true });
    });

    const table: { args: string[]; status: number; warns: boolean; row: string }[] = [
        { args: [], status: 0, warns: true, row: 'R11.e (observation)' },
        { args: ['--json'], status: 0, warns: true, row: 'R11.e (observation)' },
        { args: ['--strict'], status: 1, warns: true, row: 'R11.f (invariant)' },
        { args: ['--strict', '--strict'], status: 1, warns: true, row: 'R11.f (invariant)' },
        { args: ['--json', '--strict'], status: 1, warns: true, row: 'R11.f (invariant)' },
        { args: ['--strict', '--json'], status: 1, warns: true, row: 'R11.f (invariant)' },
        { args: ['--list'], status: 0, warns: false, row: 'none: --list excludes the branch' },
        { args: ['--list', '--strict'], status: 0, warns: false, row: 'none: --list excludes the branch' },
        { args: ['--strict', '--list'], status: 0, warns: false, row: 'none: --list excludes the branch' },
    ];
    for (const t of table) {
        it(`[${t.args.join(' ') || 'no flags'}] selects ${t.row}`, () => {
            const r = run(warn.script, t.args, warn.dir);
            expect(r.status).toBe(t.status);
            expect(r.out.includes(BETA_WARNING)).toBe(t.warns);
        }, 60_000);
    }

    it('an unknown flag is a usage error (exit 2), not a fall-through to the default row', () => {
        const r = run(warn.script, ['--surprise'], warn.dir);
        expect(r.status).toBe(2);
        expect(r.out.includes(BETA_WARNING)).toBe(false);
    }, 60_000);

    it('control: with the (beta) marker present, --strict passes — the exit is the branch, not the flag', () => {
        const r = run(clean.script, ['--strict'], clean.dir);
        expect(r.status).toBe(0);
        expect(r.out.includes(BETA_WARNING)).toBe(false);
    }, 60_000);
});

describe('A4 — lint_agents_layout c12-consumer-warning: default → R12.c, --strict → R12.d', () => {
    const script = path.join(REPO, 'src/scripts/lint_agents_layout.ts');
    let warn: string;
    let clean: string;
    beforeAll(() => {
        warn = consumerRepo(true);
        clean = consumerRepo(false);
    });
    afterAll(() => {
        for (const d of [warn, clean]) fs.rmSync(d, { recursive: true, force: true });
    });

    const table: { args: string[]; status: number; prints: boolean; row: string }[] = [
        { args: [], status: 0, prints: true, row: 'R12.c (observation)' },
        { args: ['--quiet'], status: 0, prints: false, row: 'R12.c (observation, silenced)' },
        { args: ['--strict'], status: 1, prints: true, row: 'R12.d (invariant)' },
        { args: ['--strict', '--strict'], status: 1, prints: true, row: 'R12.d (invariant)' },
        { args: ['--quiet', '--strict'], status: 1, prints: false, row: 'R12.d (invariant, silenced)' },
        { args: ['--strict', '--quiet'], status: 1, prints: false, row: 'R12.d (invariant, silenced)' },
    ];
    for (const t of table) {
        it(`[${t.args.join(' ') || 'no flags'}] selects ${t.row}`, () => {
            const r = run(script, t.args, warn);
            expect(r.status).toBe(t.status);
            expect(r.out.includes(CONSUMER_WARNING)).toBe(t.prints);
        }, 60_000);
    }

    it('an unrecognised flag is ignored by membership parsing and selects the default row', () => {
        const r = run(script, ['--list'], warn);
        expect(r.status).toBe(0);
        expect(r.out.includes(CONSUMER_WARNING)).toBe(true);
    }, 60_000);

    it('control: a consumer tree with only expected entries passes --strict', () => {
        const r = run(script, ['--strict'], clean);
        expect(r.status).toBe(0);
        expect(r.out.includes(CONSUMER_WARNING)).toBe(false);
    }, 60_000);
});
