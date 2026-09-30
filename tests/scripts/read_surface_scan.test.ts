/**
 * Read-surface scanner and its gate
 * (road-to-a-sanitize-list-that-is-generated, Phase 1).
 *
 * The scanner replaces a hand-written list that disagreed with the tree in both
 * directions, so the assertions that matter are the ones a hand-written list
 * could also have passed: the three modules the roadmap named by `file:line`
 * must read the way the TREE says, not the way this suite wishes.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    SCAN_ROOT,
    ScanTraversalError,
    type ReadDir,
    renderTable,
    scanReadSurfaces,
    tally,
} from '../../src/scripts/_lib/read_surface_scan.js';
import {
    DOC_REL,
    FLOOR_REL,
    extractRegion,
    headerSecondCopy,
    leadingBlockComment,
    renderRegion,
    spliceRegion,
} from '../../src/scripts/check_read_surface_coverage.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const tmp: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'read-surface-'));
    tmp.push(d);
    return d;
}
afterEach(() => {
    while (tmp.length) fs.rmSync(tmp.pop() as string, { recursive: true, force: true });
});

/** Write a one-module fixture tree and scan it. */
function scanFixture(source: string, rel = 'probe.ts'): ReturnType<typeof scanReadSurfaces> {
    const root = mkTmp();
    fs.mkdirSync(path.join(root, SCAN_ROOT, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, SCAN_ROOT, rel), source, 'utf-8');
    return scanReadSurfaces(root);
}

describe('inbound shapes', () => {
    it('recognises an awaited fetch', () => {
        const rows = scanFixture(
            'export async function f(u: string): Promise<string> {\n' +
                '    const r = await fetch(u);\n    return await r.text();\n}\n',
        );
        expect(rows).toHaveLength(1);
        expect((rows[0] as NonNullable<typeof rows[0]>).inbound).toBe('network-fetch');
    });

    it('ignores a fetch named only inside a string literal', () => {
        // The shape a spawned one-liner or a doc example has. A matcher on a
        // bare `fetch(` would invent a row here.
        expect(
            scanFixture('export const snippet = "fetch(\'https://x\').then(r => r.ok)";\n'),
        ).toEqual([]);
    });

    it('recognises a node:https request, and needs the import as well as the call', () => {
        const withImport = scanFixture(
            "import * as https from 'node:https';\n" +
                'export function g(): void {\n    https.get("https://x", () => undefined);\n}\n',
        );
        expect((withImport[0] as NonNullable<typeof withImport[0]>).inbound).toBe('node-http-request');

        // `.get(` on something that is not node's HTTP client is not inbound.
        expect(scanFixture('export function g(): void {\n    https.get("x");\n}\n')).toEqual([]);
    });

    it('recognises a remote-fetching subprocess but not a local git one', () => {
        const remote = scanFixture(
            "import { spawnSync } from 'node:child_process';\n" +
                'export function g(): void {\n    spawnSync("curl", ["-s", "https://x"]);\n}\n',
        );
        expect((remote[0] as NonNullable<typeof remote[0]>).inbound).toBe('remote-subprocess');

        const local = scanFixture(
            "import { spawnSync } from 'node:child_process';\n" +
                'export function g(): void {\n    spawnSync("git", ["status"]);\n}\n',
        );
        expect(local).toEqual([]);
    });

    it('honours a module-declared shape for a channel no call site spells', () => {
        const rows = scanFixture(
            '// read-surface: host-tool-result\nexport function g(): string {\n    return "";\n}\n',
        );
        expect((rows[0] as NonNullable<typeof rows[0]>).inbound).toBe('host-tool-result');
    });

    it('declaring a surface cannot make it read covered', () => {
        const rows = scanFixture(
            '// read-surface: host-tool-result\nexport function g(): string {\n    return "";\n}\n',
        );
        expect((rows[0] as NonNullable<typeof rows[0]>).coverage).toBe('uncovered');
    });
});

describe('the unclassified row — a missing row is the worst failure', () => {
    it('a network call through an injected callee gets a row, not silence', () => {
        const rows = scanFixture(
            'export async function g(this: { _fetch: typeof fetch }, u: string): Promise<void> {\n' +
                '    const r = await this._fetch(u);\n    void r;\n}\n',
        );
        expect(rows).toHaveLength(1);
        expect((rows[0] as NonNullable<typeof rows[0]>).inbound).toBe('indirect-fetch');
        expect((rows[0] as NonNullable<typeof rows[0]>).coverage).toBe('unclassified');
    });

    it('inbound bytes with no recognised emit are unclassified, not dropped', () => {
        const rows = scanFixture(
            "import { spawnSync } from 'node:child_process';\n" +
                'const go = (): void => {\n    spawnSync("curl", ["https://x"]);\n};\nvoid go;\n',
        );
        expect((rows[0] as NonNullable<typeof rows[0]>).coverage).toBe('unclassified');
        expect((rows[0] as NonNullable<typeof rows[0]>).emit).toBe('undecided');
    });
});

describe('coverage is read from the import, and only from the import', () => {
    it('marks a module importing the floor as covered', () => {
        const rows = scanFixture(
            "import { sanitize_text } from './_lib/retrieval_sanitize.js';\n" +
                'export async function f(u: string): Promise<string> {\n' +
                '    const r = await fetch(u);\n    return sanitize_text(await r.text());\n}\n',
        );
        expect((rows[0] as NonNullable<typeof rows[0]>).coverage).toBe('covered');
    });

    it('a mention of the floor in a comment is not an import', () => {
        const rows = scanFixture(
            '// TODO: call sanitize_text from retrieval_sanitize here one day\n' +
                'export async function f(u: string): Promise<string> {\n' +
                '    const r = await fetch(u);\n    return await r.text();\n}\n',
        );
        expect((rows[0] as NonNullable<typeof rows[0]>).coverage).toBe('uncovered');
    });
});

describe('the real tree — the three modules the roadmap named', () => {
    const rows = scanReadSurfaces(REPO_ROOT);
    const byModule = new Map(rows.map((r) => [r.module, r]));

    it('scans a non-empty corpus', () => {
        expect(rows.length).toBeGreaterThan(5);
    });

    it.each([
        '_lib/reddit_thread_parse.ts',
        'update_prices.ts',
        '_lib/llm_proposer_transport.ts',
    ])('%s is present and covered', (mod) => {
        expect(byModule.get(mod)?.coverage).toBe('covered');
    });

    it('does not scan itself, the floor, or the detector', () => {
        for (const self of [
            '_lib/read_surface_scan.ts',
            '_lib/retrieval_sanitize.ts',
            'check_read_surface_coverage.ts',
        ]) {
            expect(byModule.has(self)).toBe(false);
        }
    });

    it('excludes colocated test files', () => {
        expect(rows.filter((r) => r.module.endsWith('.test.ts'))).toEqual([]);
    });
});

describe('the committed table', () => {
    it('matches the tree — regenerate with `check_read_surface_coverage --write`', () => {
        const doc = fs.readFileSync(path.join(REPO_ROOT, DOC_REL), 'utf-8');
        expect(extractRegion(doc)).toBe(renderRegion(scanReadSurfaces(REPO_ROOT)).trim());
    });

    it("the floor's header points at the table instead of restating it", () => {
        const header = leadingBlockComment(
            fs.readFileSync(path.join(REPO_ROOT, FLOOR_REL), 'utf-8'),
        );
        expect(header).toContain(DOC_REL);
        expect(headerSecondCopy(header, scanReadSurfaces(REPO_ROOT))).toEqual([]);
    });
});

describe('rendering helpers', () => {
    it('tallies every verdict', () => {
        const t = tally([
            { module: 'a', inbound: 'x', emit: 'y', coverage: 'covered', evidence: '' },
            { module: 'b', inbound: 'x', emit: 'y', coverage: 'uncovered', evidence: '' },
            { module: 'c', inbound: 'x', emit: 'y', coverage: 'unclassified', evidence: '' },
        ]);
        expect(t).toEqual({ covered: 1, uncovered: 1, unclassified: 1 });
    });

    it('renders a header row even for an empty set', () => {
        expect(renderTable([])).toContain('| module (under `src/scripts/`) |');
    });

    it('splices into an existing region rather than appending a second one', () => {
        const doc = spliceRegion('# t\n\n<!-- BEGIN read-surface-table (generated) -->\nold\n<!-- END read-surface-table -->\n', 'new');
        expect(doc).toContain('new');
        expect(doc).not.toContain('old');
        expect(doc.match(/BEGIN read-surface-table/g)).toHaveLength(1);
    });
});


// The fail-closed traversal.
//
// An unreadable subtree used to be silently omitted from the result, and the
// gate then reported the shortened list as matching the tree. This asserts the
// traversal now throws instead.
//
// The failure is INJECTED rather than produced with real permissions, for two
// measured reasons: ESM refuses to redefine `fs.readdirSync`, so `vi.spyOn` on
// the namespace throws; and `chmod 000` is not portable — under root the mode
// is no barrier, so the test would fail in exactly the environment it is
// written to survive.
//
// The injected error carries the EACCES shape Node actually produces. `_walk`
// wraps any reader exception, so the shape is documentation of the real case
// rather than a branch condition.
describe('the scan fails closed on an unreadable subtree', () => {
    let root: string;
    let locked: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-fail-closed-'));
        locked = path.join(root, 'src', 'scripts', '_lib', 'locked');
        fs.mkdirSync(locked, { recursive: true });
        fs.writeFileSync(
            path.join(locked, 'hidden_surface.ts'),
            'export async function pull(u: string): Promise<string> {\n' +
                '    const r = await fetch(u);\n    return await r.text();\n}\n',
            'utf-8',
        );
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('throws rather than returning a list with the unreadable subtree missing', () => {
        // Precondition on the SPECIFIC module: this is what makes the throw
        // below attributable to the injected failure rather than to an empty
        // fixture.
        expect(scanReadSurfaces(root).map((r) => r.module)).toContain('_lib/locked/hidden_surface.ts');

        const readDir: ReadDir = (dir) => {
            if (dir === locked) {
                const err = new Error(`EACCES: permission denied, scandir '${locked}'`) as NodeJS.ErrnoException;
                err.code = 'EACCES';
                err.path = locked;
                err.syscall = 'scandir';
                throw err;
            }
            return fs.readdirSync(dir, { withFileTypes: true });
        };

        let threw: unknown = null;
        try {
            scanReadSurfaces(root, readDir);
        } catch (exc) {
            threw = exc;
        }
        expect(threw).toBeInstanceOf(ScanTraversalError);
        expect(String((threw as Error).message)).toContain('the scan is incomplete');
        expect(String((threw as Error).message)).toContain('EACCES');
    });
});
