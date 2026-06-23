// Intent tests for src/cli/python/workspace_explain.ts (py2ts ADR-200 —
// the explain-v1 envelope plain/technical renderer + host-decision explainer).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx CLI's own contract directly via inline snapshots over
// deterministic temp-JSON fixtures. The module is a pure renderer (reads an
// envelope / detection / health JSON, writes only stdout/stderr). The suite
// NEVER touches the real repo.
//
// Determinism guarantees preserved from the parity era:
//   * COLUMNS=200 is forced so argparse emits single-line usage (otherwise the
//     usage line in arg-error stderr re-wraps to terminal width).
//   * Every spawn uses a **node-only PATH** (a temp dir holding just `node` +
//     `git` symlinks) so the run is hermetic and python-free by construction.
//   * The `--help` per-flag BODY is intentionally NOT asserted (porting
//     contract); only the first stdout line (the usage line).
//   * The file-not-found / malformed-JSON paths print a node stack — only the
//     exit code + empty stdout are asserted there.
//
// Float-parity surface: technical mode and the plain-mode `(0.NN)` suffix use
// Python `f"{x:.2f}"` (round-half-to-even on the exact double). The TS twin's
// `_pyFixed2` is exercised here with the JS-divergent values 0.125 (→ 0.12,
// not 0.13) and 0.625 (→ 0.62, not 0.63) — these are DETERMINISTIC and asserted.
//
// Relative-time nondeterminism: `_human_relative` uses the live clock on the
// render path (main() does not thread `now`). To stay deterministic the
// envelopes use null / invalid / absent `last_reviewed_at` (→ "(unavailable)"
// or the raw string), and `norm()` masks any "N hour(s)/day(s)/month(s) ago"
// phrase as a belt-and-braces fallback.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

// tests/scripts/cli/python/workspace_explain.test.ts → repo root is five hops up.
const REPO_ROOT = path.resolve(
    fileURLToPath(import.meta.url),
    '..',
    '..',
    '..',
    '..',
    '..',
);
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_explain.ts');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

// node-only PATH → hermetic, python-free runs (only `node` + `git` resolve).
const NODE_ONLY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wexplain-nodeonly-'));
fs.symlinkSync(process.execPath, path.join(NODE_ONLY_DIR, 'node'));
try {
    const gitPath = spawnSync('command', ['-v', 'git'], { encoding: 'utf8', shell: true }).stdout
        ?.trim()
        ?.split('\n')[0];
    if (gitPath && fs.existsSync(gitPath)) {
        fs.symlinkSync(gitPath, path.join(NODE_ONLY_DIR, 'git'));
    }
} catch {
    /* git not strictly needed by the renderer */
}
afterAll(() => {
    fs.rmSync(NODE_ONLY_DIR, { recursive: true, force: true });
});

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runTs(args: string[], cwd: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, PATH: NODE_ONLY_DIR, COLUMNS: '200' },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Replace temp roots with `<TMP>` + mask the live-clock relative-time phrase. */
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
    // Belt-and-braces: `_human_relative` is clock-driven on the render path.
    // Fixtures avoid valid timestamps, but mask the phrase so a clock tick
    // can never flake the snapshot.
    out = out.replace(/\d+ (?:hour|day|month)s? ago/g, '<REL>');
    return out;
}

/** Normalized {status, stdout, stderr} for inline-snapshotting. */
function snap(args: string[], cwd: string, roots: string[]): RunResult {
    const t = runTs(args, cwd);
    return {
        status: t.status,
        stdout: norm(t.stdout, roots),
        stderr: norm(t.stderr, roots),
    };
}

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wexplain-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function writeJson(name: string, obj: unknown): string {
    const p = path.join(tmp, name);
    fs.writeFileSync(p, JSON.stringify(obj));
    return p;
}

function writeRaw(name: string, content: string): string {
    const p = path.join(tmp, name);
    fs.writeFileSync(p, content);
    return p;
}

// ---------------------------------------------------------------------------
// Usage / argument errors.
// ---------------------------------------------------------------------------

describe('explain — argument errors', () => {
    it('top -h: exit 0, usage line on stdout', () => {
        const t = runTs(['-h'], tmp);
        expect(t.status).toBe(0);
        expect(t.stdout.split('\n')[0]).toMatchInlineSnapshot(`"usage: workspace_explain [-h] {render,explain-host} ..."`);
    });

    it('render -h: exit 0, usage line on stdout', () => {
        const t = runTs(['render', '-h'], tmp);
        expect(t.status).toBe(0);
        expect(t.stdout.split('\n')[0]).toMatchInlineSnapshot(`"usage: workspace_explain render [-h] [--mode {plain,technical}] --envelope-file ENVELOPE_FILE [--glossary GLOSSARY]"`);
    });

    it('explain-host -h: exit 0, usage line on stdout', () => {
        const t = runTs(['explain-host', '-h'], tmp);
        expect(t.status).toBe(0);
        expect(t.stdout.split('\n')[0]).toMatchInlineSnapshot(`"usage: workspace_explain explain-host [-h] [--mode {plain,technical}] --detection-file DETECTION_FILE [--health-file HEALTH_FILE] [--resume-session-id RESUME_SESSION_ID]"`);
    });

    it('no args: exit 2 + usage+error stderr', () => {
        expect(snap([], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_explain [-h] {render,explain-host} ...
          workspace_explain: error: the following arguments are required: cmd
          ",
            "stdout": "",
          }
        `);
    });

    it('bad subcommand: exit 2 + stderr', () => {
        expect(snap(['frob'], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_explain [-h] {render,explain-host} ...
          workspace_explain: error: argument cmd: invalid choice: 'frob' (choose from 'render', 'explain-host')
          ",
            "stdout": "",
          }
        `);
    });

    it('render missing --envelope-file: exit 2 + stderr', () => {
        expect(snap(['render'], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_explain render [-h] [--mode {plain,technical}] --envelope-file ENVELOPE_FILE [--glossary GLOSSARY]
          workspace_explain render: error: the following arguments are required: --envelope-file
          ",
            "stdout": "",
          }
        `);
    });

    it('explain-host missing --detection-file: exit 2 + stderr', () => {
        expect(snap(['explain-host'], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_explain explain-host [-h] [--mode {plain,technical}] --detection-file DETECTION_FILE [--health-file HEALTH_FILE] [--resume-session-id RESUME_SESSION_ID]
          workspace_explain explain-host: error: the following arguments are required: --detection-file
          ",
            "stdout": "",
          }
        `);
    });

    it('render bad --mode choice: exit 2 + stderr', () => {
        const env = writeJson('e.json', { trust_score: 0.5 });
        expect(snap(['render', '--mode', 'bogus', '--envelope-file', env], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_explain render [-h] [--mode {plain,technical}] --envelope-file ENVELOPE_FILE [--glossary GLOSSARY]
          workspace_explain render: error: argument --mode: invalid choice: 'bogus' (choose from 'plain', 'technical')
          ",
            "stdout": "",
          }
        `);
    });

    it('render stray positional: exit 2 unrecognized', () => {
        const env = writeJson('e.json', { trust_score: 0.5 });
        expect(snap(['render', '--envelope-file', env, 'stray'], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_explain [-h] {render,explain-host} ...
          workspace_explain: error: unrecognized arguments: stray
          ",
            "stdout": "",
          }
        `);
    });

    it('render unknown flag: exit 2 unrecognized', () => {
        const env = writeJson('e.json', { trust_score: 0.5 });
        expect(snap(['render', '--envelope-file', env, '--bogus'], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_explain [-h] {render,explain-host} ...
          workspace_explain: error: unrecognized arguments: --bogus
          ",
            "stdout": "",
          }
        `);
    });

    it('render required-missing wins over stray positional', () => {
        expect(snap(['render', 'stray'], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_explain render [-h] [--mode {plain,technical}] --envelope-file ENVELOPE_FILE [--glossary GLOSSARY]
          workspace_explain render: error: the following arguments are required: --envelope-file
          ",
            "stdout": "",
          }
        `);
    });

    it('render --mode missing value: exit 2 expected-one-argument', () => {
        expect(snap(['render', '--mode'], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_explain render [-h] [--mode {plain,technical}] --envelope-file ENVELOPE_FILE [--glossary GLOSSARY]
          workspace_explain render: error: argument --mode: expected one argument
          ",
            "stdout": "",
          }
        `);
    });

    it('explain-host stray positional: exit 2 unrecognized', () => {
        const det = writeJson('d.json', { host: 'h' });
        expect(snap(['explain-host', '--detection-file', det, 'stray'], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_explain [-h] {render,explain-host} ...
          workspace_explain: error: unrecognized arguments: stray
          ",
            "stdout": "",
          }
        `);
    });
});

// ---------------------------------------------------------------------------
// render — plain mode across trust / freshness bands, sources, contradictions.
// ---------------------------------------------------------------------------

describe('render — plain mode', () => {
    it('very_high trust, fresh, sources present, no contradictions, id present', () => {
        const env = writeJson('e.json', {
            trust_score: 0.9,
            decay: { applied_factor: 0.95 },
            evidence: { sources: ['alpha', 'beta'] },
            contradictions: [],
            last_reviewed_at: null,
            id: 'env-1',
        });
        expect(snap(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": ["env-1"], "markdown": "## Where this came from\\n2 source(s) \\u2014 alpha, beta\\n\\n## How confident\\nVery High (0.90)\\n\\n## When last reviewed\\n(unavailable) \\u00b7 Fresh\\n\\n## What's contested\\nNo open disagreements.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('high trust, aging, contradictions present, falsy id (empty string → ids:[])', () => {
        const env = writeJson('e.json', {
            trust_score: 0.72,
            decay: { applied_factor: 0.6 },
            evidence: { sources: ['s1'] },
            contradictions: ['c1', 'c2', 'c3'],
            last_reviewed_at: null,
            id: '',
        });
        expect(snap(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": [], "markdown": "## Where this came from\\n1 source(s) \\u2014 s1\\n\\n## How confident\\nHigh (0.72)\\n\\n## When last reviewed\\n(unavailable) \\u00b7 Aging\\n\\n## What's contested\\n3 open\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('medium trust, stale, empty sources, no contradictions', () => {
        const env = writeJson('e.json', {
            trust_score: 0.5,
            decay: { applied_factor: 0.2 },
            evidence: { sources: [] },
            contradictions: [],
            last_reviewed_at: null,
            id: 'm',
        });
        expect(snap(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": ["m"], "markdown": "## Where this came from\\n0 source(s)\\n\\n## How confident\\nMedium (0.50)\\n\\n## When last reviewed\\n(unavailable) \\u00b7 Stale\\n\\n## What's contested\\nNo open disagreements.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('low trust (below medium), missing decay/evidence/contradictions/id entirely', () => {
        const env = writeJson('e.json', { trust_score: 0.1 });
        expect(snap(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": [], "markdown": "## Where this came from\\n0 source(s)\\n\\n## How confident\\nLow (0.10)\\n\\n## When last reviewed\\n(unavailable) \\u00b7 Stale\\n\\n## What's contested\\nNo open disagreements.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('exact band boundary very_high=0.85 (>= is Very High)', () => {
        const env = writeJson('e.json', {
            trust_score: 0.85,
            decay: { applied_factor: 0.8 },
            evidence: { sources: ['x'] },
            id: 'b',
        });
        expect(snap(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": ["b"], "markdown": "## Where this came from\\n1 source(s) \\u2014 x\\n\\n## How confident\\nVery High (0.85)\\n\\n## When last reviewed\\n(unavailable) \\u00b7 Fresh\\n\\n## What's contested\\nNo open disagreements.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('more than 5 sources → only first 5 joined', () => {
        const env = writeJson('e.json', {
            trust_score: 0.65,
            decay: { applied_factor: 0.5 },
            evidence: { sources: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
            id: 'six',
        });
        expect(snap(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": ["six"], "markdown": "## Where this came from\\n7 source(s) \\u2014 a, b, c, d, e\\n\\n## How confident\\nHigh (0.65)\\n\\n## When last reviewed\\n(unavailable) \\u00b7 Aging\\n\\n## What's contested\\nNo open disagreements.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('null trust/decay (or-fallback to 0.0) → Low + Stale + (0.00)', () => {
        const env = writeJson('e.json', {
            trust_score: null,
            decay: { applied_factor: null },
            evidence: { sources: [] },
        });
        expect(snap(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": [], "markdown": "## Where this came from\\n0 source(s)\\n\\n## How confident\\nLow (0.00)\\n\\n## When last reviewed\\n(unavailable) \\u00b7 Stale\\n\\n## What's contested\\nNo open disagreements.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('JS-divergent float 0.125 → (0.12) not (0.13)', () => {
        const env = writeJson('e.json', {
            trust_score: 0.125,
            decay: { applied_factor: 0.625 },
            evidence: { sources: [] },
            id: 'half',
        });
        expect(snap(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": ["half"], "markdown": "## Where this came from\\n0 source(s)\\n\\n## How confident\\nLow (0.12)\\n\\n## When last reviewed\\n(unavailable) \\u00b7 Aging\\n\\n## What's contested\\nNo open disagreements.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('falsy id 0 (number zero → ids:[])', () => {
        const env = writeJson('e.json', { trust_score: 0.7, id: 0 });
        expect(snap(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": [], "markdown": "## Where this came from\\n0 source(s)\\n\\n## How confident\\nHigh (0.70)\\n\\n## When last reviewed\\n(unavailable) \\u00b7 Stale\\n\\n## What's contested\\nNo open disagreements.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('non-string source element → TypeError on str.join → exit 1, no stdout', () => {
        // Python `", ".join([...])` raises TypeError on a non-str element
        // (int / bool), aborting with a traceback (exit 1). The TS twin throws
        // too; stacks are not asserted — only exit + empty stdout.
        const env = writeJson('e.json', {
            trust_score: 0.7,
            evidence: { sources: ['a', 1, true] },
            id: 'mix',
        });
        const t = runTs(['render', '--mode', 'plain', '--envelope-file', env], tmp);
        expect(t.status).toBe(1);
        expect(t.stdout).toBe('');
    });
});

// ---------------------------------------------------------------------------
// render — technical mode (raw fields, :.2f decay, last_reviewed passthrough).
// ---------------------------------------------------------------------------

describe('render — technical mode', () => {
    it('technical fields + decay=:.2f + 0 contradictions → "0"', () => {
        const env = writeJson('e.json', {
            trust_score: 0.72,
            decay: { applied_factor: 0.9 },
            evidence: { sources: ['a', 'b'] },
            contradictions: [],
            last_reviewed_at: '2020-01-02T03:04:05Z',
            id: 'tech',
        });
        expect(snap(['render', '--mode', 'technical', '--envelope-file', env], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": ["tech"], "markdown": "## Sources\\n2 source(s) \\u2014 a, b\\n\\n## Trust score\\n0.72\\n\\n## Last reviewed\\n2020-01-02T03:04:05Z \\u00b7 decay=0.90\\n\\n## Unresolved contradictions\\n0\\n", "mode": "technical"}
          ",
          }
        `);
    });

    it('technical, JS-divergent decay 0.625 → decay=0.62', () => {
        const env = writeJson('e.json', {
            trust_score: 0.125,
            decay: { applied_factor: 0.625 },
            evidence: { sources: [] },
            contradictions: ['c1'],
            last_reviewed_at: null,
            id: 'tech2',
        });
        expect(snap(['render', '--mode', 'technical', '--envelope-file', env], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": ["tech2"], "markdown": "## Sources\\n0 source(s)\\n\\n## Trust score\\n0.12\\n\\n## Last reviewed\\n(unavailable) \\u00b7 decay=0.62\\n\\n## Unresolved contradictions\\n1 open\\n", "mode": "technical"}
          ",
          }
        `);
    });

    it('technical, last_reviewed_at absent → (unavailable)', () => {
        const env = writeJson('e.json', { trust_score: 1.0, decay: { applied_factor: 1.0 } });
        expect(snap(['render', '--mode', 'technical', '--envelope-file', env], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": [], "markdown": "## Sources\\n0 source(s)\\n\\n## Trust score\\n1.00\\n\\n## Last reviewed\\n(unavailable) \\u00b7 decay=1.00\\n\\n## Unresolved contradictions\\n0\\n", "mode": "technical"}
          ",
          }
        `);
    });

    it('technical default mode is plain (no --mode → plain)', () => {
        const env = writeJson('e.json', { trust_score: 0.66, evidence: { sources: ['z'] }, id: 'd' });
        expect(snap(['render', '--envelope-file', env], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": ["d"], "markdown": "## Where this came from\\n1 source(s) \\u2014 z\\n\\n## How confident\\nHigh (0.66)\\n\\n## When last reviewed\\n(unavailable) \\u00b7 Stale\\n\\n## What's contested\\nNo open disagreements.\\n", "mode": "plain"}
          ",
          }
        `);
    });
});

// ---------------------------------------------------------------------------
// render — last_reviewed_at variants (deterministic "(unavailable)" / raw).
// ---------------------------------------------------------------------------

describe('render — last_reviewed deterministic paths', () => {
    it('null last_reviewed (plain) → (unavailable)', () => {
        const env = writeJson('e.json', {
            trust_score: 0.7,
            decay: { applied_factor: 0.9 },
            evidence: { sources: ['x'] },
            last_reviewed_at: null,
            id: 'n',
        });
        expect(snap(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": ["n"], "markdown": "## Where this came from\\n1 source(s) \\u2014 x\\n\\n## How confident\\nHigh (0.70)\\n\\n## When last reviewed\\n(unavailable) \\u00b7 Fresh\\n\\n## What's contested\\nNo open disagreements.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('invalid timestamp (plain) → raw string passthrough', () => {
        const env = writeJson('e.json', {
            trust_score: 0.7,
            decay: { applied_factor: 0.9 },
            evidence: { sources: ['x'] },
            last_reviewed_at: 'not-a-real-date',
            id: 'inv',
        });
        expect(snap(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": ["inv"], "markdown": "## Where this came from\\n1 source(s) \\u2014 x\\n\\n## How confident\\nHigh (0.70)\\n\\n## When last reviewed\\nnot-a-real-date \\u00b7 Fresh\\n\\n## What's contested\\nNo open disagreements.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('absent last_reviewed (plain) → (unavailable)', () => {
        const env = writeJson('e.json', {
            trust_score: 0.7,
            decay: { applied_factor: 0.9 },
            evidence: { sources: ['x'] },
            id: 'abs',
        });
        expect(snap(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": ["abs"], "markdown": "## Where this came from\\n1 source(s) \\u2014 x\\n\\n## How confident\\nHigh (0.70)\\n\\n## When last reviewed\\n(unavailable) \\u00b7 Fresh\\n\\n## What's contested\\nNo open disagreements.\\n", "mode": "plain"}
          ",
          }
        `);
    });
});

// ---------------------------------------------------------------------------
// render — custom glossary (override labels + bands).
// ---------------------------------------------------------------------------

describe('render — custom glossary', () => {
    const GLOSS = `# a comment
labels:
  confidence: Vertrauen
  sources: Quellen
  last_reviewed: Geprueft
  contradictions: Strittig
bands:
  confidence:
    very_high: 0.95
    high: 0.70
    medium: 0.30
  freshness:
    fresh: 0.90
    aging: 0.40
`;

    it('glossary overrides plain labels + confidence bands', () => {
        const env = writeJson('e.json', {
            trust_score: 0.72,
            decay: { applied_factor: 0.5 },
            evidence: { sources: ['a'] },
            last_reviewed_at: null,
            id: 'g',
        });
        const g = writeRaw('gloss.yml', GLOSS);
        expect(
            snap(['render', '--mode', 'plain', '--envelope-file', env, '--glossary', g], tmp, [tmp]),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": ["g"], "markdown": "## Quellen\\n1 source(s) \\u2014 a\\n\\n## Vertrauen\\nHigh (0.72)\\n\\n## Geprueft\\n(unavailable) \\u00b7 Aging\\n\\n## Strittig\\nNo open disagreements.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('glossary with quoted label value (strip quotes)', () => {
        const env = writeJson('e.json', { trust_score: 0.5, evidence: { sources: [] }, id: 'q' });
        const g = writeRaw(
            'gloss.yml',
            `labels:
  confidence: "Quoted Conf"
  sources: 'Single Quoted'
`,
        );
        expect(
            snap(['render', '--mode', 'plain', '--envelope-file', env, '--glossary', g], tmp, [tmp]),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": ["q"], "markdown": "## Single Quoted\\n0 source(s)\\n\\n## Quoted Conf\\nMedium (0.50)\\n\\n## When last reviewed\\n(unavailable) \\u00b7 Stale\\n\\n## What's contested\\nNo open disagreements.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('glossary with non-float band value (ValueError → skipped)', () => {
        const env = writeJson('e.json', { trust_score: 0.6, evidence: { sources: [] }, id: 's' });
        const g = writeRaw(
            'gloss.yml',
            `bands:
  confidence:
    very_high: notanumber
    high: 0.55
`,
        );
        expect(
            snap(['render', '--mode', 'plain', '--envelope-file', env, '--glossary', g], tmp, [tmp]),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": ["s"], "markdown": "## Where this came from\\n0 source(s)\\n\\n## How confident\\nHigh (0.60)\\n\\n## When last reviewed\\n(unavailable) \\u00b7 Stale\\n\\n## What's contested\\nNo open disagreements.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('missing glossary file → defaults used', () => {
        const env = writeJson('e.json', { trust_score: 0.66, evidence: { sources: ['z'] }, id: 'd' });
        const ghost = path.join(tmp, 'no-such.yml');
        expect(
            snap(['render', '--mode', 'plain', '--envelope-file', env, '--glossary', ghost], tmp, [tmp]),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": ["d"], "markdown": "## Where this came from\\n1 source(s) \\u2014 z\\n\\n## How confident\\nHigh (0.66)\\n\\n## When last reviewed\\n(unavailable) \\u00b7 Stale\\n\\n## What's contested\\nNo open disagreements.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('glossary does NOT override technical labels (LABELS_TECHNICAL fixed)', () => {
        const env = writeJson('e.json', {
            trust_score: 0.72,
            decay: { applied_factor: 0.5 },
            evidence: { sources: ['a'] },
            last_reviewed_at: null,
            id: 'gt',
        });
        const g = writeRaw('gloss.yml', GLOSS);
        expect(
            snap(['render', '--mode', 'technical', '--envelope-file', env, '--glossary', g], tmp, [tmp]),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"ids": ["gt"], "markdown": "## Sources\\n1 source(s) \\u2014 a\\n\\n## Trust score\\n0.72\\n\\n## Last reviewed\\n(unavailable) \\u00b7 decay=0.50\\n\\n## Unresolved contradictions\\n0\\n", "mode": "technical"}
          ",
          }
        `);
    });
});

// ---------------------------------------------------------------------------
// explain-host — plain mode (known/unknown, tier1/tier3, demotion, killed, resume).
// ---------------------------------------------------------------------------

describe('explain-host — plain mode', () => {
    it('known tier-1 driving host', () => {
        const det = writeJson('d.json', {
            host: 'claude-code',
            known: true,
            inventory_tier: 1,
            cli: 'claude',
            cli_present: true,
            effective_tier: 1,
            mode: 'tier1-drive-pending',
        });
        expect(snap(['explain-host', '--mode', 'plain', '--detection-file', det], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"host": "claude-code", "markdown": "## Why this host\\n\`claude-code\` is your active host.\\n\\n## Why this tier\\nRunning at **Tier 1** \\u2014 \`claude-code\` drives the work directly because its CLI (\`claude\`) is installed and on your PATH.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('known tier-3 handoff host', () => {
        const det = writeJson('d.json', {
            host: 'augment',
            known: true,
            inventory_tier: 3,
            cli: null,
            cli_present: false,
            effective_tier: 3,
            mode: 'handoff',
        });
        expect(snap(['explain-host', '--mode', 'plain', '--detection-file', det], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"host": "augment", "markdown": "## Why this host\\n\`augment\` is your active host.\\n\\n## Why this tier\\nRunning at **Tier 3** \\u2014 \`augment\` hands work off through the inbox rather than driving it directly.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('unknown host (known:false) → hand-off sentence', () => {
        const det = writeJson('d.json', {
            host: 'mystery',
            known: false,
            inventory_tier: null,
            cli: null,
            cli_present: false,
            effective_tier: 3,
            mode: 'handoff',
        });
        expect(snap(['explain-host', '--mode', 'plain', '--detection-file', det], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"host": "mystery", "markdown": "## Why this host\\n\`mystery\` is not in the known-host list, so it is treated as a hand-off host.\\n\\n## Why this tier\\nRunning at **Tier 3** \\u2014 \`mystery\` hands work off through the inbox rather than driving it directly.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('tier-1 demotion fallback (known + inv_tier 1 + no cli) fires "Why a fallback fired"', () => {
        const det = writeJson('d.json', {
            host: 'codex',
            known: true,
            inventory_tier: 1,
            cli: 'codex',
            cli_present: false,
            effective_tier: 3,
            mode: 'handoff',
        });
        expect(snap(['explain-host', '--mode', 'plain', '--detection-file', det], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"host": "codex", "markdown": "## Why this host\\n\`codex\` is your active host.\\n\\n## Why this tier\\nRunning at **Tier 3** \\u2014 \`codex\` hands work off through the inbox rather than driving it directly.\\n\\n## Why a fallback fired\\n\`codex\` would normally drive at Tier 1, but its CLI (\`codex\`) isn't on your PATH \\u2014 so it dropped to Tier 3 hand-off. Install the CLI to get direct driving back.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('killed kill-switch fallback (with health)', () => {
        const det = writeJson('d.json', {
            host: 'claude-code',
            known: true,
            inventory_tier: 1,
            cli: 'claude',
            cli_present: true,
            effective_tier: 1,
        });
        const health = writeJson('h.json', { killed: true, consecutive_failures: 4 });
        expect(
            snap(
                ['explain-host', '--mode', 'plain', '--detection-file', det, '--health-file', health],
                tmp,
                [tmp],
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"host": "claude-code", "markdown": "## Why this host\\n\`claude-code\` is your active host.\\n\\n## Why this tier\\nRunning at **Tier 1** \\u2014 \`claude-code\` drives the work directly because its CLI (\`claude\`) is installed and on your PATH.\\n\\n## Why a fallback fired\\nThe drive kill-switch is **on** for \`claude-code\` after 4 consecutive failures. New launches run as a probe \\u2014 one success closes the switch automatically.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('demotion + killed both fire (two fallback paragraphs)', () => {
        const det = writeJson('d.json', {
            host: 'codex',
            known: true,
            inventory_tier: 1,
            cli: 'codex',
            cli_present: false,
            effective_tier: 3,
        });
        const health = writeJson('h.json', { killed: true, consecutive_failures: 7 });
        expect(
            snap(
                ['explain-host', '--mode', 'plain', '--detection-file', det, '--health-file', health],
                tmp,
                [tmp],
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"host": "codex", "markdown": "## Why this host\\n\`codex\` is your active host.\\n\\n## Why this tier\\nRunning at **Tier 3** \\u2014 \`codex\` hands work off through the inbox rather than driving it directly.\\n\\n## Why a fallback fired\\n\`codex\` would normally drive at Tier 1, but its CLI (\`codex\`) isn't on your PATH \\u2014 so it dropped to Tier 3 hand-off. Install the CLI to get direct driving back.\\nThe drive kill-switch is **on** for \`codex\` after 7 consecutive failures. New launches run as a probe \\u2014 one success closes the switch automatically.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('resume-session-id → "Why continue" block', () => {
        const det = writeJson('d.json', {
            host: 'claude-code',
            known: true,
            inventory_tier: 1,
            cli: 'claude',
            cli_present: true,
            effective_tier: 1,
        });
        expect(
            snap(
                [
                    'explain-host',
                    '--mode',
                    'plain',
                    '--detection-file',
                    det,
                    '--resume-session-id',
                    'sess-abc',
                ],
                tmp,
                [tmp],
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"host": "claude-code", "markdown": "## Why this host\\n\`claude-code\` is your active host.\\n\\n## Why this tier\\nRunning at **Tier 1** \\u2014 \`claude-code\` drives the work directly because its CLI (\`claude\`) is installed and on your PATH.\\n\\n## Why continue\\nResuming your previous session (\`sess-abc\`) instead of starting fresh, so the task keeps its context across turns.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('killed false, no fallback, no resume (minimal plain)', () => {
        const det = writeJson('d.json', {
            host: 'gemini',
            known: true,
            inventory_tier: 1,
            cli: 'gemini',
            cli_present: true,
            effective_tier: 1,
        });
        const health = writeJson('h.json', { killed: false, consecutive_failures: 0 });
        expect(
            snap(
                ['explain-host', '--mode', 'plain', '--detection-file', det, '--health-file', health],
                tmp,
                [tmp],
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"host": "gemini", "markdown": "## Why this host\\n\`gemini\` is your active host.\\n\\n## Why this tier\\nRunning at **Tier 1** \\u2014 \`gemini\` drives the work directly because its CLI (\`gemini\`) is installed and on your PATH.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('detection missing host → "(unknown)" default', () => {
        const det = writeJson('d.json', { known: false });
        expect(snap(['explain-host', '--mode', 'plain', '--detection-file', det], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"host": "(unknown)", "markdown": "## Why this host\\n\`(unknown)\` is not in the known-host list, so it is treated as a hand-off host.\\n\\n## Why this tier\\nRunning at **Tier 3** \\u2014 \`(unknown)\` hands work off through the inbox rather than driving it directly.\\n", "mode": "plain"}
          ",
          }
        `);
    });

    it('health consecutive_failures absent → int(... or 0) → 0', () => {
        const det = writeJson('d.json', {
            host: 'codex',
            known: true,
            inventory_tier: 1,
            cli: 'codex',
            cli_present: false,
            effective_tier: 3,
        });
        const health = writeJson('h.json', { killed: true });
        expect(
            snap(
                ['explain-host', '--mode', 'plain', '--detection-file', det, '--health-file', health],
                tmp,
                [tmp],
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"host": "codex", "markdown": "## Why this host\\n\`codex\` is your active host.\\n\\n## Why this tier\\nRunning at **Tier 3** \\u2014 \`codex\` hands work off through the inbox rather than driving it directly.\\n\\n## Why a fallback fired\\n\`codex\` would normally drive at Tier 1, but its CLI (\`codex\`) isn't on your PATH \\u2014 so it dropped to Tier 3 hand-off. Install the CLI to get direct driving back.\\nThe drive kill-switch is **on** for \`codex\` after 0 consecutive failures. New launches run as a probe \\u2014 one success closes the switch automatically.\\n", "mode": "plain"}
          ",
          }
        `);
    });
});

// ---------------------------------------------------------------------------
// explain-host — technical mode (raw 2-line block).
// ---------------------------------------------------------------------------

describe('explain-host — technical mode', () => {
    it('technical block, all fields + health + resume', () => {
        const det = writeJson('d.json', {
            host: 'augment',
            known: true,
            inventory_tier: 1,
            cli: 'aug',
            cli_present: false,
            effective_tier: 3,
            mode: 'handoff',
        });
        const health = writeJson('h.json', { killed: true, consecutive_failures: 4 });
        expect(
            snap(
                [
                    'explain-host',
                    '--mode',
                    'technical',
                    '--detection-file',
                    det,
                    '--health-file',
                    health,
                    '--resume-session-id',
                    'sess-9',
                ],
                tmp,
                [tmp],
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"host": "augment", "markdown": "## Host decision (technical)\\nhost=augment known=True inventory_tier=1 effective_tier=3 cli=aug cli_present=False killed=True consecutive_failures=4 resume_session_id=sess-9\\n", "mode": "technical"}
          ",
          }
        `);
    });

    it('technical block, no health no resume → killed=False, failures=0, resume=-', () => {
        const det = writeJson('d.json', {
            host: 'claude-code',
            known: true,
            inventory_tier: 1,
            cli: 'claude',
            cli_present: true,
            effective_tier: 1,
        });
        expect(snap(['explain-host', '--mode', 'technical', '--detection-file', det], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"host": "claude-code", "markdown": "## Host decision (technical)\\nhost=claude-code known=True inventory_tier=1 effective_tier=1 cli=claude cli_present=True killed=False consecutive_failures=0 resume_session_id=-\\n", "mode": "technical"}
          ",
          }
        `);
    });

    it('technical block, unknown host (null inv_tier, null cli)', () => {
        const det = writeJson('d.json', {
            host: 'mystery',
            known: false,
            inventory_tier: null,
            cli: null,
            cli_present: false,
            effective_tier: 3,
        });
        expect(snap(['explain-host', '--mode', 'technical', '--detection-file', det], tmp, [tmp])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"host": "mystery", "markdown": "## Host decision (technical)\\nhost=mystery known=False inventory_tier=None effective_tier=3 cli=None cli_present=False killed=False consecutive_failures=0 resume_session_id=-\\n", "mode": "technical"}
          ",
          }
        `);
    });
});

// ---------------------------------------------------------------------------
// File errors (node stack not asserted — only exit code + empty stdout).
// ---------------------------------------------------------------------------

describe('explain — file errors', () => {
    it('render envelope-file not found → exit 1, no stdout', () => {
        const ghost = path.join(tmp, 'nope.json');
        const t = runTs(['render', '--envelope-file', ghost], tmp);
        expect(t.status).toBe(1);
        expect(t.stdout).toBe('');
        expect(t.stderr.length).toBeGreaterThan(0);
    });

    it('explain-host detection-file not found → exit 1, no stdout', () => {
        const ghost = path.join(tmp, 'nope.json');
        const t = runTs(['explain-host', '--detection-file', ghost], tmp);
        expect(t.status).toBe(1);
        expect(t.stdout).toBe('');
    });

    it('render malformed JSON → exit 1, no stdout', () => {
        const bad = writeRaw('bad.json', '{not json');
        const t = runTs(['render', '--envelope-file', bad], tmp);
        expect(t.status).toBe(1);
        expect(t.stdout).toBe('');
    });
});
