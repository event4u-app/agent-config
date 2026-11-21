/**
 * Detector G of `turn-end-gate` — a done claim wider than its evidence — as a
 * library (`_lib/coverage_claim.ts`, `_lib/unlisted_surface.ts`).
 *
 * G is NOT wired into the hook: the owner withdrew the dispatch-bundle raise
 * on 2026-11-21 (option 2). The tests that ran it end-to-end through the hook
 * move with the wiring to road-to-done-claims-with-read-exit-codes-live-wiring.
 * The prose views are the hook's own, so this reads what the gate would read.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { completionClaimAt, readRecorded, recordedFile, type CoverageFinding } from '../../src/scripts/_lib/coverage_claim.js';
import { coverageGapIn } from '../../src/scripts/_lib/unlisted_surface.js';
import { stripFencedBlocks, visibleProse, type ToolCall } from '../../src/scripts/hooks/turn_end_gate_hook.js';

const tmp_dirs: string[] = [];
afterAll(() => {
    for (const d of tmp_dirs) fs.rmSync(d, { recursive: true, force: true });
});

function detectCoverageGap(reply: string, calls: readonly ToolCall[] = [], root?: string): CoverageFinding | null {
    return coverageGapIn(stripFencedBlocks(reply), visibleProse(reply), calls, root);
}

describe('detector G — a partial ratio reported as complete', () => {
    // road-to-done-claims-with-read-exit-codes 3.1: "a book was reported
    // complete when about 165 of 405 pages had been covered".
    it.each([
        'Fertig — 165 von 405 Seiten bearbeitet.',
        'Done. 1 of 9 steps processed.',
        'All done: 40/41 checks passed.',
    ])('records a coverage finding on: %s', (reply) => {
        const f = detectCoverageGap(reply);
        expect(f?.detector).toBe('coverage');
        expect(f?.code).toBe('partial_ratio');
    });

    it.each([
        ['a full ratio', 'Fertig: 405 von 405 Seiten.'],
        ['a ratio under Not verified', 'Done.\n\nNot verified:\n- 165 of 405 pages, the rest needs the scanner.'],
        ['a ratio under Nicht verifiziert', 'Fertig.\n\nNicht verifiziert: 165 von 405 Seiten.'],
        ['a negated line', 'Noch nicht fertig, 165 von 405 Seiten.'],
        ['a ratio inside a fenced block', 'Fertig.\n\n```\n165 von 405\n```'],
        ['a ratio inside a table', 'Fertig.\n\n| Seiten | Stand |\n|---|---|\n| 165 von 405 | offen |'],
        ['no completion claim', 'Stand: 165 von 405 Seiten bearbeitet, ich mache weiter.'],
    ])('records nothing on %s', (_label, reply) => {
        expect(detectCoverageGap(reply)).toBeNull();
    });
});

describe('detector G — a negated claim on its own line', () => {
    it('a claim line after another line still reads its own negation', () => {
        expect(detectCoverageGap('Progress update.\nFertig ist der Fix noch nicht.\n165 von 405', [], undefined)).toBeNull();
    });

    it('a later claim after a negated one is still a claim', () => {
        expect(
            detectCoverageGap('Status.\nFertig ist der Fix noch nicht.\nDone.\n165 von 405', [], undefined)?.code,
        ).toBe('partial_ratio');
    });

    it('a claim line after a blank line still reads its own negation', () => {
        expect(detectCoverageGap('Progress update.\n\nFertig ist der Fix noch nicht.\n165 von 405', [], undefined)).toBeNull();
    });

    it('counter values that are not non-negative integers are dropped on read', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recorded-bad-'));
        tmp_dirs.push(dir);
        const file = path.join(dir, 'k.recorded.json');
        fs.writeFileSync(file, JSON.stringify({ counts: { coverage: '9', ok: 2 }, codes: { partial_ratio: -1 } }));
        const r = readRecorded(file);
        expect(r?.counts).toEqual({ ok: 2 });
        expect(r?.codes).toEqual({});
    });

    it('a counter file name is built only from a derived session key', () => {
        expect(() => recordedFile('/tmp/state', '../../evil')).toThrow();
        expect(recordedFile('/tmp/state', 'a'.repeat(32))).toBe(path.join('/tmp/state', `${'a'.repeat(32)}.recorded.json`));
    });

    it('a counter path that is a FIFO does not block reading the counters', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recorded-fifo-'));
        tmp_dirs.push(dir);
        const file = path.join(dir, 'k.recorded.json');
        if (spawnSync('mkfifo', [file]).status !== 0) return;
        expect(readRecorded(file)).toBeNull();
    });
});

describe('detector G — an edited surface nothing drove and nothing lists', () => {
    // road-to-done-claims-with-read-exit-codes 4.4. The surface map is derived
    // from the workspace's own package.json; the turn edits a file under it.
    function appWorkspace(): string {
        const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-surface-')));
        tmp_dirs.push(dir);
        fs.writeFileSync(
            path.join(dir, 'package.json'),
            JSON.stringify({ name: 'app', private: true, scripts: { dev: 'vite' } }, null, 2),
        );
        fs.mkdirSync(path.join(dir, 'src'));
        return dir;
    }
    const edit = (dir: string): ToolCall => ({ name: 'Edit', path: path.join(dir, 'src', 'App.tsx') });

    it('records unlisted_surface for a done claim over an undriven, unlisted surface', () => {
        const dir = appWorkspace();
        const f = detectCoverageGap('Fertig. Der Button ist umgebaut.', [edit(dir)], dir);
        expect(f?.detector).toBe('coverage');
        expect(f?.code).toBe('unlisted_surface');
    });

    it('records nothing when the reply lists the surface under Not verified', () => {
        const dir = appWorkspace();
        const reply = 'Fertig. Der Button ist umgebaut.\n\nNot verified:\n- dev (npm run dev): no browser in this session';
        expect(detectCoverageGap(reply, [edit(dir)], dir)).toBeNull();
    });

    it('records nothing when the turn rendered the page', () => {
        const dir = appWorkspace();
        const calls: ToolCall[] = [edit(dir), { name: 'Bash', command: 'npx agent-config ui:render http://localhost:5173' }];
        expect(detectCoverageGap('Fertig. Der Button ist umgebaut.', calls, dir)).toBeNull();
    });

    it('records nothing when the turn edited nothing', () => {
        const dir = appWorkspace();
        expect(detectCoverageGap('Fertig.', [], dir)).toBeNull();
    });

    it('a browser run does not drive a compose service', () => {
        const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-compose-')));
        tmp_dirs.push(dir);
        fs.writeFileSync(path.join(dir, 'docker-compose.yml'), 'services:\n  api:\n    ports:\n      - "8080:80"\n');
        const calls: ToolCall[] = [
            { name: 'Edit', path: path.join(dir, 'server.ts') },
            { name: 'Bash', command: 'npx playwright test' },
        ];
        expect(detectCoverageGap('Fertig.', calls, dir)?.code).toBe('unlisted_surface');
    });

    it('a status sentence opening with "Not verified yet" is not a Not verified list', () => {
        const dir = appWorkspace();
        const reply = 'Fertig. Der Button ist umgebaut.\n\nNot verified yet whether dev (npm run dev) still starts.';
        expect(detectCoverageGap(reply, [edit(dir)], dir)?.code).toBe('unlisted_surface');
    });

    it('a playwright run with another config does not drive this config\'s surface', () => {
        const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-pw-')));
        tmp_dirs.push(dir);
        fs.writeFileSync(path.join(dir, 'playwright.config.ts'), "export default { use: { baseURL: 'http://localhost:4173' } };\n");
        const calls: ToolCall[] = [
            { name: 'Edit', path: path.join(dir, 'page.ts') },
            { name: 'Bash', command: 'npx playwright test --config e2e/other.config.ts' },
        ];
        expect(detectCoverageGap('Fertig.', calls, dir)?.code).toBe('unlisted_surface');
    });

    it('a call that runs playwright twice drives the config either run names', () => {
        const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-pw-')));
        tmp_dirs.push(dir);
        fs.writeFileSync(path.join(dir, 'playwright.config.ts'), "export default { use: { baseURL: 'http://localhost:4173' } };\n");
        const calls: ToolCall[] = [
            { name: 'Edit', path: path.join(dir, 'page.ts') },
            { name: 'Bash', command: 'npx playwright test -c e2e/other.config.ts && npx playwright test -c playwright.config.ts' },
        ];
        expect(detectCoverageGap('Fertig.', calls, dir)).toBeNull();
    });

    it('a playwright run credits only the npm script its root config starts', () => {
        const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-ws-')));
        tmp_dirs.push(dir);
        fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite', preview: 'vite preview' } }));
        // The comment names `preview` too, and must not count as starting it.
        fs.writeFileSync(
            path.join(dir, 'playwright.config.ts'),
            "// later: npm run preview\nexport default { webServer: { command: 'npm run dev' } };\n",
        );
        fs.mkdirSync(path.join(dir, 'src'));
        const calls: ToolCall[] = [{ name: 'Edit', path: path.join(dir, 'src', 'a.ts') }, { name: 'Bash', command: 'npx playwright test' }];
        const f = detectCoverageGap('Fertig.', calls, dir);
        expect(f?.code).toBe('unlisted_surface');
        expect(f?.evidence).toContain('preview');
    });

    it('only the webServer command counts, not another command: property', () => {
        const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-ws2-')));
        tmp_dirs.push(dir);
        fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite', preview: 'vite preview' } }));
        fs.writeFileSync(
            path.join(dir, 'playwright.config.ts'),
            "export default { metadata: { command: 'npm run preview' }, webServer: { command: 'npm run dev' } };\n",
        );
        fs.mkdirSync(path.join(dir, 'src'));
        const calls: ToolCall[] = [{ name: 'Edit', path: path.join(dir, 'src', 'a.ts') }, { name: 'Bash', command: 'npx playwright test' }];
        expect(detectCoverageGap('Fertig.', calls, dir)?.evidence).toContain('preview');
    });

    it('a run naming one root config credits only the script that config starts', () => {
        const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-ws3-')));
        tmp_dirs.push(dir);
        fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite', preview: 'vite preview' } }));
        fs.writeFileSync(path.join(dir, 'playwright.config.ts'), "export default { webServer: { command: 'npm run dev' } };\n");
        fs.writeFileSync(path.join(dir, 'playwright.config.js'), "module.exports = { webServer: { command: 'npm run preview' } };\n");
        fs.mkdirSync(path.join(dir, 'src'));
        const calls: ToolCall[] = [
            { name: 'Edit', path: path.join(dir, 'src', 'a.ts') },
            { name: 'Bash', command: 'npx playwright test -c playwright.config.ts' },
        ];
        expect(detectCoverageGap('Fertig.', calls, dir)?.evidence).toContain('preview');
    });

    it('a playwright config full of comment openers does not stall the detector', () => {
        const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-cmt-')));
        tmp_dirs.push(dir);
        fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }));
        fs.writeFileSync(path.join(dir, 'playwright.config.ts'), `const s = "${'/*'.repeat(200000)}";\nexport default {};\n`);
        fs.mkdirSync(path.join(dir, 'src'));
        const t0 = Date.now();
        expect(detectCoverageGap('Fertig.', [{ name: 'Edit', path: path.join(dir, 'src', 'a.ts') }], dir)?.code).toBe('unlisted_surface');
        expect(Date.now() - t0).toBeLessThan(1000);
    });

    it('many ratios on one negated line are read in linear time', () => {
        const reply = `Done.\n${'1/2 '.repeat(40000)}not yet`;
        const t0 = Date.now();
        expect(detectCoverageGap(reply, [], undefined)).toBeNull();
        expect(Date.now() - t0).toBeLessThan(1000);
    });

    it('a negated claim before a long run of blank lines is scanned in linear time', () => {
        const reply = `Fertig ist das noch nicht.${'\n'.repeat(100000)}weiter`;
        const t0 = Date.now();
        expect(completionClaimAt(reply)).toBeNull();
        expect(Date.now() - t0).toBeLessThan(1000);
    });

    it('a word that only starts with a completion phrase is not a claim for G', () => {
        expect(completionClaimAt('Fertig ist der Fix noch nicht.\nTask completeness remains under review.')).toBeNull();
    });

    it('"Task completed." is still a claim for G', () => {
        expect(completionClaimAt('Task completed.')).not.toBeNull();
    });

    it('a claim indented with a non-breaking space is still a claim', () => {
        expect(completionClaimAt('Progress.\n Done.')).not.toBeNull();
    });

    it('a ratio does not run across a line break into a negated line', () => {
        expect(detectCoverageGap('Done.\n2 of\n3 not yet verified.', [], undefined)).toBeNull();
    });

    it('a CRLF blank line ends a Not verified block, so a later ratio still counts', () => {
        const reply = 'Done.\r\n\r\nNot verified: the scanner run.\r\n\r\n165 von 405 Seiten.';
        expect(detectCoverageGap(reply, [], undefined)?.code).toBe('partial_ratio');
    });

    it('many Not verified headings in one block are read in linear time', () => {
        const reply = `Done.\n${'Not verified: 2/3\n'.repeat(20000)}`;
        const t0 = Date.now();
        expect(detectCoverageGap(reply, [], undefined)).toBeNull();
        expect(Date.now() - t0).toBeLessThan(1000);
    });

    it('a webServer inside a string literal does not credit its script', () => {
        const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-str-')));
        tmp_dirs.push(dir);
        fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite', preview: 'vite preview' } }));
        fs.writeFileSync(
            path.join(dir, 'playwright.config.ts'),
            `const example = "webServer: { command: 'npm run preview' }";\nexport default { webServer: { command: 'npm run dev' } };\n`,
        );
        fs.mkdirSync(path.join(dir, 'src'));
        const calls: ToolCall[] = [{ name: 'Edit', path: path.join(dir, 'src', 'a.ts') }, { name: 'Bash', command: 'npx playwright test' }];
        expect(detectCoverageGap('Fertig.', calls, dir)?.evidence).toContain('preview');
    });

    it('a Not verified heading after several blank lines still lists what follows', () => {
        expect(detectCoverageGap('Done.\n\n\n\nNot verified: 40/41 pages', [], undefined)).toBeNull();
    });

    it('a browser run against another app\'s config does not drive the root npm surface', () => {
        const dir = appWorkspace();
        const calls: ToolCall[] = [edit(dir), { name: 'Bash', command: 'npx playwright test -c apps/admin/playwright.config.ts' }];
        expect(detectCoverageGap('Fertig.', calls, dir)?.code).toBe('unlisted_surface');
    });

    it('a playwright run over this config drives its surface', () => {
        const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-pw-')));
        tmp_dirs.push(dir);
        fs.writeFileSync(path.join(dir, 'playwright.config.ts'), "export default { use: { baseURL: 'http://localhost:4173' } };\n");
        const calls: ToolCall[] = [
            { name: 'Edit', path: path.join(dir, 'page.ts') },
            { name: 'Bash', command: 'npx playwright test' },
        ];
        expect(detectCoverageGap('Fertig.', calls, dir)).toBeNull();
    });

    it('a command that only mentions the start command does not drive the surface', () => {
        const dir = appWorkspace();
        const calls: ToolCall[] = [edit(dir), { name: 'Bash', command: 'echo "npm run dev"' }];
        expect(detectCoverageGap('Fertig.', calls, dir)?.code).toBe('unlisted_surface');
    });

    it('a command that only mentions a browser run does not drive the page', () => {
        const dir = appWorkspace();
        const calls: ToolCall[] = [edit(dir), { name: 'Bash', command: 'echo "playwright test"' }];
        expect(detectCoverageGap('Fertig.', calls, dir)?.code).toBe('unlisted_surface');
    });

    it('a URL on another port, or a URL only printed, does not drive a compose service', () => {
        const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-url-')));
        tmp_dirs.push(dir);
        fs.writeFileSync(path.join(dir, 'docker-compose.yml'), 'services:\n  api:\n    ports:\n      - "3000:80"\n');
        for (const command of [
            'curl http://localhost:30000/health',
            'echo http://localhost:3000',
            'true http://localhost:3000',
            "curl 'https://example.invalid/?next=http://localhost:3000'",
            // The URL as an option's value is not the request target.
            "curl --referer 'http://localhost:3000' https://example.invalid",
            'curl -e http://localhost:3000 https://example.invalid',
            'curl -x http://localhost:3000 https://example.invalid',
            "curl -H 'Referer: http://localhost:3000' https://example.invalid",
            "curl --header='Referer: http://localhost:3000' https://example.invalid",
            'curl --header=Referer:\\ http://localhost:3000 https://example.invalid',
            "curl https://example.invalid/'http://localhost:3000'",
            "curl http://localhost:3000'@example.invalid'",
        ]) {
            const calls: ToolCall[] = [{ name: 'Edit', path: path.join(dir, 'server.ts') }, { name: 'Bash', command }];
            expect(detectCoverageGap('Fertig.', calls, dir)?.code, command).toBe('unlisted_surface');
        }
        for (const command of [
            'curl -s http://localhost:3000/health',
            'curl -sSf http://localhost:3000/health',
            'curl -X GET http://localhost:3000/health',
            'curl --fail --silent "http://localhost:3000/health"',
            "curl -H 'Accept: text/html' http://localhost:3000/",
            'curl -- http://localhost:3000/health',
            "curl 'http://localhost:3000/health'",
            'curl http://localhost:3000',
        ]) {
            const driven: ToolCall[] = [{ name: 'Edit', path: path.join(dir, 'server.ts') }, { name: 'Bash', command }];
            expect(detectCoverageGap('Fertig.', driven, dir), command).toBeNull();
        }
    });

    it('a Not verified entry in inline code still lists the surface', () => {
        const dir = appWorkspace();
        const reply = 'Fertig. Der Button ist umgebaut.\n\nNot verified:\n- `npm run dev`: no browser in this session';
        expect(detectCoverageGap(reply, [edit(dir)], dir)).toBeNull();
    });

    it('a start command behind `false &&` never runs, so it drives nothing', () => {
        const dir = appWorkspace();
        const calls: ToolCall[] = [edit(dir), { name: 'Bash', command: 'false && npm run dev' }];
        expect(detectCoverageGap('Fertig.', calls, dir)?.code).toBe('unlisted_surface');
    });

    it('a documentation-only edit is not an edit to a runnable surface', () => {
        const dir = appWorkspace();
        const calls: ToolCall[] = [{ name: 'Edit', path: path.join(dir, 'docs', 'README.md') }];
        expect(detectCoverageGap('Fertig.', calls, dir)).toBeNull();
    });

    it('a start command after an unconditional exit never runs, so it drives nothing', () => {
        const dir = appWorkspace();
        const calls: ToolCall[] = [edit(dir), { name: 'Bash', command: 'exit 0; npm run dev' }];
        expect(detectCoverageGap('Fertig.', calls, dir)?.code).toBe('unlisted_surface');
    });

    it('a command that runs the start command drives the surface', () => {
        const dir = appWorkspace();
        const calls: ToolCall[] = [edit(dir), { name: 'Bash', command: 'cd app && npm run dev' }];
        expect(detectCoverageGap('Fertig.', calls, dir)).toBeNull();
    });

    it('a run before the edit does not drive the edited surface; the same run after it does', () => {
        const dir = appWorkspace();
        const run: ToolCall = { name: 'Bash', command: 'npm run dev' };
        expect(detectCoverageGap('Fertig.', [run, edit(dir)], dir)?.code).toBe('unlisted_surface');
        expect(detectCoverageGap('Fertig.', [edit(dir), run], dir)).toBeNull();
        expect(detectCoverageGap('Fertig.', [edit(dir), run, edit(dir)], dir)?.code).toBe('unlisted_surface');
    });

    it('a playwright config of the same name in another directory does not drive the root one', () => {
        const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-pw-')));
        tmp_dirs.push(dir);
        fs.writeFileSync(path.join(dir, 'playwright.config.ts'), "export default { use: { baseURL: 'http://localhost:4173' } };\n");
        const calls: ToolCall[] = [
            { name: 'Edit', path: path.join(dir, 'page.ts') },
            { name: 'Bash', command: 'npx playwright test --config e2e/playwright.config.ts' },
        ];
        expect(detectCoverageGap('Fertig.', calls, dir)?.code).toBe('unlisted_surface');
    });

    it('a Not verified block lists a surface by its whole name, not a word containing it', () => {
        const dir = appWorkspace();
        const reply = 'Fertig. Der Button ist umgebaut.\n\nNot verified:\n- the development notes';
        expect(detectCoverageGap(reply, [edit(dir)], dir)?.code).toBe('unlisted_surface');
    });
});
