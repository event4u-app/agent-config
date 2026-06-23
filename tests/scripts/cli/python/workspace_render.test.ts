// Intent tests for src/cli/python/workspace_render.ts (py2ts ADR-200 — the
// role-prompt placeholder renderer).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx CLI's own contract directly. The renderer is read-only (it
// reads a prompt file + a JSON input map, writes only to stdout/stderr) and the
// suite NEVER touches the real repo's `agents/roles` — every fixture lives under
// a fresh temp `<tmp>/roles/...` root.
//
// Determinism: every case spawns with a **node-only PATH** (a temp dir holding
// just a `node` symlink) so the tsx launcher resolves but nothing
// machine-dependent leaks via PATH. COLUMNS=200 forces argparse single-line
// usage (otherwise the usage line in arg-error stderr re-wraps to terminal
// width). The one surface that echoes the temp `--root` (the
// "must be an agents/roles directory" SystemExit) is masked through `norm()` to
// `<TMP>` so the snapshot is machine-stable. The malformed-JSON path prints a
// JS stack with absolute paths (non-deterministic) — only its exit code +
// non-empty stderr are asserted, never snapshotted. The `--help` per-flag BODY
// is likewise not snapshotted (porting contract) — only the leading usage token.
//
// pyStr/float strategy: inputs are parsed with int/float distinction preserved
// (a JSON `5` renders "5", `5.0` renders "5.0", `true` renders "True"), so the
// numeric/bool input cases below pin that mirroring.
//
// _validate_cli_root requires the `--root` dir to be NAMED `roles`, so every
// fixture passes `--root <tmp>/roles`.
import { mkdtempSync, symlinkSync } from 'node:fs';
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
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

// node-only PATH → nothing machine-dependent resolves but `node` (so tsx runs).
const NODE_ONLY_DIR = mkdtempSync(path.join(os.tmpdir(), 'ws-render-nodeonly-'));
symlinkSync(process.execPath, path.join(NODE_ONLY_DIR, 'node'));

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runTs(args: string[], cwd: string, stdin?: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        input: stdin,
        env: { ...process.env, PATH: NODE_ONLY_DIR, COLUMNS: '200' },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Replace temp roots (raw + realpath) with `<TMP>` so SystemExit messages that
 * echo the temp `--root` snapshot machine-stably. */
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

describe('render — argument errors', () => {
    it('top -h: exit 0, usage token on stdout', () => {
        const t = runTs(['-h'], tmp);
        expect(t.status).toBe(0);
        expect(
            t.stdout.startsWith('usage: workspace_render [-h] {render,inspect} ...'),
        ).toBe(true);
    });

    it('no args: exit 2 + usage+error stderr', () => {
        expect(runTs([], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_render [-h] {render,inspect} ...
          workspace_render: error: the following arguments are required: cmd
          ",
            "stdout": "",
          }
        `);
    });

    it('bad subcommand: exit 2 + invalid choice stderr', () => {
        expect(runTs(['frob'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_render [-h] {render,inspect} ...
          workspace_render: error: argument cmd: invalid choice: 'frob' (choose from 'render', 'inspect')
          ",
            "stdout": "",
          }
        `);
    });

    it('render missing both required: exit 2', () => {
        expect(runTs(['render'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_render render [-h] --role ROLE --prompt PROMPT [--inputs-json INPUTS_JSON] [--root ROOT] [--json]
          workspace_render render: error: the following arguments are required: --role, --prompt
          ",
            "stdout": "",
          }
        `);
    });

    it('render missing --prompt: exit 2', () => {
        expect(runTs(['render', '--role', 'x'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_render render [-h] --role ROLE --prompt PROMPT [--inputs-json INPUTS_JSON] [--root ROOT] [--json]
          workspace_render render: error: the following arguments are required: --prompt
          ",
            "stdout": "",
          }
        `);
    });

    it('inspect missing --role: exit 2', () => {
        expect(runTs(['inspect', '--prompt', 'y'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_render inspect [-h] --role ROLE --prompt PROMPT [--root ROOT] [--json]
          workspace_render inspect: error: the following arguments are required: --role
          ",
            "stdout": "",
          }
        `);
    });

    it('render stray positional: exit 2 unrecognized', () => {
        expect(runTs(['render', '--role', 'a', '--prompt', 'b', 'stray'], tmp))
            .toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_render [-h] {render,inspect} ...
          workspace_render: error: unrecognized arguments: stray
          ",
            "stdout": "",
          }
        `);
    });

    it('inspect with --inputs-json (unrecognized)', () => {
        expect(runTs(['inspect', '--role', 'x', '--prompt', 'y', '--inputs-json', '-'], tmp))
            .toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_render [-h] {render,inspect} ...
          workspace_render: error: unrecognized arguments: --inputs-json -
          ",
            "stdout": "",
          }
        `);
    });
});

// ---------------------------------------------------------------------------
// --root validation (SystemExit).
// ---------------------------------------------------------------------------

describe('render — --root validation', () => {
    it('root not named roles: SystemExit, exit 1 (path normalized)', () => {
        const notroles = path.join(tmp, 'notroles');
        fs.mkdirSync(notroles, { recursive: true });
        const t = runTs(['inspect', '--root', notroles, '--role', 'x', '--prompt', 'y'], tmp);
        expect({
            status: t.status,
            stdout: norm(t.stdout, [tmp]),
            stderr: norm(t.stderr, [tmp]),
        }).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "--root must be an agents/roles directory; got '<TMP>/notroles'
          ",
            "stdout": "",
          }
        `);
    });

    it('root named roles but prompt missing: PromptError via SystemExit, exit 1', () => {
        const root = path.join(tmp, 'roles');
        fs.mkdirSync(root, { recursive: true });
        expect(runTs(['inspect', '--root', root, '--role', 'x', '--prompt', 'y'], tmp))
            .toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "prompt not found: x/y
          ",
            "stdout": "",
          }
        `);
    });
});

// ---------------------------------------------------------------------------
// render — happy paths.
// ---------------------------------------------------------------------------

describe('render — happy paths', () => {
    it('section (text) with required + optional, optional absent', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expect(
            runTs(
                ['render', '--root', root, '--role', 'leadership', '--prompt', 'memo', '--inputs-json', '-'],
                tmp,
                '{"ctx":"a budget"}',
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "Memo about a budget with .
          ",
          }
        `);
    });

    it('--json output', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expect(
            runTs(
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
                '{"ctx":"a budget","extra":"and a deadline"}',
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"rendered": "Memo about a budget with and a deadline.\\n", "skill_hint": "scenario-modeling"}
          ",
          }
        `);
    });

    it('--inputs-json from a FILE', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        const f = path.join(tmp, 'inputs.json');
        fs.writeFileSync(f, '{"ctx":"file ctx","extra":"file extra"}');
        expect(
            runTs(
                ['render', '--root', root, '--role', 'leadership', '--prompt', 'memo', '--inputs-json', f],
                tmp,
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "Memo about file ctx with file extra.
          ",
          }
        `);
    });

    it('no --inputs-json at all → empty map (required missing → error)', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expect(runTs(['render', '--root', root, '--role', 'leadership', '--prompt', 'memo'], tmp))
            .toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "missing required input(s): ctx
          ",
            "stdout": "",
          }
        `);
    });

    it('empty stdin → empty map (required missing → error)', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expect(
            runTs(
                ['render', '--root', root, '--role', 'leadership', '--prompt', 'memo', '--inputs-json', '-'],
                tmp,
                '   \n  ',
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "missing required input(s): ctx
          ",
            "stdout": "",
          }
        `);
    });
});

// ---------------------------------------------------------------------------
// render — value-type mirroring (int vs float vs bool vs null vs string).
// ---------------------------------------------------------------------------

describe('render — pyStr value mirroring', () => {
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

    function renderV(json: string): RunResult {
        const root = writePrompt('r', 'one', ONE);
        return runTs(
            ['render', '--root', root, '--role', 'r', '--prompt', 'one', '--inputs-json', '-'],
            tmp,
            json,
        );
    }

    it('integer input → no trailing .0', () => {
        expect(renderV('{"ctx":"x","v":5}')).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "ctx=x v=5
          ",
          }
        `);
    });
    it('integral float input → trailing .0', () => {
        expect(renderV('{"ctx":"x","v":5.0}')).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "ctx=x v=5.0
          ",
          }
        `);
    });
    it('decimal float input', () => {
        expect(renderV('{"ctx":"x","v":5.5}')).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "ctx=x v=5.5
          ",
          }
        `);
    });
    it('large integer input → full precision', () => {
        expect(renderV('{"ctx":"x","v":100000000000000000000}')).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "ctx=x v=100000000000000000000
          ",
          }
        `);
    });
    it('boolean true → True', () => {
        expect(renderV('{"ctx":"x","v":true}')).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "ctx=x v=True
          ",
          }
        `);
    });
    it('boolean false → False', () => {
        expect(renderV('{"ctx":"x","v":false}')).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "ctx=x v=False
          ",
          }
        `);
    });
    it('null optional → empty string', () => {
        expect(renderV('{"ctx":"x","v":null}')).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "ctx=x v=
          ",
          }
        `);
    });
    it('scientific float → Python repr', () => {
        expect(renderV('{"ctx":"x","v":1e3}')).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "ctx=x v=1000.0
          ",
          }
        `);
    });
    it('negative integer', () => {
        expect(renderV('{"ctx":"x","v":-42}')).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "ctx=x v=-42
          ",
          }
        `);
    });
});

// ---------------------------------------------------------------------------
// render — template / input errors (PromptError → stderr, exit 1).
// ---------------------------------------------------------------------------

describe('render — PromptError paths', () => {
    it('missing required input (blank string also counts)', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expect(
            runTs(
                ['render', '--root', root, '--role', 'leadership', '--prompt', 'memo', '--inputs-json', '-'],
                tmp,
                '{"ctx":"   "}',
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "missing required input(s): ctx
          ",
            "stdout": "",
          }
        `);
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
        expect(
            runTs(
                ['render', '--root', root, '--role', 'r', '--prompt', 'bad', '--inputs-json', '-'],
                tmp,
                '{"ctx":"x"}',
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "undeclared placeholder(s) in template: alsobad, nope
          ",
            "stdout": "",
          }
        `);
    });

    it('prompt file not found → PromptError, exit 1', () => {
        const root = writePrompt('r', 'exists', MEMO.replace('memo-x', 'exists-x'));
        expect(runTs(['render', '--root', root, '--role', 'r', '--prompt', 'ghost'], tmp))
            .toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "prompt not found: r/ghost
          ",
            "stdout": "",
          }
        `);
    });
});

// ---------------------------------------------------------------------------
// render — bad --inputs-json shape (SystemExit) + malformed (JS stack).
// ---------------------------------------------------------------------------

describe('render — inputs-json errors', () => {
    it('JSON array (not object) → SystemExit, exit 1', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expect(
            runTs(
                ['render', '--root', root, '--role', 'leadership', '--prompt', 'memo', '--inputs-json', '-'],
                tmp,
                '[]',
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "--inputs-json must contain a JSON object (name → value)
          ",
            "stdout": "",
          }
        `);
    });

    it('JSON scalar (not object) → SystemExit, exit 1', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expect(
            runTs(
                ['render', '--root', root, '--role', 'leadership', '--prompt', 'memo', '--inputs-json', '-'],
                tmp,
                '42',
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "--inputs-json must contain a JSON object (name → value)
          ",
            "stdout": "",
          }
        `);
    });

    it('malformed JSON → exit 1 (JS stack has absolute paths; only exit + non-empty stderr asserted)', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        const t = runTs(
            ['render', '--root', root, '--role', 'leadership', '--prompt', 'memo', '--inputs-json', '-'],
            tmp,
            '{bad',
        );
        expect(t.status).toBe(1);
        expect(t.stdout).toBe('');
        expect(t.stderr.length).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// inspect — text + json.
// ---------------------------------------------------------------------------

describe('inspect — output', () => {
    it('text output (required + optional + skill_hint)', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expect(runTs(['inspect', '--root', root, '--role', 'leadership', '--prompt', 'memo'], tmp))
            .toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "memo-x — write a memo
            - ctx (required): one-paragraph context
            - extra (optional): budget, deadline
          skill_hint: scenario-modeling
          ",
          }
        `);
    });

    it('--json output', () => {
        const root = writePrompt('leadership', 'memo', MEMO);
        expect(
            runTs(
                ['inspect', '--root', root, '--role', 'leadership', '--prompt', 'memo', '--json'],
                tmp,
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"inputs": [{"name": "ctx", "required": true, "shape": "one-paragraph context"}, {"name": "extra", "required": false, "shape": "budget, deadline"}], "intent": "write a memo", "name": "memo-x", "output_shape": "a memo", "skill_hint": "scenario-modeling"}
          ",
          }
        `);
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
        expect(runTs(['inspect', '--root', root, '--role', 'r', '--prompt', 'nohint'], tmp))
            .toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "nohint — no hint here
            - ctx (required): s
          skill_hint: —
          ",
          }
        `);
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
        expect(runTs(['inspect', '--root', root, '--role', 'r', '--prompt', 'empty'], tmp))
            .toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "empty-prompt — nothing
          skill_hint: —
          ",
          }
        `);
    });

    it('prompt not found → SystemExit, exit 1', () => {
        const root = writePrompt('r', 'exists', MEMO);
        expect(runTs(['inspect', '--root', root, '--role', 'r', '--prompt', 'ghost'], tmp))
            .toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "prompt not found: r/ghost
          ",
            "stdout": "",
          }
        `);
    });
});
