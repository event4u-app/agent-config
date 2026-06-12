// Tests for src/scripts/skill_usage_collect.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure helpers (project_slug, extract_listing, extract_text, find_mentions,
// hash_prompt) plus a golden-parity layer that builds a synthetic session
// jsonl under a UNIQUE ~/.claude/projects/<slug>/ dir, runs python3 vs tsx, and
// compares stdout + the appended compact JSONL byte-for-byte (incl. the
// dedup-on-second-run path). The fixture dir + temp out are removed afterwards
// so the test leaves zero git drift and never touches real session data.
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as su from '../../src/scripts/skill_usage_collect.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'skill_usage_collect.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'skill_usage_collect.py');
const TMP_DIR = path.join(REPO_ROOT, 'dist', 'migration');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('skill_usage_collect — pure helpers', () => {
    it('project_slug replaces every / with -', () => {
        expect(su.project_slug('/a/b/c')).toBe('-a-b-c');
    });
    it('extract_listing reads slugs from a skill_listing attachment', () => {
        const got = su.extract_listing({
            type: 'attachment',
            attachment: { type: 'skill_listing', content: '- alpha: x\n- beta-skill: y\n' },
        });
        expect([...got].sort()).toEqual(['alpha', 'beta-skill']);
    });
    it('extract_listing returns empty for a non-listing attachment', () => {
        expect(su.extract_listing({ attachment: { type: 'other' } }).size).toBe(0);
    });
    it('extract_text joins assistant text blocks', () => {
        const t = su.extract_text({
            type: 'assistant',
            message: { content: [{ type: 'text', text: 'a' }, { type: 'tool', text: 'skip' }, { type: 'text', text: 'b' }] },
        });
        expect(t).toBe('a\nb');
    });
    it('find_mentions matches an anchor verb + backtick slug and a SKILL.md path', () => {
        const hits = su.find_mentions(
            'I am using `alpha` and see .claude/skills/gamma/SKILL.md',
            ['alpha', 'beta'],
        );
        expect(hits.has('alpha')).toBe(true);
        expect(hits.has('gamma')).toBe(true);
        expect(hits.has('beta')).toBe(false);
    });
    it('hash_prompt is the 16-char prefix of sha256(first 200 chars)', () => {
        const expected = crypto
            .createHash('sha256')
            .update(Buffer.from('hello', 'utf-8'))
            .digest('hex')
            .slice(0, 16);
        expect(su.hash_prompt('hello')).toBe(expected);
        expect(su.hash_prompt('')).toBe('');
    });
});

describe.runIf(hasPython3())('skill_usage_collect — golden parity (python3 vs tsx)', () => {
    const slug = `py2ts-test-${process.pid}-${Date.now()}`;
    const sessionDir = path.join(os.homedir(), '.claude', 'projects', slug);
    const pyOut = path.join(TMP_DIR, '_su.py.test.jsonl');
    const tsOut = path.join(TMP_DIR, '_su.ts.test.jsonl');

    beforeAll(() => {
        fs.mkdirSync(sessionDir, { recursive: true });
        fs.mkdirSync(TMP_DIR, { recursive: true });
        const lines = [
            JSON.stringify({
                type: 'user',
                message: { content: 'please help' },
                timestamp: '2026-06-11T00:00:00Z',
            }),
            JSON.stringify({
                type: 'attachment',
                attachment: {
                    type: 'skill_listing',
                    content: '- alpha-skill: do alpha\n- beta-skill: do beta\n',
                },
            }),
            JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        {
                            type: 'text',
                            text: 'I am using `alpha-skill` here. Also see .claude/skills/gamma-skill/SKILL.md',
                        },
                    ],
                },
                timestamp: '2026-06-11T00:00:01Z',
            }),
            JSON.stringify({
                type: 'user',
                message: { content: 'thanks' },
                timestamp: '2026-06-11T00:01:00Z',
            }),
            JSON.stringify({
                type: 'assistant',
                message: { content: 'route `beta-skill` now' },
                timestamp: '2026-06-11T00:01:02Z',
            }),
        ];
        fs.writeFileSync(path.join(sessionDir, 'sess1.jsonl'), lines.join('\n') + '\n');
    });
    afterAll(() => {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        for (const f of [pyOut, tsOut]) {
            if (fs.existsSync(f)) {
                fs.rmSync(f);
            }
        }
    });

    it('stdout + appended JSONL match on a fresh run', () => {
        for (const f of [pyOut, tsOut]) {
            if (fs.existsSync(f)) fs.rmSync(f);
        }
        const py = spawnSync('python3', [PY_SCRIPT, '--project-slug', slug, '--out', pyOut], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--project-slug', slug, '--out', tsOut], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        expect(ts.status).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.stdout.replace('_su.ts.test', '_su')).toBe(py.stdout.replace('_su.py.test', '_su'));
        expect(fs.readFileSync(tsOut, 'utf-8')).toBe(fs.readFileSync(pyOut, 'utf-8'));
    });

    it('dedup: a second run appends 0 and the JSONL stays identical', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--project-slug', slug, '--out', pyOut], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--project-slug', slug, '--out', tsOut], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toContain('Wrote 0 new record(s)');
        expect(py.stdout).toContain('Wrote 0 new record(s)');
        expect(fs.readFileSync(tsOut, 'utf-8')).toBe(fs.readFileSync(pyOut, 'utf-8'));
    });

    it('no session files → exit 0 with matching stderr', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--project-slug', 'zzz-no-such-slug-xyz'], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--project-slug', 'zzz-no-such-slug-xyz'], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });
});
