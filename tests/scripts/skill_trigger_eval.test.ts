// Tests for src/scripts/skill_trigger_eval.ts (py2ts Phase 8 / Wave 8b).
//
// Ports tests/test_skill_trigger_eval.py 1:1 — frontmatter parsing, triggers
// loading, metrics math, MockRouter + run_eval, AnthropicRouter with an
// injected fake client, the on-disk key gate (0600 + sk-ant- prefix), the
// confirmation gate (fake tty streams), and the dry-run CLI smoke. No test
// makes a real API call. A golden-parity layer runs python3 vs tsx for the
// `--dry-run` path against the committed eloquent pilot, comparing
// stdout/stderr/exit and the written JSON byte-for-byte (timestamp stripped).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { resolve_logical } from '../../src/scripts/_lib/agent_src.js';
import * as ste from '../../src/scripts/skill_trigger_eval.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'skill_trigger_eval.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'skill_trigger_eval.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function tmpFile(name: string, content: string, mode?: number): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ste-'));
    const p = path.join(dir, name);
    fs.writeFileSync(p, content, 'utf-8');
    if (mode !== undefined) {
        fs.chmodSync(p, mode);
    }
    return p;
}

// -- frontmatter parsing --------------------------------------------------

describe('skill_trigger_eval — frontmatter', () => {
    it('extract_field quoted', () => {
        const block = 'name: foo\ndescription: "Use when doing X"\n';
        expect(ste._extract_field(block, 'name')).toBe('foo');
        expect(ste._extract_field(block, 'description')).toBe('Use when doing X');
    });

    it('extract_field single-quoted', () => {
        expect(ste._extract_field("description: 'hello'\n", 'description')).toBe('hello');
    });

    it('extract_field missing', () => {
        expect(ste._extract_field('name: foo\n', 'description')).toBeNull();
    });

    it('parse_frontmatter reads real skill', () => {
        const p = resolve_logical('skills/eloquent/SKILL.md');
        expect(p).not.toBeNull();
        const meta = ste._parse_frontmatter(p as string);
        expect(meta).not.toBeNull();
        expect((meta as ste.SkillMeta).name).toBe('eloquent');
        expect((meta as ste.SkillMeta).description).toContain('Eloquent');
    });

    it('parse_frontmatter without frontmatter', () => {
        const p = tmpFile('no-fm.md', '# plain markdown\n');
        expect(ste._parse_frontmatter(p)).toBeNull();
    });

    it('load_skill_metas real repo', () => {
        const metas = ste.load_skill_metas();
        const names = new Set(metas.map((m) => m.name));
        for (const expected of ['eloquent', 'php-coder', 'skill-writing']) {
            expect(names.has(expected)).toBe(true);
        }
        expect(metas.every((m) => m.description)).toBe(true);
    });
});

// -- triggers.json loading ------------------------------------------------

describe('skill_trigger_eval — triggers', () => {
    it('parses pilot', () => {
        const p = tmpFile(
            'triggers.json',
            JSON.stringify({
                skill: 'demo',
                queries: [
                    { q: 'a', trigger: true },
                    { q: 'b', trigger: false },
                ],
            }),
        );
        const [skill, queries] = ste.load_triggers(p);
        expect(skill).toBe('demo');
        expect(queries.length).toBe(2);
        expect(queries[0]).toEqual(ste.Query('a', true));
    });

    it('rejects empty queries', () => {
        const p = tmpFile('triggers.json', JSON.stringify({ skill: 'demo', queries: [] }));
        expect(() => ste.load_triggers(p)).toThrow(/zero queries/);
    });
});

// -- metrics math ---------------------------------------------------------

function qr(expected: boolean, observed: boolean): ste.QueryResult {
    return { q: 'q', expected, observed, loaded_skills: [], passed: expected === observed };
}

describe('skill_trigger_eval — metrics', () => {
    it('perfect', () => {
        const m = ste.compute_metrics([qr(true, true), qr(true, true), qr(false, false), qr(false, false)]);
        expect(m.precision).toBe(1.0);
        expect(m.recall).toBe(1.0);
        expect(m.true_positive).toBe(2);
        expect(m.false_positive).toBe(0);
    });

    it('misses captured', () => {
        const m = ste.compute_metrics([qr(true, true), qr(true, false), qr(false, true), qr(false, false)]);
        expect(m.precision).toBe(0.5);
        expect(m.recall).toBe(0.5);
        expect(m.false_positive).toBe(1);
        expect(m.false_negative).toBe(1);
    });

    it('empty safe', () => {
        const m = ste.compute_metrics([]);
        expect(m.precision).toBe(0.0);
        expect(m.recall).toBe(0.0);
    });

    it('estimate_cost known model', () => {
        expect(ste.estimate_cost('claude-sonnet-4-5', 1_000_000, 1_000_000)).toBeCloseTo(18.0, 6);
    });

    it('estimate_cost unknown model falls back', () => {
        expect(ste.estimate_cost('some-new-model', 1_000_000, 0)).toBeCloseTo(3.0, 6);
    });
});

// -- MockRouter + run_eval ------------------------------------------------

describe('skill_trigger_eval — MockRouter + run_eval', () => {
    it('mock router returns configured list', () => {
        const router = new ste.MockRouter(() => ['a', 'b']);
        const [loaded, inTok, outTok] = router.route('any', [ste.SkillMeta('a', 'desc')]);
        expect(loaded).toEqual(['a', 'b']);
        expect(inTok).toBeGreaterThan(0);
        expect(outTok).toBe(16);
    });

    it('run_eval perfect', () => {
        const queries = [ste.Query('pos', true), ste.Query('neg', false)];
        const skills = [ste.SkillMeta('pilot', 'd'), ste.SkillMeta('other', 'd')];
        const decide = (q: string): string[] => (q === 'pos' ? ['pilot'] : ['other']);
        const result = ste.run_eval('pilot', queries, new ste.MockRouter(decide), skills, 'claude-sonnet-4-5');
        expect(result.router).toBe('mock');
        expect(result.metrics.precision).toBe(1.0);
        expect(result.metrics.recall).toBe(1.0);
        expect(result.queries[0]!.observed).toBe(true);
        expect(result.queries[1]!.observed).toBe(false);
    });

    it('run_eval catches false positive', () => {
        const queries = [ste.Query('pos', true), ste.Query('neg', false)];
        const skills = [ste.SkillMeta('pilot', 'd')];
        const result = ste.run_eval('pilot', queries, new ste.MockRouter(() => ['pilot']), skills);
        expect(result.metrics.recall).toBe(1.0);
        expect(result.metrics.precision).toBe(0.5);
        expect(result.metrics.false_positive).toBe(1);
    });
});

// -- AnthropicRouter with injected fake client ----------------------------

class FakeMessages {
    last_kwargs: Record<string, unknown> | null = null;
    constructor(private canned: string) {}
    create(kwargs: Record<string, unknown>): unknown {
        this.last_kwargs = kwargs;
        return { content: [{ text: this.canned }], usage: { input_tokens: 100, output_tokens: 20 } };
    }
}
class FakeClient {
    messages: FakeMessages;
    constructor(canned: string) {
        this.messages = new FakeMessages(canned);
    }
}

describe('skill_trigger_eval — AnthropicRouter', () => {
    it('parses clean json', () => {
        const client = new FakeClient('{"would_load": ["pilot", "other"]}');
        const router = new ste.AnthropicRouter({ client });
        const [loaded, inTok, outTok] = router.route('q', [ste.SkillMeta('pilot', 'd')]);
        expect(loaded).toEqual(['pilot', 'other']);
        expect(inTok).toBe(100);
        expect(outTok).toBe(20);
        expect(String(client.messages.last_kwargs!['system'])).toContain('pilot :: d');
    });

    it('tolerates code fence', () => {
        const client = new FakeClient('```json\n{"would_load": ["x"]}\n```');
        const [loaded] = new ste.AnthropicRouter({ client }).route('q', []);
        expect(loaded).toEqual(['x']);
    });

    it('parse_would_load rejects garbage', () => {
        expect(ste._parse_would_load('not json at all')).toEqual([]);
        expect(ste._parse_would_load('{"something_else": []}')).toEqual([]);
        expect(ste._parse_would_load('{"would_load": "not a list"}')).toEqual([]);
    });

    it('requires api_key or client', () => {
        expect(() => new ste.AnthropicRouter({ model: 'claude-sonnet-4-5' })).toThrow(/explicit api_key/);
    });

    it('accepts injected client', () => {
        const router = new ste.AnthropicRouter({ model: 'claude-sonnet-4-5', client: {} as never });
        expect(router).not.toBeNull();
    });
});

// -- CLI smoke (dry-run) --------------------------------------------------

describe('skill_trigger_eval — main dry-run', () => {
    it('dry-run on real pilot', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ste-out-'));
        const output = path.join(dir, 'run.json');
        const out: string[] = [];
        const origWrite = process.stdout.write.bind(process.stdout);
        (process.stdout.write as unknown) = (s: string): boolean => {
            out.push(s);
            return true;
        };
        let code: number;
        try {
            code = ste.main(['--skill', 'eloquent', '--dry-run', '--output', output]);
        } finally {
            (process.stdout.write as unknown) = origWrite;
        }
        expect(code).toBe(0);
        const captured = out.join('');
        expect(captured).toContain('Precision: 1.0');
        expect(captured).toContain('Recall:    1.0');
        const data = JSON.parse(fs.readFileSync(output, 'utf-8'));
        expect(data['skill']).toBe('eloquent');
        expect(data['router']).toBe('mock');
        expect(data['queries'].length).toBe(10);
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('exits 2 on missing triggers file', () => {
        const origWrite = process.stderr.write.bind(process.stderr);
        (process.stderr.write as unknown) = (): boolean => true;
        let code: number;
        try {
            code = ste.main(['--skill', 'nonexistent-skill-xyz', '--dry-run']);
        } finally {
            (process.stderr.write as unknown) = origWrite;
        }
        expect(code).toBe(2);
    });

    it('write_result produces valid json', () => {
        const queries = [ste.Query('x', true)];
        const skills = [ste.SkillMeta('pilot', 'd')];
        const result = ste.run_eval('pilot', queries, new ste.MockRouter(() => ['pilot']), skills);
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ste-wr-'));
        const out = path.join(dir, 'nested', 'last-run.json');
        ste.write_result(result, out);
        expect(fs.existsSync(out)).toBe(true);
        expect(JSON.parse(fs.readFileSync(out, 'utf-8'))['skill']).toBe('pilot');
        fs.rmSync(dir, { recursive: true, force: true });
    });
});

// -- key gate -------------------------------------------------------------

function writeKey(content: string, mode = 0o600): string {
    return tmpFile('k', content, mode);
}

describe('skill_trigger_eval — key gate', () => {
    it('happy path', () => {
        expect(ste.load_anthropic_key(writeKey('sk-ant-test-abc\n'))).toBe('sk-ant-test-abc');
    });

    it('missing file', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ste-k-'));
        expect(() => ste.load_anthropic_key(path.join(dir, 'absent'))).toThrow(/not found/);
    });

    it('rejects group-readable', () => {
        expect(() => ste.load_anthropic_key(writeKey('sk-ant-test\n', 0o640))).toThrow(/Unsafe permissions/);
    });

    it('rejects world-readable', () => {
        expect(() => ste.load_anthropic_key(writeKey('sk-ant-test\n', 0o644))).toThrow(/Unsafe permissions/);
    });

    it('rejects empty', () => {
        expect(() => ste.load_anthropic_key(writeKey('   \n'))).toThrow(/empty/);
    });

    it('rejects wrong prefix', () => {
        expect(() => ste.load_anthropic_key(writeKey('sk-foo-bar\n'))).toThrow(/sk-ant-/);
    });
});

// -- confirmation gate ----------------------------------------------------

class TTY {
    constructor(private line: string) {}
    isatty(): boolean {
        return true;
    }
    readline(): string {
        return this.line + '\n';
    }
}
class NonTTY {
    isatty(): boolean {
        return false;
    }
    readline(): string {
        throw new Error('readline on non-tty must never be reached');
    }
}
function strOut(): { write: (s: string) => void; flush?: () => void; value: () => string } {
    let buf = '';
    return {
        write: (s: string): void => {
            buf += s;
        },
        value: (): string => buf,
    };
}

describe('skill_trigger_eval — confirmation gate', () => {
    it('rejects non-tty', () => {
        expect(() => ste.require_confirmation('x', { stdin: new NonTTY(), stdout: strOut() })).toThrow(
            /interactive tty/,
        );
    });

    it('rejects wrong answer', () => {
        expect(() => ste.require_confirmation('x', { stdin: new TTY('y'), stdout: strOut() })).toThrow(/Aborted/);
    });

    it('rejects empty', () => {
        expect(() => ste.require_confirmation('x', { stdin: new TTY(''), stdout: strOut() })).toThrow(
            ste.ConfirmationAborted,
        );
    });

    it('case-sensitive', () => {
        expect(() => ste.require_confirmation('x', { stdin: new TTY('YES'), stdout: strOut() })).toThrow(
            ste.ConfirmationAborted,
        );
    });

    it('accepts exact yes', () => {
        const out = strOut();
        expect(() => ste.require_confirmation('banner', { stdin: new TTY('yes'), stdout: out })).not.toThrow();
        expect(out.value()).toContain('banner');
    });
});

// -- pre-estimate + summary -----------------------------------------------

describe('skill_trigger_eval — pre-estimate + summary', () => {
    it('pre_estimate_cost shape', () => {
        const skills = Array.from({ length: 10 }, (_, i) => ste.SkillMeta(`s${i}`, `desc ${i} `.repeat(5)));
        const queries = Array.from({ length: 5 }, () => ste.Query('q '.repeat(10), true));
        const [inTok, outTok, cost] = ste.pre_estimate_cost('claude-sonnet-4-5', skills, queries);
        expect(inTok).toBeGreaterThan(0);
        expect(outTok).toBeGreaterThan(0);
        expect(cost).toBeGreaterThan(0);
        const [in2, out2] = ste.pre_estimate_cost('claude-sonnet-4-5', skills, [...queries, ...queries]);
        expect(in2).toBe(2 * inTok);
        expect(out2).toBe(2 * outTok);
    });

    it('build_confirmation_summary contains key fields', () => {
        const s = ste.build_confirmation_summary({
            model: 'claude-sonnet-4-5',
            skill: 'pilot',
            query_count: 10,
            catalogue_size: 100,
            input_tokens: 12_345,
            output_tokens: 600,
            cost_usd: 0.04,
            key_path: '/tmp/anthropic.key',
        });
        expect(s).toContain('claude-sonnet-4-5');
        expect(s).toContain('pilot');
        expect(s).toContain('10');
        expect(s).toContain('12,345');
        expect(s).toContain('$0.04');
        expect(s).toContain('/tmp/anthropic.key');
    });
});

// -- main live-path gate --------------------------------------------------

describe('skill_trigger_eval — main live gate', () => {
    it('aborts when key missing', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ste-live-'));
        const errs: string[] = [];
        const origErr = process.stderr.write.bind(process.stderr);
        (process.stderr.write as unknown) = (s: string): boolean => {
            errs.push(s);
            return true;
        };
        let code: number;
        try {
            code = ste.main(['--skill', 'eloquent', '--key-path', path.join(dir, 'absent')]);
        } finally {
            (process.stderr.write as unknown) = origErr;
        }
        expect(code).toBe(2);
        expect(errs.join('')).toContain('not found');
        fs.rmSync(dir, { recursive: true, force: true });
    });
});

// --- Golden parity (python3 vs tsx) on the dry-run path ----------------------

const py3 = hasPython3();

/** Strip the volatile timestamp field before JSON diff. */
function stripTs(json: string): unknown {
    const obj = JSON.parse(json) as Record<string, unknown>;
    delete obj['timestamp'];
    return obj;
}

// The Python script does `from scripts._lib import …` / `from _lib.agent_src
// import …`, which resolve only with `src` (and the repo root) on PYTHONPATH
// — exactly the `pythonpath = ["src", "."]` pytest config. The dispatcher
// sets this in production; the golden spawn reproduces it.
const PY_ENV = { ...process.env, PYTHONPATH: `src${path.delimiter}.` };

describe.skipIf(!py3)('skill_trigger_eval — golden parity (python3 vs tsx)', () => {
    it('dry-run on eloquent pilot matches stdout/exit + written JSON', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ste-par-'));
        const pyOut = path.join(dir, 'py.json');
        const tsOut = path.join(dir, 'ts.json');

        const py = spawnSync(
            'python3',
            [PY_SCRIPT, '--skill', 'eloquent', '--dry-run', '--output', pyOut],
            { cwd: REPO_ROOT, encoding: 'utf8', env: PY_ENV },
        );
        const ts = spawnSync(
            TSX_BIN,
            [TS_SCRIPT, '--skill', 'eloquent', '--dry-run', '--output', tsOut],
            { cwd: REPO_ROOT, encoding: 'utf8' },
        );

        expect(ts.status, ts.stderr).toBe(py.status);
        // stdout differs only on the trailing "Wrote: <path>" line (different
        // tmp paths) and is otherwise identical; compare with the path line
        // normalized away.
        const norm = (s: string): string =>
            s.replace(/^Wrote: .*$/m, 'Wrote: <path>').replace(/[\r]/g, '');
        expect(norm(ts.stdout)).toBe(norm(py.stdout));
        expect(ts.stderr).toBe(py.stderr);

        expect(stripTs(fs.readFileSync(tsOut, 'utf-8'))).toEqual(
            stripTs(fs.readFileSync(pyOut, 'utf-8')),
        );
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('missing triggers file matches stderr + exit', () => {
        const py = spawnSync(
            'python3',
            [PY_SCRIPT, '--skill', 'nonexistent-skill-xyz', '--dry-run'],
            { cwd: REPO_ROOT, encoding: 'utf8', env: PY_ENV },
        );
        const ts = spawnSync(
            TSX_BIN,
            [TS_SCRIPT, '--skill', 'nonexistent-skill-xyz', '--dry-run'],
            { cwd: REPO_ROOT, encoding: 'utf8' },
        );
        expect(ts.status, ts.stderr).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);
    });
});
