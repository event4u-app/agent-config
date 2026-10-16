// `doctor`'s artifact-location row against a fixture consumer monorepo — the
// outward half of `check_agent_artifact_location`. Runs the real doctor in a
// subprocess (seconds, not milliseconds), with a throwaway HOME per the
// consumer-harness contract, and asserts both halves of the promise: one
// finding naming the target, and a tree left byte-identical.
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { checkArtifactLocation } from '../../src/scripts/_lib/install_reach_checks.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
const DOCTOR = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_doctor.ts');

const ROADMAP =
    '---\ncomplexity: lightweight\nstatus: ready\n---\n' +
    '# Road to y\n\n## Phase 1 - a phase\n\n- [ ] **1.1 A step.**\n';

const made: string[] = [];

function mkTmp(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    made.push(dir);
    return dir;
}

afterEach(() => {
    for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function fixtureMonorepo(): string {
    const root = mkTmp('artloc-mono-');
    const files: Record<string, string> = {
        'package.json': '{"name":"mono","private":true}\n',
        'apps/x/docs/roadmaps/road-to-y.md': ROADMAP,
        'apps/x/README.md': '# x\n',
        'agents/roadmaps/road-to-already-home.md': ROADMAP,
        'vendor/acme/docs/road-to-theirs.md': ROADMAP,
    };
    for (const [rel, body] of Object.entries(files)) {
        const abs = path.join(root, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, body);
    }
    return root;
}

/** Every path and byte under `root` — the tree, not a sample of it. */
function digest(root: string): string {
    const h = crypto.createHash('sha256');
    const walk = (dir: string): void => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const full = path.join(dir, e.name);
            h.update(path.relative(root, full));
            if (e.isDirectory()) walk(full);
            else h.update(fs.readFileSync(full));
        }
    };
    walk(root);
    return h.digest('hex');
}

describe('doctor artifact-location — a fixture consumer monorepo', () => {
    it('reports exactly one advisory finding naming the target, through the real doctor', () => {
        const project = fixtureMonorepo();
        const home = mkTmp('artloc-home-');
        const before = digest(project);
        const r = spawnSync(TSX, [DOCTOR, '--project', project, '--check', 'artifact-location', '--json'], {
            cwd: project,
            encoding: 'utf8',
            timeout: 120_000,
            env: {
                ...process.env,
                HOME: home,
                EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
                AGENT_CONFIG_NO_UI: '1',
            },
        });
        const payload = JSON.parse(r.stdout) as { checks?: { id: string; status: string; message: string }[] };
        const row = (payload.checks ?? []).find((c) => c.id === 'artifact-location');
        expect(row, r.stdout + r.stderr).toBeDefined();
        expect(row?.status).toBe('warn');
        expect(row?.message).toMatch(/^1 roadmap-shaped file\(s\)/);
        expect(row?.message).toContain('apps/x/docs/roadmaps/road-to-y.md → agents/roadmaps/road-to-y.md');
        expect(row?.message).not.toContain('vendor/');
        expect(digest(project)).toBe(before);
    }, 150_000);

    it('a clean tree is ok and an empty one is skipped', () => {
        const clean = mkTmp('artloc-clean-');
        fs.mkdirSync(path.join(clean, 'agents', 'roadmaps'), { recursive: true });
        fs.writeFileSync(path.join(clean, 'agents', 'roadmaps', 'road-to-z.md'), ROADMAP);
        expect(checkArtifactLocation(clean).status).toBe('ok');
        expect(checkArtifactLocation(mkTmp('artloc-empty-')).status).toBe('skipped');
    });
});
