
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _candidate_paths,
    _is_roadmap_touch,
    _module,
    _package_roots,
    _relativize,
    run,
} from '../../../src/scripts/roadmap_progress_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'roadmap_progress_hook.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasTsx(): boolean {
    return fs.existsSync(TSX_BIN);
}
const tsx = hasTsx();

// Restore the default _package_roots after every test (parallels pytest's
// monkeypatch teardown).
const DEFAULT_PACKAGE_ROOTS = _package_roots;
afterEach(() => {
    _module._package_roots = DEFAULT_PACKAGE_ROOTS;
});

// ── consumer_root fixture: a sentinel .ts regenerator that writes a marker ──

function makeConsumerRoot(): { root: string; marker: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-progress-'));
    const scriptsDir = path.join(root, '.augment', 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    const marker = path.join(root, 'regen.marker');
    const script = path.join(scriptsDir, 'update_roadmap_progress.ts');
    fs.writeFileSync(
        script,
        "import fs from 'node:fs';\n" +
            `fs.writeFileSync(${JSON.stringify(marker)}, 'ok');\n` +
            'process.exit(0);\n',
    );
    return { root, marker };
}

function payload(
    tool: string,
    opts: { paths?: string[]; file_changes?: Array<Record<string, unknown>> } = {},
): string {
    const body: Record<string, unknown> = { hook_event_name: 'PostToolUse', tool_name: tool };
    if (opts.paths !== undefined) {
        body['tool_input'] = opts.paths.length ? { path: opts.paths[0] } : {};
    }
    if (opts.file_changes !== undefined) {
        body['file_changes'] = opts.file_changes;
    }
    return JSON.stringify(body);
}

let cleanup: string[] = [];
beforeEach(() => {
    cleanup = [];
});
afterEach(() => {
    for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true });
});

function consumerRoot(): { root: string; marker: string } {
    const made = makeConsumerRoot();
    cleanup.push(made.root);
    return made;
}

// ── path filter ──────────────────────────────────────────────────────

describe('roadmap_progress — _is_roadmap_touch', () => {
    it.each([
        ['agents/roadmaps/my-feature.md', true],
        ['./agents/roadmaps/my-feature.md', true],
        ['agents/roadmaps/archive/old.md', false],
        ['agents/roadmaps/skipped/abandoned.md', false],
        ['agents/roadmaps-progress.md', false],
        ['agents/roadmaps/README.md', true],
        ['agents/settings/contexts/some-doc.md', false],
        ['src/foo.php', false],
        ['agents/roadmaps/notes.txt', false],
    ])('%s → %s', (p, expected) => {
        expect(_is_roadmap_touch(p as string)).toBe(expected);
    });
});

// ── candidate path extraction ────────────────────────────────────────

describe('roadmap_progress — _candidate_paths', () => {
    it('prefers file_changes', () => {
        const parsed = JSON.parse(
            payload('str-replace-editor', {
                paths: ['agents/roadmaps/foo.md'],
                file_changes: [{ path: 'agents/roadmaps/bar.md', changeType: 'edit' }],
            }),
        );
        const paths = _candidate_paths(parsed);
        expect(paths).toContain('agents/roadmaps/bar.md');
        expect(paths).toContain('agents/roadmaps/foo.md');
    });

    it('handles missing fields', () => {
        expect(_candidate_paths({})).toEqual([]);
        expect(_candidate_paths({ tool_input: 'not-a-dict' })).toEqual([]);
    });
});

// ── run() — full hook behaviour (needs python3 for the sentinel regen) ──

describe.skipIf(!tsx)('roadmap_progress — run()', () => {
    it('regenerates on roadmap str-replace', () => {
        const { root, marker } = consumerRoot();
        const stdin = payload('str-replace-editor', {
            file_changes: [{ path: 'agents/roadmaps/my-feature.md', changeType: 'edit' }],
        });
        expect(run(stdin, { consumer_root: root })).toBe(0);
        expect(fs.existsSync(marker)).toBe(true);
    });

    it('regenerates on save-file', () => {
        const { root, marker } = consumerRoot();
        const stdin = payload('save-file', { paths: ['agents/roadmaps/new.md'] });
        expect(run(stdin, { consumer_root: root })).toBe(0);
        expect(fs.existsSync(marker)).toBe(true);
    });

    it('skips when tool is not a writer', () => {
        const { root, marker } = consumerRoot();
        const stdin = payload('view', { file_changes: [{ path: 'agents/roadmaps/x.md' }] });
        expect(run(stdin, { consumer_root: root })).toBe(0);
        expect(fs.existsSync(marker)).toBe(false);
    });

    it('skips when path is outside roadmaps', () => {
        const { root, marker } = consumerRoot();
        const stdin = payload('save-file', { paths: ['src/foo.php'] });
        expect(run(stdin, { consumer_root: root })).toBe(0);
        expect(fs.existsSync(marker)).toBe(false);
    });

    it('skips archive paths', () => {
        const { root, marker } = consumerRoot();
        const stdin = payload('str-replace-editor', {
            file_changes: [{ path: 'agents/roadmaps/archive/old.md' }],
        });
        expect(run(stdin, { consumer_root: root })).toBe(0);
        expect(fs.existsSync(marker)).toBe(false);
    });

    it('skips dashboard itself', () => {
        const { root, marker } = consumerRoot();
        const stdin = payload('save-file', { paths: ['agents/roadmaps-progress.md'] });
        expect(run(stdin, { consumer_root: root })).toBe(0);
        expect(fs.existsSync(marker)).toBe(false);
    });

    it('handles malformed / empty stdin', () => {
        const { root, marker } = consumerRoot();
        expect(run('not json {', { consumer_root: root })).toBe(0);
        expect(run('', { consumer_root: root })).toBe(0);
        expect(fs.existsSync(marker)).toBe(false);
    });

    it('handles missing regenerator (empty package root) → no-op exit 0', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-noregen-'));
        cleanup.push(root);
        const emptyPkg = path.join(root, 'empty-pkg');
        fs.mkdirSync(emptyPkg);
        _module._package_roots = () => [emptyPkg];
        const stdin = payload('save-file', { paths: ['agents/roadmaps/x.md'] });
        expect(run(stdin, { consumer_root: root })).toBe(0);
    });

    it('regenerates from package root for global-only consumer', () => {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-global-'));
        cleanup.push(base);
        const consumer = path.join(base, 'consumer');
        fs.mkdirSync(path.join(consumer, 'agents', 'roadmaps'), { recursive: true });

        const pkg = path.join(base, 'global-pkg');
        const pkgScripts = path.join(pkg, 'dist/agent-src', 'scripts');
        fs.mkdirSync(pkgScripts, { recursive: true });
        const marker = path.join(base, 'pkg-regen.marker');
        fs.writeFileSync(
            path.join(pkgScripts, 'update_roadmap_progress.ts'),
            "import fs from 'node:fs';\n" +
                `fs.writeFileSync(${JSON.stringify(marker)}, 'ok');\n` +
                'process.exit(0);\n',
        );

        const prevEnv = process.env['AGENT_CONFIG_PACKAGE_ROOT'];
        process.env['AGENT_CONFIG_PACKAGE_ROOT'] = pkg;
        try {
            const absPath = path.join(consumer, 'agents', 'roadmaps', 'my-feature.md');
            const stdin = JSON.stringify({
                hook_event_name: 'PostToolUse',
                tool_name: 'Edit',
                tool_input: { file_path: absPath },
            });
            expect(run(stdin, { consumer_root: consumer })).toBe(0);
            expect(fs.existsSync(marker)).toBe(true);
        } finally {
            if (prevEnv === undefined) delete process.env['AGENT_CONFIG_PACKAGE_ROOT'];
            else process.env['AGENT_CONFIG_PACKAGE_ROOT'] = prevEnv;
        }
    });

    it('remote path variants (./-prefix, backslash) normalise', () => {
        const { root, marker } = consumerRoot();
        for (const p of ['./agents/roadmaps/x.md', 'agents\\roadmaps\\x.md']) {
            if (fs.existsSync(marker)) fs.rmSync(marker);
            expect(run(payload('save-file', { paths: [p] }), { consumer_root: root })).toBe(0);
            expect(fs.existsSync(marker)).toBe(true);
        }
    });

    it('regenerates on absolute claude file_path', () => {
        const { root, marker } = consumerRoot();
        const absPath = path.join(root, 'agents', 'roadmaps', 'my-feature.md');
        const stdin = JSON.stringify({
            hook_event_name: 'PostToolUse',
            tool_name: 'Edit',
            tool_input: { file_path: absPath },
        });
        expect(run(stdin, { consumer_root: root })).toBe(0);
        expect(fs.existsSync(marker)).toBe(true);
    });
});

// ── _relativize ──────────────────────────────────────────────────────

describe('roadmap_progress — _relativize', () => {
    it('makes absolute project-relative', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-rel-'));
        cleanup.push(root);
        const abs = path.join(root, 'agents', 'roadmaps', 'x.md');
        expect(_relativize(abs, root)).toBe('agents/roadmaps/x.md');
    });

    it('leaves relative untouched', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-rel2-'));
        cleanup.push(root);
        expect(_relativize('agents/roadmaps/x.md', root)).toBe('agents/roadmaps/x.md');
    });

    it('leaves out-of-tree absolute untouched', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-rel3-'));
        cleanup.push(root);
        const other = path.join(path.dirname(root), 'elsewhere', 'agents', 'roadmaps', 'x.md');
        expect(_relativize(other, root)).toBe(other);
    });
});

// ── Golden parity vs python3 ─────────────────────────────────────────

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
    markerExists: boolean;
}

// Build a consumer dir with a sentinel .py regenerator whose marker lives
// INSIDE the consumer dir (so the two parity dirs stay isolated).
function makeParityDir(prefix: string): { dir: string; marker: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    const scriptsDir = path.join(dir, '.augment', 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    const marker = path.join(dir, 'regen.marker');
    fs.writeFileSync(
        path.join(scriptsDir, 'update_roadmap_progress.py'),
        'import pathlib, sys\n' +
            `pathlib.Path('regen.marker').write_text('ok')\n` +
            'sys.exit(0)\n',
    );
    return { dir, marker };
}
