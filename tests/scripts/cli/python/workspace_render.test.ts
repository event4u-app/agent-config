// Golden-parity tests for src/cli/python/workspace_render.ts (py2ts ADR-200 —
// the role-prompt placeholder renderer).
//
// Strategy: run `python3 src/cli/python/workspace_render.py` vs
// `tsx src/cli/python/workspace_render.ts` on deterministic surfaces over temp
// role-fixture roots and byte-compare stdout / stderr / exit. The renderer is
// read-only (it reads a prompt file + a JSON input map, writes only to
// stdout/stderr). The suite NEVER touches the real repo's `agents/roles`.
//
// COLUMNS=200 is forced for both languages so argparse emits single-line usage
// (otherwise the usage line in arg-error stderr re-wraps to terminal width).
// The `--help` per-flag BODY is NOT byte-compared (porting contract); only the
// usage line in arg-error stderr is. The malformed-JSON path prints a full
// Python traceback (TS prints a JS stack) — only exit code is asserted there.
//
// pyStr/float strategy: inputs are parsed with int/float distinction preserved
// (a JSON `5` renders "5", `5.0` renders "5.0", `true` renders "True"), so the
// numeric/bool input cases below pin that mirroring against python3.
//
// _validate_cli_root requires the `--root` dir to be NAMED `roles`, so every
// fixture passes `--root <tmp>/roles`.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// tests/scripts/cli/python/workspace_render.test.ts → repo root is five hops up.
const REPO_ROOT = path.resolve(
    fileURLToPath(import.meta.url),
    '..',
    '..',
    '..',
    '..',
    '..',
);
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_render.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_render.py');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

// COLUMNS=200 → argparse single-line usage; PYTHONPATH so the py module imports.
function runPy(args: string[], cwd: string, stdin?: string): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        input: stdin,
        env: { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src'), COLUMNS: '200' },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], cwd: string, stdin?: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        input: stdin,
        env: { ...process.env, COLUMNS: '200' },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Replace temp roots (raw + realpath) with `<TMP>` so the differential is
 * machine-stable (SystemExit messages echo the temp `--root`). */
function norm(text: string, roots: string[]): string {
    let out = text;
    for (const root of roots) {
        out = out.split(root).join('<TMP>');
        let real = root;
        try {
            real = fs.realpathSync(root);
        } catch {
            /* root may already be removed */
        }
        out = out.split(real).join('<TMP>');
    }
    return out;
}

/** Assert py and ts agree byte-for-byte (after path normalization) + same exit. */
function expectParity(args: string[], cwd: string, roots: string[], stdin?: string): void {
    const p = runPy(args, cwd, stdin);
    const t = runTs(args, cwd, stdin);
    expect(t.status).toBe(p.status);
    expect(norm(t.stdout, roots)).toBe(norm(p.stdout, roots));
    expect(norm(t.stderr, roots)).toBe(norm(p.stderr, roots));
}

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'render-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

/** A `<tmp>/roles/<role>/prompts/<name>.md` fixture with frontmatter + body. */
function writePrompt(role: string, name: string, content: string): string {
    const dir = path.join(tmp, 'roles', role, 'prompts');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.md`), content);
    return path.join(tmp, 'roles');
}

const MEMO = `---
name: memo-x
intent: write a memo
inputs:
  - name: ctx
    required: true
    shape: one-paragraph context
  - name: extra
    required: false
    shape: budget, deadline
output_shape: a memo
skill_hint: scenario-modeling
---
Memo about {{ctx}} with {{ extra }}.
`;

// ---------------------------------------------------------------------------
// Usage / argument errors.
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('render — argument errors', () => {
    it('top -h: exit 0, usage token on stdout', () => {
        const p = runPy(['-h'], tmp);
        const t = runTs(['-h'], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(0);
        expect(t.stdout.startsWith('usage: workspace_render [-h] {render,inspect} ...')).toBe(
            true,
        );
        expect(p.stdout.startsWith('usage: workspace_render [-h] {render,inspect} ...')).toBe(
            true,
        );
    });

    it('no args: exit 2 + byte-identical usage+error stderr', () => {
        expectParity([], tmp, [tmp]);
    });

    it('bad subcommand: exit 2 + byte-identical stderr', () => {
        expectParity(['frob'], tmp, [tmp]);
    });

    it('render missing both required: exit 2 + byte-identical stderr', () => {
        expectParity(['render'], tmp, [tmp]);
    });

    it('render missing --prompt: exit 2 + byte-identical stderr', () => {
        expectParity(['render', '--role', 'x'], tmp, [tmp]);
    });

    it('inspect missing --role: exit 2 + byte-identical stderr', () => {
        expectParity(['inspect', '--prompt', 'y'], tmp, [tmp]);
    });

    it('render stray positional: exit 2 unrecognized', () => {
        expectParity(['render', '--role', 'a', '--prompt', 'b', 'stray'], tmp, [tmp]);
    });

    it('inspect with --inputs-json (unrecognized, original order)', () => {
        expectParity(['inspect', '--role', 'x', '--prompt', 'y', '--inputs-json', '-'], tmp, [
            tmp,
        ]);
    });
});

// ---------------------------------------------------------------------------
// --root validation (SystemExit).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('render — --root validation', () => {
    it('root not named roles: SystemExit, exit 1, byte-identical (path normalized)', () => {
        const notroles = path.join(tmp, 'notroles');
        fs.mkdirSync(notroles, { recursive: true });
        expectParity(['inspect', '--root', notroles, '--role', 'x', '--prompt', 'y'], tmp, [tmp]);
    });

    it('root named roles but prompt missing: PromptError via SystemExit, exit 1', () => {
        const root = path.join(tmp, 'roles');
        fs.mkdirSync(root, { recursive: true });
        expectParity(['inspect', '--root', root, '--role', 'x', '--prompt', 'y'], tmp, [tmp]);
    });
});

// ---------------------------------------------------------------------------
// render — happy paths.
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('render — happy paths', () => {
    it('section (text) with required + optional, optional absent', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expectParity(
            ['render', '--root', root, '--role', 'leadership', '--prompt', 'memo', '--inputs-json', '-'],
            tmp,
            [tmp],
            '{"ctx":"a budget"}',
        );
    });

    it('--json output', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expectParity(
            [
                'render',
                '--root',
                root,
                '--role',
                'leadership',
                '--prompt',
                'memo',
                '--json',
                '--inputs-json',
                '-',
            ],
            tmp,
            [tmp],
            '{"ctx":"a budget","extra":"and a deadline"}',
        );
    });

    it('--inputs-json from a FILE', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        const f = path.join(tmp, 'inputs.json');
        fs.writeFileSync(f, '{"ctx":"file ctx","extra":"file extra"}');
        expectParity(
            ['render', '--root', root, '--role', 'leadership', '--prompt', 'memo', '--inputs-json', f],
            tmp,
            [tmp],
        );
    });

    it('no --inputs-json at all → empty map (required missing → error)', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expectParity(
            ['render', '--root', root, '--role', 'leadership', '--prompt', 'memo'],
            tmp,
            [tmp],
        );
    });

    it('empty stdin → empty map (required missing → error)', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expectParity(
            ['render', '--root', root, '--role', 'leadership', '--prompt', 'memo', '--inputs-json', '-'],
            tmp,
            [tmp],
            '   \n  ',
        );
    });
});

// ---------------------------------------------------------------------------
// render — value-type mirroring (int vs float vs bool vs null vs string).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('render — pyStr value mirroring', () => {
    const ONE = `---
name: one
intent: i
inputs:
  - name: ctx
    required: true
    shape: s
  - name: v
    required: false
    shape: s
---
ctx={{ctx}} v={{v}}
`;

    function caseFor(json: string): void {
        const root = writePrompt('r', 'one', ONE);
        expectParity(
            ['render', '--root', root, '--role', 'r', '--prompt', 'one', '--inputs-json', '-'],
            tmp,
            [tmp],
            json,
        );
    }

    it('integer input → no trailing .0', () => caseFor('{"ctx":"x","v":5}'));
    it('integral float input → trailing .0', () => caseFor('{"ctx":"x","v":5.0}'));
    it('decimal float input', () => caseFor('{"ctx":"x","v":5.5}'));
    it('large integer input → full precision', () =>
        caseFor('{"ctx":"x","v":100000000000000000000}'));
    it('boolean true → True', () => caseFor('{"ctx":"x","v":true}'));
    it('boolean false → False', () => caseFor('{"ctx":"x","v":false}'));
    it('null optional → empty string', () => caseFor('{"ctx":"x","v":null}'));
    it('scientific float → Python repr', () => caseFor('{"ctx":"x","v":1e3}'));
    it('negative integer', () => caseFor('{"ctx":"x","v":-42}'));
});

// ---------------------------------------------------------------------------
// render — template / input errors (PromptError → stderr, exit 1).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('render — PromptError paths', () => {
    it('missing required input (blank string also counts)', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expectParity(
            ['render', '--root', root, '--role', 'leadership', '--prompt', 'memo', '--inputs-json', '-'],
            tmp,
            [tmp],
            '{"ctx":"   "}',
        );
    });

    it('undeclared placeholder in template', () => {
        const root = writePrompt(
            'r',
            'bad',
            `---
name: bad
inputs:
  - name: ctx
    required: true
    shape: s
---
Hi {{ctx}} and {{nope}} and {{alsobad}}.
`,
        );
        expectParity(
            ['render', '--root', root, '--role', 'r', '--prompt', 'bad', '--inputs-json', '-'],
            tmp,
            [tmp],
            '{"ctx":"x"}',
        );
    });

    it('prompt file not found → PromptError, exit 1', () => {
        const root = writePrompt('r', 'exists', MEMO.replace('memo-x', 'exists-x'));
        expectParity(
            ['render', '--root', root, '--role', 'r', '--prompt', 'ghost'],
            tmp,
            [tmp],
        );
    });
});

// ---------------------------------------------------------------------------
// render — bad --inputs-json shape (SystemExit) + malformed (traceback).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('render — inputs-json errors', () => {
    it('JSON array (not object) → SystemExit, exit 1, byte-identical', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expectParity(
            ['render', '--root', root, '--role', 'leadership', '--prompt', 'memo', '--inputs-json', '-'],
            tmp,
            [tmp],
            '[]',
        );
    });

    it('JSON scalar (not object) → SystemExit, exit 1, byte-identical', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expectParity(
            ['render', '--root', root, '--role', 'leadership', '--prompt', 'memo', '--inputs-json', '-'],
            tmp,
            [tmp],
            '42',
        );
    });

    it('malformed JSON → exit 1 (traceback vs JS-stack, only exit asserted)', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        const args = [
            'render',
            '--root',
            root,
            '--role',
            'leadership',
            '--prompt',
            'memo',
            '--inputs-json',
            '-',
        ];
        const p = runPy(args, tmp, '{bad');
        const t = runTs(args, tmp, '{bad');
        expect(p.status).toBe(1);
        expect(t.status).toBe(1);
        expect(p.stdout).toBe('');
        expect(t.stdout).toBe('');
        expect(p.stderr.length).toBeGreaterThan(0);
        expect(t.stderr.length).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// inspect — text + json.
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('inspect — output', () => {
    it('text output (required + optional + skill_hint)', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expectParity(['inspect', '--root', root, '--role', 'leadership', '--prompt', 'memo'], tmp, [
            tmp,
        ]);
    });

    it('--json output', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expectParity(
            ['inspect', '--root', root, '--role', 'leadership', '--prompt', 'memo', '--json'],
            tmp,
            [tmp],
        );
    });

    it('no skill_hint → em-dash fallback', () => {
        const root = writePrompt(
            'r',
            'nohint',
            `---
name: nohint
intent: no hint here
inputs:
  - name: ctx
    required: true
    shape: s
---
Body {{ctx}}.
`,
        );
        expectParity(['inspect', '--root', root, '--role', 'r', '--prompt', 'nohint'], tmp, [tmp]);
    });

    it('no inputs at all → header + skill_hint only', () => {
        const root = writePrompt(
            'r',
            'empty',
            `---
name: empty-prompt
intent: nothing
---
Just text, no placeholders.
`,
        );
        expectParity(['inspect', '--root', root, '--role', 'r', '--prompt', 'empty'], tmp, [tmp]);
    });

    it('prompt not found → SystemExit, exit 1', () => {
        const root = writePrompt('r', 'exists', MEMO);
        expectParity(['inspect', '--root', root, '--role', 'r', '--prompt', 'ghost'], tmp, [tmp]);
    });
});
