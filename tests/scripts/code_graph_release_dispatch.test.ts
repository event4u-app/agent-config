/**
 * `agent-config code-graph` must run from a shipped bundle on a release install.
 *
 * The defect, recorded in the 2026-11-01 newcomer walkthrough: every
 * `code-graph` command on a packed release printed `package-local tsx not
 * found — falling back to npx tsx` and then downloaded `tsx` from the registry,
 * because `tsx` is a devDependency and `cmd_code_graph` reached `exec_ts` with
 * no `dist/cli-delegate/` bundle to prefer. The site sells the code map as
 * offline; `npx` is a network fetch against the consumer's npm config.
 *
 * Two layers: the dispatcher's resolution, run against a release-shaped
 * package root (a bundle, no package-local tsx), and the real build script,
 * whose output must run as a command rather than as a silent no-op.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DISPATCH = path.join(REPO, 'src', 'scripts', '_dispatch.bash');
const BUNDLE_REL = path.join('dist', 'cli-delegate', 'code_graph', 'cli.js');

/** The two resolver functions, lifted out of the dispatcher verbatim. */
function resolverSource(): string {
    const src = fs.readFileSync(DISPATCH, 'utf-8');
    const fn = (name: string): string => {
        const m = src.match(new RegExp(`^${name}\\(\\) \\{[\\s\\S]*?^\\}`, 'm'));
        if (!m) throw new Error(`${name} not found in _dispatch.bash`);
        return m[0];
    };
    return `${fn('cli_delegate_bundle_is_stale')}\n${fn('cli_delegate_bundle')}\n`;
}

describe('code-graph dispatch on a release layout', () => {
    it('resolves src/scripts/code_graph/cli.ts to its dist/cli-delegate bundle', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-release-'));
        try {
            // Release shape: the bundle exists, shipped sources exist, no
            // node_modules/.bin/tsx anywhere under the package.
            fs.mkdirSync(path.join(root, path.dirname(BUNDLE_REL)), { recursive: true });
            fs.writeFileSync(path.join(root, BUNDLE_REL), '');
            fs.mkdirSync(path.join(root, 'src', 'scripts', 'code_graph'), { recursive: true });
            fs.writeFileSync(path.join(root, 'src', 'scripts', 'code_graph', 'cli.ts'), '');
            const script = `${resolverSource()}\nPACKAGE_ROOT="$1"\ncli_delegate_bundle "$PACKAGE_ROOT/src/scripts/code_graph/cli.ts"\n`;
            const res = spawnSync('bash', ['-c', script, 'probe', root], { encoding: 'utf-8' });
            expect(res.status).toBe(0);
            expect(res.stdout).toBe(path.join(root, BUNDLE_REL));
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('the package build produces the code-graph bundle', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf-8')) as {
            scripts: Record<string, string>;
        };
        // `build:delegates` is what `build` (and so `prepack`) runs; a bundle
        // script nobody calls ships nothing.
        expect(pkg.scripts['build:delegates']).toContain('build:code-graph-delegate');
    });
});

describe('code-graph bundle', () => {
    const bundle = path.join(REPO, BUNDLE_REL);

    beforeAll(() => {
        execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', '--silent', 'build:code-graph-delegate'], {
            cwd: REPO,
            stdio: ['ignore', 'pipe', 'pipe'],
            encoding: 'utf-8',
            timeout: 120_000,
        });
    }, 130_000);

    it('runs as the code-graph command, and no inlined module entry guard fires', () => {
        const res = spawnSync(process.execPath, [bundle, '--help'], { cwd: REPO, encoding: 'utf-8', timeout: 30_000 });
        expect(res.status).toBe(0);
        expect(res.stdout).toMatch(/code-graph/);
        // Inlined maintainer CLIs (discovery_graph, lineage tools) print their
        // own usage when their guard false-fires inside one bundle.
        expect(`${res.stdout}${res.stderr}`).not.toMatch(/usage: discovery_graph/);
    });

    it('builds a graph for a small project', () => {
        const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-proj-'));
        try {
            fs.writeFileSync(path.join(proj, 'a.js'), 'export function sum(a, b) { return a + b; }\n');
            fs.writeFileSync(path.join(proj, 'b.js'), "import { sum } from './a.js';\nexport const total = () => sum(1, 2);\n");
            const out = path.join(proj, 'graph.json');
            const res = spawnSync(process.execPath, [bundle, 'build', '--root', proj, '--out', out], {
                cwd: proj,
                encoding: 'utf-8',
                timeout: 60_000,
            });
            expect(res.stderr).not.toMatch(/tsx/);
            expect(res.status).toBe(0);
            expect(fs.existsSync(out)).toBe(true);
        } finally {
            fs.rmSync(proj, { recursive: true, force: true });
        }
    }, 70_000);
});
