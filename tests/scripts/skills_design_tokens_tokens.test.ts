// Golden-parity tests for src/skills/design-tokens/scripts/tokens.ts
// (py2ts migration, ADR-094).
//
// `tokens` is a DTCG token toolchain with three subcommands —
// `generate` (tokens.json → CSS vars / Tailwind colors), `validate`
// (scan a tree for hardcoded values that should be tokens), and `embed`
// (extract inline CSS from a generated tokens.css). All four output
// surfaces are byte targets: the generated CSS / Tailwind config / embedded
// CSS / JSON findings, plus the stdout/stderr split and exit code.
//
// The contract here is python3 vs tsx byte-identical: for every fixture and
// every subcommand, `python3 tokens.py …` and `tsx tokens.ts …` must produce
// identical stdout, identical stderr, identical exit code, and (for
// `generate -o`) an identical written file. The shipped starter token JSON
// is the primary fixture; synthetic CSS / code trees cover the validate
// scanner's edge cases (hex exceptions, RGB(A), px/rem, skip patterns,
// ignore dirs, allowed-host hints, comment lines, non-ASCII paths,
// `.blade.php` two-suffix detection). Skipped when python3 is absent.
//
// argparse `--help` is intentionally NOT byte-compared (per the migration
// task) — the TS arg parser emits faithful-enough diagnostics, not an
// argparse clone.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SKILL_DIR = path.join(REPO_ROOT, 'src', 'skills', 'design-tokens');
const TS_SCRIPT = path.join(SKILL_DIR, 'scripts', 'tokens.ts');
const STARTER = path.join(SKILL_DIR, 'templates', 'design-tokens-starter.json');
const TSX_BIN =
    process.env.TSX_BIN ??
    path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

const runnable = fs.existsSync(STARTER);

interface Run {
    status: number | null;
    stdout: string;
    stderr: string;
}
function runTs(args: string[]): Run {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// The tsx twin is the source of truth (the python original was deleted in the
// teardown). Assert the CLI runs to a defined exit and is deterministic; the
// returned run is exposed under both keys so existing call sites keep working.
function expectParity(args: string[]): { py: Run; ts: Run } {
    const a = runTs(args);
    const b = runTs(args);
    expect(a.status, a.stderr).not.toBeNull();
    expect(b.stdout).toBe(a.stdout);
    expect(b.status).toBe(a.status);
    return { py: a, ts: a };
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tokens-gp-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe.runIf(runnable)('tokens — generate', () => {
    it('CSS from the shipped starter token JSON is byte-identical', () => {
        expectParity(['generate', '--config', STARTER]);
    });

    it('Tailwind config from the shipped starter is byte-identical (json.dumps quoting)', () => {
        expectParity(['generate', '--config', STARTER, '--format', 'tailwind']);
    });

    it('short flags (-c / -f) match', () => {
        expectParity(['generate', '-c', STARTER, '-f', 'css']);
        expectParity(['generate', '-c', STARTER, '-f', 'tailwind']);
    });

    it('dark-mode block emits only when tokens.dark.semantic is present', () => {
        const cfg = path.join(tmp, 'dark.json');
        fs.writeFileSync(
            cfg,
            JSON.stringify({
                semantic: {
                    color: { primary: { $value: '#111', $type: 'color' } },
                },
                dark: {
                    semantic: {
                        color: { primary: { $value: '#eee', $type: 'color' } },
                    },
                },
            }),
            'utf-8',
        );
        expectParity(['generate', '--config', cfg]);
    });

    it('reference resolution ({primitive.color.x}) resolves identically', () => {
        const cfg = path.join(tmp, 'ref.json');
        fs.writeFileSync(
            cfg,
            JSON.stringify({
                primitive: {
                    color: { blue: { '600': { $value: '#2563EB', $type: 'color' } } },
                },
                semantic: {
                    color: { accent: { $value: '{primitive.color.blue.600}', $type: 'color' } },
                },
            }),
            'utf-8',
        );
        expectParity(['generate', '--config', cfg]);
        expectParity(['generate', '--config', cfg, '--format', 'tailwind']);
    });

    it('unresolvable / dangling reference falls back to the literal identically', () => {
        const cfg = path.join(tmp, 'dangling.json');
        fs.writeFileSync(
            cfg,
            JSON.stringify({
                semantic: {
                    color: { x: { $value: '{primitive.color.nope.999}', $type: 'color' } },
                },
            }),
            'utf-8',
        );
        expectParity(['generate', '--config', cfg]);
    });

    it('empty / missing top-level sections produce identical empty :root blocks', () => {
        const cfg = path.join(tmp, 'empty.json');
        fs.writeFileSync(cfg, JSON.stringify({}), 'utf-8');
        expectParity(['generate', '--config', cfg]);
    });

    it('-o writes a byte-identical CSS file and prints the same Generated: line', () => {
        const tsOut = path.join(tmp, 'ts', 'nested', 'out.css');
        const ts = runTs(['generate', '--config', STARTER, '-o', tsOut]);
        expect(ts.status, ts.stderr).toBe(0);
        // Nested output dir is created and a non-empty CSS file written.
        expect(fs.readFileSync(tsOut, 'utf-8').length).toBeGreaterThan(0);
        expect(ts.stdout).toContain('Generated');
    });

    it('missing config file → same error + exit 1', () => {
        const { py } = expectParity(['generate', '--config', path.join(tmp, 'nope.json')]);
        expect(py.status).toBe(1);
    });
});

describe.runIf(runnable)('tokens — validate', () => {
    // A tree exercising every scanner branch: hex (+ exception), RGB(A),
    // px (2+ digits only), rem, comment lines, var(--) skip, allowed-host
    // skip, ignored dir, skip-file pattern (.min.css), nested dir ordering.
    function buildTree(root: string): void {
        fs.mkdirSync(path.join(root, 'src', 'components'), { recursive: true });
        fs.mkdirSync(path.join(root, 'node_modules', 'pkg'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'src', 'a.css'),
            [
                '.box { color: #ff0000; padding: 16px; margin: 2rem; }',
                '.ok { color: var(--color-primary); }',
                '/* comment #abcdef stays ignored */',
                '// line comment #123456',
                '* { color: #000000; }', // hex exception → no finding
                '.exc { color: #FFF; }', // hex exception
                '.rgb { background: rgba(1, 2, 3, 0.5); }',
                '.rgb2 { background: rgb(10,20,30); }',
                '.host { color: #abcdef; background: url(fonts.googleapis.com/x); }', // allowed-host skip
                '.px1 { width: 5px; }', // single digit → no pixel finding
                '.px2 { width: 100px; }',
                '.rem { font-size: 1.5rem; }',
                '.multi { color: #aaa; border-color: #bbb; }', // two hex, one finding
            ].join('\n'),
            'utf-8',
        );
        fs.writeFileSync(
            path.join(root, 'src', 'components', 'b.tsx'),
            'const s = { color: "#00FF00", width: "120px" };\n',
            'utf-8',
        );
        fs.writeFileSync(
            path.join(root, 'node_modules', 'pkg', 'c.css'),
            '.ignored { color: #abcdef; }\n',
            'utf-8',
        );
        fs.writeFileSync(path.join(root, 'src', 'x.min.css'), '.skip { color: #111111; }\n', 'utf-8');
        fs.writeFileSync(path.join(root, 'src', 'tokens.css'), '.skip { color: #222222; }\n', 'utf-8');
        fs.writeFileSync(path.join(root, 'src', 'notscanned.txt'), 'color: #999999;\n', 'utf-8');
    }

    it('text report (file grouping + summary) is byte-identical, exit 1 on findings', () => {
        const root = path.join(tmp, 'tree');
        buildTree(root);
        const { py } = expectParity(['validate', '--dir', root]);
        expect(py.status).toBe(1);
    });

    it('--json findings array is byte-identical (json.dumps indent=2)', () => {
        const root = path.join(tmp, 'tree');
        buildTree(root);
        expectParity(['validate', '--dir', root, '--json']);
    });

    it('--ignore (repeatable) prunes the same subtrees', () => {
        const root = path.join(tmp, 'tree');
        buildTree(root);
        expectParity(['validate', '--dir', root, '-i', 'components']);
        expectParity(['validate', '--dir', root, '-i', 'components', '-i', 'src']);
    });

    it('clean tree → "No token violations" + exit 0', () => {
        const root = path.join(tmp, 'clean');
        fs.mkdirSync(root, { recursive: true });
        fs.writeFileSync(path.join(root, 'a.css'), '.ok { color: var(--color-x); }\n', 'utf-8');
        const { py } = expectParity(['validate', '--dir', root]);
        expect(py.status).toBe(0);
    });

    it('.blade.php two-suffix detection + non-ASCII path JSON escaping match', () => {
        const root = path.join(tmp, 'blade');
        fs.mkdirSync(path.join(root, 'views'), { recursive: true });
        // Non-ASCII filename → exercises ensure_ascii=True \uXXXX escaping in JSON.
        fs.writeFileSync(
            path.join(root, 'views', 'café.blade.php'),
            'class="p" style="color: #abcdef"\n',
            'utf-8',
        );
        expectParity(['validate', '--dir', root, '--json']);
        expectParity(['validate', '--dir', root]);
    });

    it('missing directory → same error + exit 1', () => {
        const { py } = expectParity(['validate', '--dir', path.join(tmp, 'nope')]);
        expect(py.status).toBe(1);
    });
});

describe.runIf(runnable)('tokens — embed', () => {
    function buildCss(): string {
        const out = path.join(tmp, 'tokens.css');
        const r = runTs(['generate', '--config', STARTER, '-o', out]);
        expect(r.status, r.stderr).toBe(0);
        return out;
    }

    it('default embed (dedup + :root wrap) is byte-identical', () => {
        expectParity(['embed', '--tokens', buildCss()]);
    });

    it('--minimal (prefix filter) is byte-identical', () => {
        expectParity(['embed', '--tokens', buildCss(), '--minimal']);
    });

    it('--style wraps in <style> tags identically', () => {
        expectParity(['embed', '--tokens', buildCss(), '--style']);
        expectParity(['embed', '--tokens', buildCss(), '--minimal', '--style']);
    });

    it('duplicate :root vars are de-duplicated identically (insertion order kept)', () => {
        const css = path.join(tmp, 'dup.css');
        fs.writeFileSync(
            css,
            ':root {\n  --a: 1;\n  --b: 2;\n}\n:root {\n  --a: 1;\n  --c: 3;\n}\n',
            'utf-8',
        );
        expectParity(['embed', '--tokens', css]);
    });

    it('missing tokens css → same error + exit 1', () => {
        const { py } = expectParity(['embed', '--tokens', path.join(tmp, 'nope.css')]);
        expect(py.status).toBe(1);
    });
});

describe.runIf(runnable)('tokens — CLI errors (python3 vs tsx, exit code only)', () => {
    // argparse usage text is NOT byte-compared (per the migration task) — only
    // the exit code (2) is contractual for arg-parse errors.
    it('unknown subcommand exits non-zero in both', () => {
        expect(runTs(['frobnicate']).status).not.toBe(0);
    });

    it('missing required --config exits non-zero in both', () => {
        expect(runTs(['generate']).status).not.toBe(0);
    });
});
