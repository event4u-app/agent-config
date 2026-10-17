// road-to-skills-that-arrive-when-called 0.1 — the skill census per host and
// install path. Verify: two runs at one commit are byte-equal, and every row's
// totals equal the authored count (`ls src/skills/*/SKILL.md | wc -l`).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stats } from '../../src/scripts/count_scoped_projection.js';
import { build_census, load_entries, type Census } from '../../src/scripts/report_skill_host_census.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

function authoredByLs(): number {
    const dir = path.join(REPO_ROOT, 'src', 'skills');
    return fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'SKILL.md'))).length;
}

function runCli(): string {
    const r = spawnSync(path.join(REPO_ROOT, 'scripts-run'), ['src/scripts/report_skill_host_census'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });
    expect(r.status, r.stderr).toBe(0);
    return r.stdout;
}

describe('report_skill_host_census (0.1)', () => {
    it('two runs at one commit are byte-equal', () => {
        const a = runCli();
        const b = runCli();
        expect(a.length).toBeGreaterThan(100);
        expect(b).toBe(a);
    }, 60_000);

    const census: Census = build_census(load_entries());

    it('every row sums to the authored count', () => {
        const authored = authoredByLs();
        expect(census.authored).toBe(authored);
        expect(census.rows.length).toBeGreaterThan(0);
        for (const r of census.rows) {
            expect(r.installed + r.not_installed, `${r.host}/${r.install_path}`).toBe(authored);
        }
    });

    it('the default path is the installer projection, the full path is everything', () => {
        const s = stats();
        for (const r of census.rows) {
            expect(r.installed).toBe(r.install_path === 'default' ? s.projected : s.total);
        }
    });

    it('names-only never exceeds the listing with descriptions', () => {
        for (const r of census.rows) {
            expect(r.listing_chars_names_only).toBeLessThan(r.listing_chars_with_descriptions);
        }
    });

    it('covers the first and second host, and labels what it has not read', () => {
        const hosts = new Set(census.rows.map((r) => r.host));
        expect(hosts.has('claude-code')).toBe(true);
        expect(hosts.has('codex')).toBe(true);
        const claude = census.rows.find((r) => r.host === 'claude-code' && r.install_path === 'default');
        expect(claude?.root_read).toBe('yes');
        expect(claude?.omitted.state).toBe('modelled');
        // Codex's page names $HOME/.agents/skills; the installer writes ~/.codex/skills.
        expect(census.rows.find((r) => r.host === 'codex')?.root_read).toBe('no');
        const other = census.rows.find((r) => r.host !== 'claude-code' && r.host !== 'codex');
        expect(other?.omitted).toEqual({ state: 'unobserved' });
        expect(other?.root_read).toBe('unobserved');
    });
});
