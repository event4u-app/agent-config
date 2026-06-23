// Intent tests for src/cli/python/workspace_skills.ts (py2ts ADR-200 —
// skill-body resolution for host hand-off pre-rendering, ADR-066).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx CLI's own contract directly. Skill resolution is
// deterministic: it resolves `<repo>/.agent-src.uncondensed/skills/<id>/SKILL.md`
// then `<repo>/dist/agent-src/skills/<id>/SKILL.md` (ROOT = parents[3] of the
// script), strips frontmatter, and caps the body at 64 KiB. The resolution root
// is the REAL repo, so the happy path resolves whichever skill is alphabetically
// first under one of the two SKILL_SOURCES.
//
// Two non-determinism sources are masked: (1) host-CLI / PATH state is removed
// by spawning with a **node-only PATH** + COLUMNS=200 (single-line usage); (2)
// the resolved skill's BODY + DESCRIPTION are real tracked-repo content that
// changes under unrelated edits, so `norm()` masks them — the load-bearing
// happy-path contract is the present/absent flag (`found` / section header), the
// resolved id (`name`), and the output SHAPE, not the body bytes. Note-path and
// argparse cases are fully deterministic and snapshot verbatim.
import { mkdtempSync, readdirSync, existsSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_skills.ts');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

// node-only PATH → deterministic host-CLI detection (nothing but `node` resolves).
const NODE_ONLY_DIR = mkdtempSync(path.join(tmpdir(), 'ws-skills-nodeonly-'));
symlinkSync(process.execPath, path.join(NODE_ONLY_DIR, 'node'));
afterAll(() => {
    // temp dir is left for the OS to reap; nothing sensitive.
});

/** Pick a skill id that exists under one of the two real SKILL_SOURCES. */
function presentSkill(): string | null {
    for (const root of [
        path.join(REPO_ROOT, '.agent-src.uncondensed', 'skills'),
        path.join(REPO_ROOT, 'dist', 'agent-src', 'skills'),
    ]) {
        let names: string[];
        try {
            names = readdirSync(root);
        } catch {
            continue;
        }
        for (const n of names.sort()) {
            if (existsSync(path.join(root, n, 'SKILL.md')) && /^[a-z0-9][a-z0-9-]*$/.test(n)) {
                return n;
            }
        }
    }
    return null;
}
const SKILL = presentSkill();

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runTs(args: string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        env: { ...process.env, PATH: NODE_ONLY_DIR, COLUMNS: '200' },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/**
 * Mask the repo-coupled body of a resolved PRESENT skill so the snapshot pins
 * the deterministic envelope (present-flag, id, shape) not the body bytes.
 * - section format: keep up to the `## Skill context: <id>` header, then `<BODY>`.
 * - json format: replace `body` + `description` string values with `<MASKED>`.
 * Leaves note-path / argparse output untouched.
 */
function norm(r: RunResult): RunResult {
    let out = r.stdout;
    // JSON form: blank `body`/`description` values.
    if (out.trimStart().startsWith('{') && out.includes('"body"')) {
        out = out
            .replace(/("body":\s*)"(?:[^"\\]|\\.)*"/, '$1"<MASKED>"')
            .replace(/("description":\s*)"(?:[^"\\]|\\.)*"/, '$1"<MASKED>"');
    } else {
        // Section form for a PRESENT skill: header then a real body.
        const m = out.match(/^([\s\S]*?## Skill context: [^\n]*\n)[\s\S]+$/);
        if (m) {
            out = m[1] + '<BODY>\n';
        }
    }
    return { status: r.status, stdout: out, stderr: r.stderr };
}

describe('workspace_skills — resolve present skill', () => {
    it.skipIf(!SKILL)('section format (header + masked body)', () => {
        expect(norm(runTs(['resolve', SKILL as string]))).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "

          ## Skill context: accessibility-auditor
          <BODY>
          ",
          }
        `);
    });
    it.skipIf(!SKILL)('--format json (masked body + description)', () => {
        expect(norm(runTs(['resolve', SKILL as string, '--format', 'json']))).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"body": "<MASKED>", "description": "<MASKED>", "found": true, "name": "accessibility-auditor"}
          ",
          }
        `);
    });
    it.skipIf(!SKILL)('--format=json inline form (masked)', () => {
        expect(norm(runTs(['resolve', SKILL as string, '--format=json']))).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"body": "<MASKED>", "description": "<MASKED>", "found": true, "name": "accessibility-auditor"}
          ",
          }
        `);
    });
});

describe('workspace_skills — resolve note path', () => {
    it('invalid id (charset reject)', () => {
        expect(runTs(['resolve', 'Bad Id'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "

          ## Skill context

          > skill \`Bad Id\` is not a valid id.
          ",
          }
        `);
    });
    it('missing id (section note)', () => {
        expect(runTs(['resolve', 'nonexistent-skill-xyz'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "

          ## Skill context

          > skill \`nonexistent-skill-xyz\` not found — proceed without it.
          ",
          }
        `);
    });
    it('missing id (--format json note)', () => {
        expect(runTs(['resolve', 'nonexistent-skill-xyz', '--format', 'json'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"found": false, "note": "skill \`nonexistent-skill-xyz\` not found \\u2014 proceed without it"}
          ",
          }
        `);
    });
    it('empty-ish invalid id', () => {
        expect(runTs(['resolve', 'UPPER'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "

          ## Skill context

          > skill \`UPPER\` is not a valid id.
          ",
          }
        `);
    });
});

describe('workspace_skills — argparse errors', () => {
    it('no args → required cmd, exit 2', () => {
        expect(runTs([])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_skills [-h] {resolve} ...
          workspace_skills: error: the following arguments are required: cmd
          ",
            "stdout": "",
          }
        `);
    });
    it('bad subcommand → invalid choice, exit 2', () => {
        expect(runTs(['bogus'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_skills [-h] {resolve} ...
          workspace_skills: error: argument cmd: invalid choice: 'bogus' (choose from 'resolve')
          ",
            "stdout": "",
          }
        `);
    });
    it('resolve missing skill_hint → exit 2', () => {
        expect(runTs(['resolve'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_skills resolve [-h] [--format {section,json}] skill_hint
          workspace_skills resolve: error: the following arguments are required: skill_hint
          ",
            "stdout": "",
          }
        `);
    });
    it('resolve bad --format choice → exit 2', () => {
        expect(runTs(['resolve', 'docker', '--format', 'bogus'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_skills resolve [-h] [--format {section,json}] skill_hint
          workspace_skills resolve: error: argument --format: invalid choice: 'bogus' (choose from 'section', 'json')
          ",
            "stdout": "",
          }
        `);
    });
    it('resolve extra positional → unrecognized, exit 2', () => {
        expect(runTs(['resolve', 'a', 'b'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_skills [-h] {resolve} ...
          workspace_skills: error: unrecognized arguments: b
          ",
            "stdout": "",
          }
        `);
    });
    it('top-level -h → usage line + exit 0', () => {
        const r = runTs(['-h']);
        expect({ status: r.status, usage: r.stdout.split('\n')[0] }).toMatchInlineSnapshot(`
          {
            "status": 0,
            "usage": "usage: workspace_skills [-h] {resolve} ...",
          }
        `);
    });
});
