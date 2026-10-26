/**
 * The `lint_persistence` command `schema-review` teaches must run as written.
 * The arguments are read from the skill text itself, so a drift in the taught
 * line — an extra `--`, a renamed flag — fails here instead of in a consumer.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SKILL = path.join(REPO, 'src', 'skills', 'schema-review', 'SKILL.md');
const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');
const SCRIPT = path.join(REPO, 'src', 'scripts', 'lint_persistence.ts');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'persistence', 'migrations', 'safe');

/** The taught arguments after the script path, optional `[...]` groups dropped, `<path>` filled in. */
function taughtArgs(skillText: string, dir: string): string[] {
    const line = skillText.split('\n').find((l) => /lint_persistence\.ts\s/.test(l));
    if (!line) throw new Error('schema-review no longer teaches a lint_persistence command');
    const tail = line.slice(line.indexOf('lint_persistence.ts') + 'lint_persistence.ts'.length);
    return tail
        .replace(/\[[^\]]*\]/g, ' ')
        .trim()
        .split(/\s+/)
        .map((a) => (a === '<path>' ? dir : a));
}

describe('schema-review taught lint_persistence command', () => {
    it('runs verbatim against a fixture directory', () => {
        const args = taughtArgs(fs.readFileSync(SKILL, 'utf8'), FIXTURE);
        const r = spawnSync(TSX, [SCRIPT, ...args], { encoding: 'utf8' });
        expect(r.stderr).not.toMatch(/unknown argument/);
        expect(r.status).not.toBe(2);
        expect(() => JSON.parse(r.stdout)).not.toThrow();
    });

    it('rejects the separator form that broke it', () => {
        const args = taughtArgs('npx tsx x/lint_persistence.ts -- --dir <path> --format json', FIXTURE);
        const r = spawnSync(TSX, [SCRIPT, ...args], { encoding: 'utf8' });
        expect(r.status).toBe(2);
    });
});
