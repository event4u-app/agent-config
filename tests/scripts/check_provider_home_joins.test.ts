/**
 * road-to-the-profile-the-session-runs-in 1.7 — a new hardcoded provider-home
 * join in a runtime dir is red; the resolver itself and tests are exempt; the
 * real tree holds its baseline.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BASELINE_REL, REPO_ROOT, joinSites, main } from '../../src/scripts/check_provider_home_joins.js';

let root: string;
const put = (rel: string, body: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
};
const baseline = (files: Record<string, number>): void => put(BASELINE_REL, JSON.stringify({ files }));

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-joins-'));
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    put('src/scripts/_lib/a.ts', "const x = path.join(home, '.claude', 'rules');\n");
    put('src/scripts/_lib/provider_home.ts', "return path.join(home, '.codex');\n");
    put('src/scripts/_lib/a.test.ts', "path.join(os.homedir(), '.gemini');\n");
    put('src/scripts/measure.ts', "path.join(os.homedir(), '.claude');\n");
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
});

describe('check_provider_home_joins', () => {
    it('counts runtime joins only — not the resolver, tests, or maintainer scripts', () => {
        expect(joinSites(root)).toEqual(['src/scripts/_lib/a.ts:1']);
    });

    it('green at the baseline, red on an inserted join', () => {
        baseline({ 'src/scripts/_lib/a.ts': 1 });
        expect(main([], root)).toBe(0);
        put('src/scripts/_cli/b.ts', "const d = path.join(os.homedir(), '.codex', 'sessions');\n");
        expect(main([], root)).toBe(1);
    });

    it('--write only lowers and drops zeros', () => {
        baseline({ 'src/scripts/_lib/a.ts': 3, 'src/scripts/_lib/gone.ts': 2 });
        expect(main(['--write'], root)).toBe(0);
        const files = (JSON.parse(fs.readFileSync(path.join(root, BASELINE_REL), 'utf-8')) as { files: Record<string, number> }).files;
        expect(files).toEqual({ 'src/scripts/_lib/a.ts': 1 });
    });

    it('missing baseline is a usage error', () => {
        expect(main([], root)).toBe(2);
    });

    it('the real tree holds its baseline', () => {
        expect(main([], REPO_ROOT)).toBe(0);
    });
});
