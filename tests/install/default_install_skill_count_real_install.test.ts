/**
 * `default-install-context-cost`, read off a real install instead of the predicate.
 *
 * The claim says the scoped-projection default for new installs ships N of M
 * skills. Its `exec:` evidence used to be `update_counts --check`, which proves
 * the published figure equals what `count_scoped_projection` computes — and
 * `count_scoped_projection` applies the installer's predicate to the catalog in
 * this repository. That is a statement about the predicate, not about what lands
 * in a consumer's `~/.claude/skills/`: an installer that stopped applying the
 * predicate, or applied it to a different catalog, would leave both green.
 *
 * So this case runs the real bash orchestrator into a throwaway HOME, counts the
 * catalog skills that actually arrived, and holds three numbers equal: the
 * installed count, the predicate's `projected`, and the `N of M` the ledger
 * publishes. Directories the install writes that are not catalog skills (command
 * wrappers) are excluded by name, never by count.
 *
 * HOME and EVENT4U_CONFIG_HOME are injected, never inherited, per
 * `docs/contracts/consumer-harness.md`.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { stats } from '../../src/scripts/count_scoped_projection.js';
import { iter_skills } from '../../src/scripts/update_counts.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const ORCHESTRATOR = path.join(REPO_ROOT, 'src', 'scripts', 'install');
const CLAIMS = path.join(REPO_ROOT, 'docs', 'CLAIMS.md');

const made: string[] = [];

afterEach(() => {
    while (made.length > 0) fs.rmSync(made.pop() as string, { recursive: true, force: true });
});

function mkTmp(prefix: string): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    made.push(dir);
    return dir;
}

/** The `N of M` the ledger publishes for this claim. */
function publishedFigure(): { projected: number; total: number } {
    const block = fs.readFileSync(CLAIMS, 'utf8').split(/^### claim: /m).find((b) => b.startsWith('default-install-context-cost\n'));
    expect(block, 'claim default-install-context-cost is missing from docs/CLAIMS.md').toBeDefined();
    const m = /ships (\d+) of (\d+) skills/.exec(block as string);
    expect(m, 'the claim no longer states "ships N of M skills"').not.toBeNull();
    return { projected: Number(m?.[1]), total: Number(m?.[2]) };
}

describe('default-install-context-cost — a real global claude-code install', () => {
    it('installs exactly the projected catalog skills the ledger publishes', () => {
        const home = mkTmp('skillcount-home-');
        const cwd = mkTmp('skillcount-cwd-');

        const r = spawnSync('bash', [ORCHESTRATOR, '--global', '--tools=claude-code', '--yes', '--quiet'], {
            cwd,
            encoding: 'utf8',
            timeout: 240_000,
            env: {
                ...process.env,
                HOME: home,
                EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
                AGENT_CONFIG_DEPLOY_INVENTORY: undefined,
                AGENT_CONFIG_INSTALLED_TOOLS: undefined,
                AGENT_CONFIG_NO_UI: '1',
                CI: '1',
            },
        });
        expect(r.status, `install failed:\n${r.stdout}\n${r.stderr}`).toBe(0);

        const catalog = new Set([...iter_skills()].map((f) => path.basename(path.dirname(f))));
        const installed = fs
            .readdirSync(path.join(home, '.claude', 'skills'))
            .filter((name) => catalog.has(name));

        const predicate = stats();
        const published = publishedFigure();

        expect(catalog.size).toBe(predicate.total);
        expect(installed.length).toBe(predicate.projected);
        expect(published).toStrictEqual({ projected: predicate.projected, total: predicate.total });
    }, 300_000);
});
