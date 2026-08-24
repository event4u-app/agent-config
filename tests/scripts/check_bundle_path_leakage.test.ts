/**
 * Tests for `src/scripts/check_bundle_path_leakage.ts`
 * (road-to-feedback-9.2.0-followups Phase 4.1).
 *
 * Layer 1 drives the pure `scan_content` / `mask_snippet` / `format_report`
 * core directly with synthetic strings — no git, no filesystem. Layer 2
 * exercises `main()` against on-disk fixtures (a planted absolute-path leak
 * vs. a clean bundle-shaped file) to prove the guard is red on a leak and
 * green on clean content end to end. Layer 3 is a real-repo smoke test
 * asserting the guard passes against the actual tracked bundle today.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    LEAK_PATTERNS,
    ExitCode,
    format_report,
    main,
    mask_snippet,
    parse_args,
    scan_content,
    ALLOW_FILE,
    PUBLISHED_MD_ROOTS,
    parse_allow_file,
    scan_files,
    tracked_published_md,
} from '../../src/scripts/check_bundle_path_leakage.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_bundle_path_leakage.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

// --- Layer 1: pure scan core ------------------------------------------------

describe('scan_content — clean bundle shapes never match', () => {
    it('bare esbuild module-registry keys (no leading slash) are clean', () => {
        expect(scan_content('dist/install/install.mjs', 'node_modules/yaml/dist/index.js')).toEqual(
            [],
        );
    });

    it('the real emitted plugin-manifest runtime string is clean', () => {
        const line = 'npm: "./node_modules/@event4u/agent-config/plugin/agent-config"';
        expect(scan_content('dist/install/install.mjs', line)).toEqual([]);
    });

    it('a relative sourcemap comment is clean', () => {
        expect(scan_content('dist/install/atomic.js', '//# sourceMappingURL=atomic.js.map')).toEqual(
            [],
        );
    });

    it('a repo-relative .map "sources" entry is clean', () => {
        const json = '{"sources": ["../../src/install/atomic.ts"]}';
        expect(scan_content('dist/install/atomic.js.map', json)).toEqual([]);
    });

    it('empty content produces no hits', () => {
        expect(scan_content('dist/install/install.mjs', '')).toEqual([]);
    });
});

describe('scan_content — each leak pattern fires on its canonical shape', () => {
    it('macos-linux-home: an absolute /Users/<name>/... path', () => {
        const hits = scan_content(
            'x.mjs',
            '// /Users/someuser/projects/agent-config/node_modules/yaml/index.js',
        );
        expect(hits.some((h) => h.pattern === 'macos-linux-home')).toBe(true);
    });

    it('macos-linux-home: an absolute /home/<name>/... path (CI runner shape)', () => {
        const hits = scan_content(
            'x.mjs',
            '/home/runner/work/agent-config/agent-config/node_modules/yaml/index.js',
        );
        expect(hits.some((h) => h.pattern === 'macos-linux-home')).toBe(true);
    });

    it('private-or-opt-root: a macOS /private/var realpath', () => {
        const hits = scan_content(
            'x.mjs',
            'resolved from /private/var/folders/xy/T/node_modules/yaml/index.js',
        );
        expect(hits.some((h) => h.pattern === 'private-or-opt-root')).toBe(true);
    });

    it('private-or-opt-root: a GitHub Actions /opt/hostedtoolcache path', () => {
        const hits = scan_content(
            'x.mjs',
            '/opt/hostedtoolcache/node/20.0.0/x64/node_modules/yaml/index.js',
        );
        expect(hits.some((h) => h.pattern === 'private-or-opt-root')).toBe(true);
    });

    it('windows-drive: an absolute Windows path', () => {
        const hits = scan_content('x.mjs', String.raw`C:\Users\runner\project\node_modules\yaml\index.js`);
        expect(hits.some((h) => h.pattern === 'windows-drive')).toBe(true);
    });

    it('worktree-path: a .claude/worktrees/... path', () => {
        const hits = scan_content('x.mjs', 'built from .claude/worktrees/spike-cache/node_modules/yaml');
        expect(hits.some((h) => h.pattern === 'worktree-path')).toBe(true);
    });

    it('parent-relative-node-modules: the worktree-depth-drift shape (9.1 commit 5933bf1a9)', () => {
        const hits = scan_content('x.mjs', '// ../../../node_modules/yaml/dist/nodes/identity.js');
        expect(hits.some((h) => h.pattern === 'parent-relative-node-modules')).toBe(true);
    });

    it('parent-relative-node-modules: the repo-relative shape (9.1 commit f8752443b)', () => {
        const hits = scan_content('x.mjs', '// ../agent-config/node_modules/yaml/dist/nodes/identity.js');
        expect(hits.some((h) => h.pattern === 'parent-relative-node-modules')).toBe(true);
    });

    it('absolute-node-modules: an absolute path with no /Users, /home, /private, /opt prefix', () => {
        const hits = scan_content('x.mjs', '/builds/project/node_modules/yaml/index.js');
        expect(hits.some((h) => h.pattern === 'absolute-node-modules')).toBe(true);
    });

    it('absolute-sourcemap: sourceMappingURL pointing at an absolute path', () => {
        const hits = scan_content(
            'x.mjs',
            '//# sourceMappingURL=/Users/someuser/agent-config/dist/install/install.mjs.map',
        );
        expect(hits.some((h) => h.pattern === 'absolute-sourcemap')).toBe(true);
    });

    it('every declared pattern name is exercised above (catalog completeness)', () => {
        const exercised = new Set([
            'macos-linux-home',
            'private-or-opt-root',
            'windows-drive',
            'worktree-path',
            'parent-relative-node-modules',
            'absolute-node-modules',
            'absolute-sourcemap',
        ]);
        for (const p of LEAK_PATTERNS) {
            expect(exercised.has(p.name), `pattern '${p.name}' has no dedicated test above`).toBe(true);
        }
    });
});

describe('mask_snippet — redacts the username, not the finding', () => {
    it('masks a /Users/<name>/ segment', () => {
        const masked = mask_snippet('/Users/someuser/projects/agent-config/node_modules/yaml');
        expect(masked).toContain('/Users/<masked>/');
        expect(masked).not.toContain('someuser');
    });

    it('masks a /home/<name>/ segment', () => {
        const masked = mask_snippet('/home/runner/work/repo/node_modules/yaml');
        expect(masked).toContain('/home/<masked>/');
        expect(masked).not.toContain('runner');
    });

    it('masks a Windows C:\\Users\\<name>\\ segment', () => {
        const masked = mask_snippet(String.raw`C:\Users\runner\project\node_modules`);
        expect(masked).toContain(String.raw`C:\Users\<masked>`);
        expect(masked).not.toContain('runner');
    });

    it('truncates an overlong snippet', () => {
        const long = `/opt/${'a'.repeat(300)}/node_modules/`;
        const masked = mask_snippet(long);
        expect(masked.length).toBeLessThanOrEqual(141); // MAX_SNIPPET + the ellipsis char
        expect(masked.endsWith('…')).toBe(true);
    });
});

describe('format_report — groups by file+pattern and caps the listing', () => {
    it('groups multiple hits in the same file/pattern under one header', () => {
        const content = Array.from({ length: 8 }, (_, i) => `/Users/someuser/node_modules/pkg${i}/x.js`).join(
            '\n',
        );
        const hits = scan_content('dist/install/install.mjs', content);
        const report = format_report(hits);
        expect(report).toContain('dist/install/install.mjs [macos-linux-home]');
        expect(report).toContain('(+3 more)'); // 8 hits, MAX_HITS_SHOWN_PER_GROUP = 5
    });

    it('includes the pattern hint so the finding is actionable', () => {
        const hits = scan_content('x.mjs', '/Users/someuser/node_modules/pkg/x.js');
        expect(format_report(hits)).toContain('rebuild from a clean, non-worktree checkout');
    });
});

describe('parse_args — usage contract', () => {
    it('an unrecognized flag throws ExitCode(2)', () => {
        expect(() => parse_args(['--bogus'])).toThrow(ExitCode);
        try {
            parse_args(['--bogus']);
            expect.unreachable();
        } catch (exc) {
            expect(exc).toBeInstanceOf(ExitCode);
            expect((exc as InstanceType<typeof ExitCode>).code).toBe(2);
        }
    });

    it('--help throws ExitCode(0)', () => {
        try {
            parse_args(['--help']);
            expect.unreachable();
        } catch (exc) {
            expect((exc as InstanceType<typeof ExitCode>).code).toBe(0);
        }
    });

    it('positional args collect as file targets', () => {
        expect(parse_args(['a.mjs', '--quiet', 'b.mjs'])).toEqual({
            quiet: true,
            files: ['a.mjs', 'b.mjs'],
        });
    });
});

// --- Layer 2: main() against on-disk fixtures -------------------------------

describe('main — synthetic fixtures on disk (verify: red on leak, green on clean)', () => {
    let work: string;

    beforeEach(() => {
        work = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-leak-'));
    });

    afterEach(() => {
        fs.rmSync(work, { recursive: true, force: true });
    });

    it('is RED (exit 1) on a synthetic absolute-path-in-bundle fixture', () => {
        const leaked = path.join(work, 'install.mjs');
        fs.writeFileSync(
            leaked,
            [
                '// ../../../../../../../Users/someuser/projects/galawork/galawork-packages/event4u/agent-config/node_modules/yaml/dist/nodes/identity.js',
                'var require_identity = __commonJS({',
                '  "node_modules/yaml/dist/nodes/identity.js"(exports) {',
                '    "use strict";',
                '  }',
                '});',
            ].join('\n'),
        );
        expect(main([leaked])).toBe(1);
    });

    it('is GREEN (exit 0) on a clean bundle-shaped fixture', () => {
        const clean = path.join(work, 'install.mjs');
        fs.writeFileSync(
            clean,
            [
                '// node_modules/yaml/dist/nodes/identity.js',
                'var require_identity = __commonJS({',
                '  "node_modules/yaml/dist/nodes/identity.js"(exports) {',
                '    "use strict";',
                '  }',
                '});',
                'npm: "./node_modules/@event4u/agent-config/plugin/agent-config"',
            ].join('\n'),
        );
        expect(main(['--quiet', clean])).toBe(0);
    });

    it('skips a binary (non-UTF-8) fixture without crashing', () => {
        const bin = path.join(work, 'blob.bin');
        fs.writeFileSync(bin, Buffer.from([0xff, 0xfe, 0x00, 0xff, 0xd8, 0xff]));
        expect(main(['--quiet', bin])).toBe(0);
    });
});

// --- Layer 3: real-repo smoke (documents the current committed state) ------

describe('check_bundle_path_leakage — CLI contract on the real repo', () => {
    it('the actual tracked dist/install/ bundle passes the guard today', () => {
        const result = spawnSync(TSX_BIN, [TS_SCRIPT], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
            maxBuffer: 64 * 1024 * 1024,
        });
        expect(result.status, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).toContain('✅');
    });

    it('--help exits 0 with a usage line', () => {
        const result = spawnSync(TSX_BIN, [TS_SCRIPT, '--help'], { cwd: REPO_ROOT, encoding: 'utf-8' });
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('usage:');
    });

    it('an unrecognized flag exits 2', () => {
        const result = spawnSync(TSX_BIN, [TS_SCRIPT, '--nope'], { cwd: REPO_ROOT, encoding: 'utf-8' });
        expect(result.status).toBe(2);
    });
});

/**
 * Phase 0 of `road-to-inbox-harvest-2026-08-e-command-surface-legibility`: the
 * published-`.md` scope, and the pinned-exception mechanism the council chose
 * over a backtick exemption.
 */
describe('published-.md scope and the zero-unapproved floor', () => {
    it('the published roots are declared and include the projection tree', () => {
        expect(PUBLISHED_MD_ROOTS).toContain('dist/agent-src');
        expect(PUBLISHED_MD_ROOTS).toContain('docs/guidelines');
        // Every root must be a `files[]` root — a root outside the tarball would
        // scan content no consumer receives, which is scope creep dressed as rigour.
        const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { files: string[] };
        const shipped = manifest.files.filter((f) => !f.startsWith('!'));
        for (const root of PUBLISHED_MD_ROOTS) {
            expect(
                shipped.some((f) => f.replace(/\/$/, '') === root || root.startsWith(f.replace(/\/$/, ''))),
                `${root} must be inside package.json files[]`,
            ).toBe(true);
        }
    });

    it('scans a four-figure published-md population, not a handful', () => {
        // The floor a dead-scope would collapse through. Measured 947 on
        // 2026-08-24 (after narrowing `src/agent-src` to its two shipped
        // subtrees); 700 is comfortably below and far above a collapse.
        expect(tracked_published_md().length).toBeGreaterThan(700);
    });

    it('the allow file parses, strips comments, and holds only path:line keys', () => {
        const raw = fs.readFileSync(ALLOW_FILE, 'utf8');
        const set = parse_allow_file(raw);
        expect(set.size).toBeGreaterThan(0);
        for (const entry of set) {
            expect(entry, `${entry} must be <path>:<line>`).toMatch(/^[^\s:]+:\d+$/);
        }
        // Every entry carries a reason above it — the file's own contract. A bare
        // pin with no comment anywhere above it is an unaudited suppression.
        expect(raw).toMatch(/^#/m);
    });

    it('every pinned exception still matches something — a drifted pin is a defect', () => {
        // This is the mechanism's whole cost: pins are line-numbers into a
        // GENERATED tree. A pin that matches nothing suppresses nothing and hides
        // that the exception was never re-audited after the source moved.
        const pinned = parse_allow_file(fs.readFileSync(ALLOW_FILE, 'utf8'));
        const live = new Set(
            scan_files(tracked_published_md()).map((h) => `${h.file}:${String(h.line)}`),
        );
        const dead = [...pinned].filter((p) => !live.has(p));
        expect(dead, 'these pins match nothing — re-audit and move them').toEqual([]);
    });

    it('the whole gate is green on the committed tree', () => {
        expect(main(['--quiet'])).toBe(0);
    });
});
