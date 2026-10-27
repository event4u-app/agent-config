/**
 * J.7a — the self-search count ratchets down: red above the baseline, --write
 * only lowers it, and the real tree holds its baseline.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BASELINE_REL, REPO_ROOT, main, selfSearchLines } from '../../src/scripts/check_self_search_ratchet.js';

let root: string;
const put = (rel: string, body: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
};
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'self-search-'));
    put('src/skills/a/SKILL.md', "```bash\nrg -n 'x' .\n```\nUse `codebase-retrieval` here.\nUse code-graph ask.\n");
    put(BASELINE_REL, JSON.stringify({ count: 2 }));
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});
afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
});

describe('check_self_search_ratchet', () => {
    it('counts inline sweeps and foreign tool names, not the scan or ask verbs', () => {
        expect(selfSearchLines(root)).toEqual(['src/skills/a/SKILL.md:2', 'src/skills/a/SKILL.md:4']);
    });

    it('is red when a planted sweep pushes the count over the baseline', () => {
        expect(main([], root)).toBe(0);
        put('src/rules/b.md', 'grep -rn foo .\n');
        expect(main([], root)).toBe(1);
    });

    it('--write lowers the baseline and never raises it', () => {
        put(BASELINE_REL, JSON.stringify({ count: 9 }));
        main(['--write'], root);
        expect(JSON.parse(fs.readFileSync(path.join(root, BASELINE_REL), 'utf-8')).count).toBe(2);
        put('src/rules/b.md', 'rg -n bar\n');
        main(['--write'], root);
        expect(JSON.parse(fs.readFileSync(path.join(root, BASELINE_REL), 'utf-8')).count).toBe(2);
    });

    it('the real tree holds its baseline', () => {
        expect(main([], REPO_ROOT)).toBe(0);
    });
});
