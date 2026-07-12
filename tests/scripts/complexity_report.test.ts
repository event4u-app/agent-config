// Tests for src/scripts/complexity_report.ts (roadmap: feedback-8-11 Phase 5 —
// lightweight complexity report, council-adjudicated: report-only soft
// ratchet, no per-feature declaration duty, with a kill criterion).
//
// Every counter takes an explicit root/path argument, so every test here
// points the counters at small, disposable fixture trees under a tmpdir —
// fully deterministic, no dependency on the real repo's current shape.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as cr from '../../src/scripts/complexity_report.js';

let tmpDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'complexity-report-test-'));
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

function write(rel: string, content: string): string {
    const p = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf-8');
    return p;
}

describe('countSettingsAxes', () => {
    it('counts top-level keys plus second-level keys of mapping values', () => {
        const p = write(
            'settings.yml',
            [
                'a: 1', // scalar top-level — contributes 0 second-level
                'b:', // mapping with 2 keys
                '  x: 1',
                '  y: 2',
                'c:', // list — contributes 0 second-level
                '  - one',
                '  - two',
            ].join('\n'),
        );
        const res = cr.countSettingsAxes(p);
        expect(res.top).toBe(3);
        expect(res.second).toBe(2);
        expect(res.total).toBe(5);
    });

    it('handles a missing file without throwing', () => {
        const res = cr.countSettingsAxes(path.join(tmpDir, 'does-not-exist.yml'));
        expect(res.total).toBe(0);
        expect(res.method).toMatch(/not found/i);
    });
});

describe('countRuntimeStateSurfaces', () => {
    it('finds distinct state surfaces via both literal shapes, ignores punctuation-only matches', () => {
        write(
            'src/a.ts',
            [
                "const P1 = 'agents/runtime/state/hot-context.md';",
                "const P2 = path.join(root, 'agents', 'runtime', 'state', 'audit');",
                "const P3 = 'agents/runtime/state/audit'; // duplicate dir, counted once",
                '// cites agents/runtime/state/… as documentation shorthand (punctuation only, dropped)',
            ].join('\n'),
        );
        write('src/b.ts', "const P4 = 'agents/runtime/state/toolchain.json';");
        const res = cr.countRuntimeStateSurfaces(path.join(tmpDir, 'src'));
        expect(res.names).toEqual(['audit', 'hot-context.md', 'toolchain.json']);
        expect(res.count).toBe(3);
    });

    it('excludes its own source file from the scan (self-referential guard)', () => {
        write('src/complexity_report.ts', "const example = 'agents/runtime/state/self-noise.json';");
        write('src/real.ts', "const P = 'agents/runtime/state/real-file.json';");
        const res = cr.countRuntimeStateSurfaces(path.join(tmpDir, 'src'));
        expect(res.names).toEqual(['real-file.json']);
    });

    it('returns zero on an empty tree', () => {
        fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
        const res = cr.countRuntimeStateSurfaces(path.join(tmpDir, 'src'));
        expect(res.count).toBe(0);
        expect(res.names).toEqual([]);
    });
});

describe('countDependencyEdges', () => {
    it('prefers a usable discovery-graph cache when present', () => {
        write(
            'agents/runtime/state/discovery-graph-v1.json',
            JSON.stringify({
                schema_version: 1,
                source_checksum: 'sha256:x',
                nodes: ['a', 'b', 'c'],
                edges: [
                    { from: 'a', to: 'b', rel: 'routes_to', confidence: 'EXTRACTED' },
                    { from: 'b', to: 'c', rel: 'routes_to', confidence: 'EXTRACTED' },
                ],
            }),
        );
        const res = cr.countDependencyEdges(tmpDir);
        expect(res.source).toBe('graph-cache');
        expect(res.count).toBe(2);
    });

    it('falls back to the import proxy between top-level src/scripts modules when no cache exists', () => {
        write('src/scripts/foo.ts', "import { bar } from './bar.js';\nimport { helper } from './_lib/helper.js';\n");
        write('src/scripts/bar.ts', "export const bar = 1;\nimport './baz.js';\n");
        write('src/scripts/baz.ts', 'export const baz = 1;');
        write('src/scripts/_lib/helper.ts', 'export const helper = 1;');
        const res = cr.countDependencyEdges(tmpDir);
        expect(res.source).toBe('import-proxy');
        // foo -> bar, bar -> baz. The _lib/helper import is excluded (not a
        // top-level module) and does not count as an edge.
        expect(res.count).toBe(2);
        expect(res.method).toMatch(/no usable discovery-graph cache/i);
    });

    it('ignores a graph cache that fails to parse and falls back to the proxy', () => {
        write('agents/runtime/state/discovery-graph-v1.json', '{ not valid json');
        write('src/scripts/foo.ts', "import { bar } from './bar.js';");
        write('src/scripts/bar.ts', 'export const bar = 1;');
        const res = cr.countDependencyEdges(tmpDir);
        expect(res.source).toBe('import-proxy');
        expect(res.count).toBe(1);
    });

    it('returns zero edges when src/scripts does not exist', () => {
        const res = cr.countDependencyEdges(tmpDir);
        expect(res.source).toBe('import-proxy');
        expect(res.count).toBe(0);
    });
});

describe('countAlwaysRuleBytes', () => {
    it('prefers dist/router.json kernel + dist/agent-src/rules when usable', () => {
        write('dist/router.json', JSON.stringify({ kernel: ['rule-a', 'rule-b'], tier_1: [] }));
        const bodyA = '---\ntype: "always"\n---\n\n# Rule A\ncontent';
        const bodyB = '---\ntype: "always"\n---\n\n# Rule B\nmore content here';
        write('dist/agent-src/rules/rule-a.md', bodyA);
        write('dist/agent-src/rules/rule-b.md', bodyB);
        // A tier_1 rule the router does NOT mark always — must not be counted.
        write('dist/agent-src/rules/rule-c.md', '---\ntype: "auto"\n---\n\n# Rule C\nshould not count');

        const res = cr.countAlwaysRuleBytes(tmpDir);
        expect(res.count).toBe(2);
        expect(res.ids.sort()).toEqual(['rule-a', 'rule-b']);
        expect(res.bytes).toBe(Buffer.byteLength(bodyA, 'utf-8') + Buffer.byteLength(bodyB, 'utf-8'));
        expect(res.method).toMatch(/router\.json/);
    });

    it('falls back to src/rules frontmatter when dist/router.json is absent', () => {
        const bodyAlways = '---\ntype: "always"\ndescription: "x"\n---\n\n# Always rule\ncontent here';
        write('src/rules/always-one.md', bodyAlways);
        write('src/rules/auto-one.md', '---\ntype: "auto"\n---\n\n# Auto rule\nshould not count');

        const res = cr.countAlwaysRuleBytes(tmpDir);
        expect(res.count).toBe(1);
        expect(res.ids).toEqual(['always-one']);
        expect(res.bytes).toBe(Buffer.byteLength(bodyAlways, 'utf-8'));
        expect(res.method).toMatch(/unavailable/i);
    });

    it('returns zero when neither source is present', () => {
        const res = cr.countAlwaysRuleBytes(tmpDir);
        expect(res.count).toBe(0);
        expect(res.bytes).toBe(0);
        expect(res.ids).toEqual([]);
    });
});

describe('countGateMentions', () => {
    it('counts whole-word case-insensitive gate mentions and averages per file', () => {
        write('directives/backend/plan.ts', '/** Gate on analyze. */\nconst gateCheck = true; // gate again');
        write('directives/backend/test.ts', 'no mentions here at all');
        write('directives/ui/audit.ts', 'const delegate = 1; // "delegate" must not match "gate" (word boundary)');
        const res = cr.countGateMentions(path.join(tmpDir, 'directives'));
        expect(res.files).toBe(3);
        expect(res.total).toBe(3); // 2 in plan.ts, 0 in test.ts, 0 in audit.ts ("delegate" excluded)
        expect(res.perFile).toBeCloseTo(1, 5);
    });

    it('returns zero on an empty tree', () => {
        fs.mkdirSync(path.join(tmpDir, 'directives'), { recursive: true });
        const res = cr.countGateMentions(path.join(tmpDir, 'directives'));
        expect(res.total).toBe(0);
        expect(res.files).toBe(0);
        expect(res.perFile).toBe(0);
    });
});

describe('parsePreviousSnapshot + renderReport round-trip', () => {
    function mkSnapshot(overrides: Partial<cr.Snapshot> = {}): cr.Snapshot {
        return {
            schema_version: 1,
            generated_at: '2026-01-01',
            settings_axes: { top: 1, second: 1, total: 2, method: 'm' },
            runtime_state: { count: 1, names: ['a'], method: 'm' },
            dependency_edges: { count: 1, source: 'import-proxy', method: 'm' },
            always_rule_bytes: { count: 1, bytes: 100, ids: ['a'], method: 'm' },
            gate_mentions: { total: 1, files: 1, perFile: 1, method: 'm' },
            ...overrides,
        };
    }

    it('renders the kill criterion verbatim', () => {
        const text = cr.renderReport(mkSnapshot(), null);
        expect(text).toContain(cr.KILL_CRITERION);
        expect(text).toContain(
            'Kill criterion: if this report is cited by zero decisions (ADR/roadmap/PR) within 3 releases, delete the script and record the honest null.',
        );
    });

    it('shows "baseline run" with no delta table when there is no previous report', () => {
        const text = cr.renderReport(mkSnapshot(), null);
        expect(text).toMatch(/baseline run/i);
        expect(text).not.toMatch(/\| Metric \| Previous \| Current \| Δ \|/);
    });

    it('round-trips through the embedded raw block and renders a delta table', () => {
        const previous = mkSnapshot({ generated_at: '2026-01-01' });
        const previousText = cr.renderReport(previous, null);
        const parsed = cr.parsePreviousSnapshot(previousText);
        expect(parsed).not.toBeNull();
        expect(parsed).toEqual(previous);

        const current = mkSnapshot({
            generated_at: '2026-02-01',
            settings_axes: { top: 2, second: 1, total: 3, method: 'm' },
            always_rule_bytes: { count: 1, bytes: 150, ids: ['a'], method: 'm' },
        });
        const currentText = cr.renderReport(current, parsed);
        expect(currentText).toContain('Previous report generated: 2026-01-01.');
        expect(currentText).toContain('| Active settings axes | 2 | 3 | +1 |');
        expect(currentText).toContain('| Always-loaded rule bytes | 100 | 150 | +50 |');
        expect(currentText).toContain('| Runtime-state surfaces | 1 | 1 | 0 |');
    });

    it('parsePreviousSnapshot returns null for text with no embedded block', () => {
        expect(cr.parsePreviousSnapshot('# Just a report\n\nno raw block here')).toBeNull();
    });

    it('parsePreviousSnapshot returns null for a corrupted embedded block', () => {
        const text = '# Report\n\n<!-- complexity-report-raw\n{ not valid json\n-->\n';
        expect(cr.parsePreviousSnapshot(text)).toBeNull();
    });
});

describe('parseArgs', () => {
    it('defaults to the repo root and default out path', () => {
        const args = cr.parseArgs([]);
        expect(args.root).toBe(cr.REPO_ROOT);
        expect(args.out).toBe(cr.DEFAULT_OUT);
        expect(args.quiet).toBe(false);
    });

    it('derives --out from --root when --out is not explicitly given', () => {
        const args = cr.parseArgs(['--root', tmpDir]);
        expect(args.root).toBe(tmpDir);
        expect(args.out).toBe(path.join(tmpDir, 'internal', 'reports', 'complexity-report.md'));
    });

    it('accepts an explicit --out override alongside --root', () => {
        const outPath = path.join(tmpDir, 'custom.md');
        const args = cr.parseArgs(['--root', tmpDir, '--out', outPath, '--quiet']);
        expect(args.out).toBe(outPath);
        expect(args.quiet).toBe(true);
    });
});

describe('main — end to end over a fixture root', () => {
    function seedFixtureRoot(): void {
        write(
            'src/config/agent-settings.template.yml',
            ['profile:', '  id: developer', 'quality:', '  local_auto_run: false', 'flag: true'].join('\n'),
        );
        write('src/scripts/one.ts', "import { two } from './two.js';\nconst s = 'agents/runtime/state/example.json';");
        write('src/scripts/two.ts', 'export const two = 1;');
        write('src/rules/always-a.md', '---\ntype: "always"\n---\n\n# Always A\nbody');
        write('src/agent-src/templates/scripts/work_engine/directives/backend/plan.ts', '// Gate on analyze.\nconst g = 1; // gate');
    }

    it('writes a report, exits 0, and is idempotent (a second quiet run overwrites cleanly)', () => {
        seedFixtureRoot();
        const code1 = cr.main(['--root', tmpDir, '--quiet']);
        expect(code1).toBe(0);
        const outPath = path.join(tmpDir, 'internal', 'reports', 'complexity-report.md');
        expect(fs.existsSync(outPath)).toBe(true);
        const firstText = fs.readFileSync(outPath, 'utf-8');
        expect(firstText).toContain(cr.KILL_CRITERION);
        expect(firstText).toMatch(/baseline run/i);

        const code2 = cr.main(['--root', tmpDir, '--quiet']);
        expect(code2).toBe(0);
        const secondText = fs.readFileSync(outPath, 'utf-8');
        // Second run finds the first run's embedded snapshot and renders a
        // delta table instead of "baseline run".
        expect(secondText).toContain('Previous report generated:');
        expect(secondText).toMatch(/\| Metric \| Previous \| Current \| Δ \|/);
    });

    it('always returns exit code 0 even when the settings template is missing', () => {
        // No fixture seeded at all — every counter degrades to its empty/absent case.
        const code = cr.main(['--root', tmpDir, '--quiet']);
        expect(code).toBe(0);
        const outPath = path.join(tmpDir, 'internal', 'reports', 'complexity-report.md');
        expect(fs.existsSync(outPath)).toBe(true);
    });

    it('prints the wrote-report line to stdout unless --quiet is passed', () => {
        seedFixtureRoot();
        const writes: string[] = [];
        const spy = (chunk: unknown): boolean => {
            writes.push(String(chunk));
            return true;
        };
        const original = process.stdout.write.bind(process.stdout);
        process.stdout.write = spy as typeof process.stdout.write;
        try {
            cr.main(['--root', tmpDir]);
        } finally {
            process.stdout.write = original;
        }
        expect(writes.join('')).toMatch(/wrote .*complexity-report\.md/);
    });
});
