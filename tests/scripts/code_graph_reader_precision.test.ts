import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { isDocOrExamplePath, isFixturePath } from '../../src/scripts/code_graph/fixture_paths.js';
import { DELIVERY_RULES, readDelivery } from '../../src/scripts/code_graph/lanes/delivery/index.js';
import { generatedMatcher, readHistory } from '../../src/scripts/code_graph/lanes/history/history.js';
import { isLocalHost, readInterfaces } from '../../src/scripts/code_graph/lanes/interfaces/index.js';
import type { LaneOutput } from '../../src/scripts/code_graph/lanes/lane_fact.js';
import { RUNTIME_RULES, evaluateRules, readRuntime } from '../../src/scripts/code_graph/lanes/runtime/index.js';

const ROOT = path.resolve(__dirname, '..', '..');
const P1_BLOG = path.join(ROOT, 'tests', 'fixtures', 'code-graph', 'correctness', 'p1-blog');

const tmp: string[] = [];
afterAll(() => {
    for (const d of tmp) fs.rmSync(d, { recursive: true, force: true });
});

function tree(files: Record<string, string>): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-precision-')));
    tmp.push(dir);
    for (const [rel, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), text);
    }
    return dir;
}

const skipReasons = (out: LaneOutput): string[] => out.skipped.map((s) => s.reason);

describe('fixture and doc paths are judged relative to the scanned root', () => {
    it.each(['tests/a.sql', 'app/test/x.ts', 'src/__tests__/x.ts', 'spec/models/user_spec.rb', 'pkg/testdata/schema.sql', 'a/fixtures/b/schema.sql', 'internal/bench/case/repo/db.sql', 'benches/run.rs', 'src/x.test.ts', 'pkg/x_test.go'])(
        '%s is a fixture path',
        (p) => expect(isFixturePath(p)).toBe(true),
    );
    it.each(['database/migrations/2024_01_01_create_users.php', 'src/testing_utils.ts', 'app/Contest.php', 'db/schema.sql', 'src/benchmark_api.ts'])('%s is not a fixture path', (p) =>
        expect(isFixturePath(p)).toBe(false),
    );
    it.each(['docs/api.md', 'examples/client.ts', 'README.md', 'src/notes.mdx'])('%s is doc or example', (p) => expect(isDocOrExamplePath(p)).toBe(true));
    it.each(['src/docker.ts', 'src/client.ts', 'samplesize.ts'])('%s is neither doc nor example', (p) => expect(isDocOrExamplePath(p)).toBe(false));
});

describe('interfaces: local hosts and non-traffic files create no external service', () => {
    const root = tree({
        'docker-compose.yml': 'services:\n  billing:\n    image: billing:1.2\n',
        'src/client.ts': [
            "export const a = () => fetch('http://127.0.0.1:8787/health');",
            "export const b = () => fetch('http://localhost:3000/api');",
            "export const c = () => fetch('http://billing/invoices');",
            "export const d = () => fetch('http://shop.test/products');",
            "export const e = () => fetch('http://host.docker.internal:9000/x');",
            "export const f = () => fetch('https://api.partner-payments.example.org/v1/charges');",
            '',
        ].join('\n'),
        'tests/client.ts': "export const t = () => fetch('https://api.only-in-tests.example.org/x');\n",
        'docs/usage.ts': "export const u = () => fetch('https://api.only-in-docs.example.org/x');\n",
        'examples/demo.ts': "export const v = () => fetch('https://api.only-in-examples.example.org/x');\n",
        'internal/bench/case/repo/src/x.ts': "export const w = () => fetch('https://api.only-in-bench.example.org/x');\n",
    });
    const out = readInterfaces(root);
    const services = out.facts.filter((f) => f.kind === 'service').map((f) => f.name).sort();

    it('lists the one real outside system', () => {
        expect(services).toEqual(['api.partner-payments.example.org']);
    });

    it('drops loopback, compose-service, .test and docker-host services with their calls, and counts them', () => {
        expect(out.relations.filter((r) => r.relation === 'calls-out')).toHaveLength(1);
        expect(skipReasons(out).find((r) => /local host/.test(r))).toMatch(/^5 local host\(s\) .* with 5 call site\(s\)/);
    });

    it('reads no test, doc, example or benchmark file, and says how many it left out', () => {
        expect(services.some((s) => /only-in/.test(s))).toBe(false);
        expect(skipReasons(out).find((r) => /not read: they describe no system/.test(r))).toMatch(/^4 /);
    });

    it('with includeTests the left-out files are read again', () => {
        const all = readInterfaces(root, { includeTests: true }).facts.filter((f) => f.kind === 'service').map((f) => f.name);
        expect(all).toEqual(expect.arrayContaining(['api.only-in-tests.example.org', 'api.only-in-docs.example.org']));
    });

    it.each(['127.0.0.1', '127.1.2.3', 'localhost', '0.0.0.0', '::1', 'app.localhost', 'printer.local', 'shop.test', 'host.docker.internal', 'redis'])('%s is local', (h) =>
        expect(isLocalHost(h)).toBe(true),
    );
    it.each(['api.github.com', 'example.com', '${base}', '10.0.0.1.example.net'])('%s is not local', (h) => expect(isLocalHost(h)).toBe(false));

    it('keeps a .test-hosted service that a contract describes', () => {
        const withContract = readInterfaces(path.join(ROOT, 'tests', 'fixtures', 'code-graph', 'interfaces', 'others'));
        expect(withContract.facts.some((f) => f.id === 'service:shop')).toBe(true);
    });
});

describe('runtime RT-3: an env read is judged only where a declaring file speaks for it', () => {
    const rt3 = (out: LaneOutput): string[] =>
        evaluateRules(RUNTIME_RULES, [out])
            .filter((f) => f.rule === 'RT-3')
            .map((f) => f.subject)
            .sort();
    const codeFact = (out: LaneOutput, name: string) => out.facts.find((f) => f.kind === 'env-var' && f.attrs['source'] === 'code' && f.name === name);

    it('with no compose, example, devcontainer or manifest: no finding, check unknown', () => {
        const root = tree({ 'src/cli.ts': 'const a = process.env.TOOL_HOME;\nconst b = process.env.TOOL_DEBUG;\n' });
        const out = readRuntime(root);
        expect(rt3(out)).toEqual([]);
        expect(codeFact(out, 'TOOL_HOME')?.attrs['env_check']).toBe('unknown');
        expect(skipReasons(out).some((r) => /^env check unknown: 2 env name read/.test(r))).toBe(true);
    });

    it('an env example at the root judges every read: the undeclared one is a finding', () => {
        const root = tree({ '.env.example': 'DB_HOST=\n', 'src/db.ts': 'const h = process.env.DB_HOST;\nconst p = process.env.DB_PASSWORD;\n' });
        const out = readRuntime(root);
        expect(rt3(out)).toEqual(['env-var:code:src/db.ts#DB_PASSWORD']);
        expect(codeFact(out, 'DB_PASSWORD')?.attrs['env_check']).toBe('complete');
    });

    it('a compose build context judges the code under it only; reads elsewhere are counted, not reported', () => {
        const root = tree({
            'docker-compose.yml': 'services:\n  api:\n    build: ./api\n    environment:\n      API_PORT: "80"\n',
            'api/server.ts': 'const port = process.env.API_PORT;\nconst key = process.env.API_SECRET;\n',
            'tools/sync.ts': 'const t = process.env.SYNC_TOKEN;\n',
        });
        const out = readRuntime(root);
        expect(rt3(out)).toEqual(['env-var:code:api/server.ts#API_SECRET']);
        expect(codeFact(out, 'SYNC_TOKEN')?.attrs['declared_scope']).toBe(false);
        expect(skipReasons(out).some((r) => /^env check partial: 1 env name read\(s\) in 1 file/.test(r))).toBe(true);
    });

    it('a build context outside the scanned root speaks for nothing', () => {
        const root = tree({
            'deploy/docker-compose.yml': 'services:\n  app:\n    build:\n      context: ../../..\n    environment:\n      PORT_X: "1"\n',
            'src/app.ts': 'const x = process.env.APP_ONLY;\n',
        });
        const out = readRuntime(root);
        expect(rt3(out)).toEqual([]);
        expect(skipReasons(out).some((r) => /build context \.\.\/\.\.\/\.\. lies outside the scanned root/.test(r))).toBe(true);
    });

    it('a name read only by a test or fixture file is not read at all', () => {
        const root = tree({ '.env.example': 'A=\n', 'tests/setup.ts': 'process.env.ONLY_IN_TESTS;\n', 'src/x.spec.ts': 'process.env.ONLY_IN_SPEC;\n', 'internal/bench/r/x.ts': 'process.env.ONLY_IN_BENCH;\n' });
        const out = readRuntime(root);
        expect(out.facts.filter((f) => f.kind === 'env-var' && f.attrs['source'] === 'code')).toEqual([]);
    });

    it('a devcontainer and a Kubernetes manifest declare names too', () => {
        const root = tree({
            '.devcontainer/devcontainer.json': '{ "image": "node:22", "containerEnv": { "DEV_FLAG": "1" } }',
            'k8s/deploy.yaml':
                'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  template:\n    spec:\n      containers:\n        - name: web\n          image: web:1\n          env:\n            - name: K8S_NAME\n              value: x\n',
            'src/a.ts': 'process.env.DEV_FLAG; process.env.K8S_NAME; process.env.NOWHERE;\n',
        });
        const out = readRuntime(root);
        expect(out.facts.some((f) => f.kind === 'env-var' && f.attrs['source'] === 'devcontainer' && f.name === 'DEV_FLAG')).toBe(true);
        expect(out.facts.some((f) => f.kind === 'env-var' && f.attrs['source'] === 'kubernetes' && f.name === 'K8S_NAME')).toBe(true);
        expect(rt3(out)).toEqual(['env-var:code:src/a.ts#NOWHERE']);
    });

    it('compose files in a fixture or benchmark tree are not this project’s runtime', () => {
        const root = tree({ 'internal/bench/case/docker-compose.yml': 'services:\n  web:\n    image: nginx:1.27\n', 'tests/fixtures/x/docker-compose.yml': 'services:\n  db:\n    image: postgres:16\n' });
        const out = readRuntime(root);
        expect(out.facts.filter((f) => f.kind === 'service')).toEqual([]);
    });
});

describe('data: a schema in a fixture tree is not the project’s data model', () => {
    const tableNames = (g: { nodes: { kind: string; label: string }[] }): string[] =>
        g.nodes
            .filter((n) => n.kind === 'table')
            .map((n) => n.label)
            .sort();

    it('replays the root schema and none of the nested fixture, testdata or bench schemas', async () => {
        const root = tree({
            'db/schema.sql': 'CREATE TABLE real_orders (id INT PRIMARY KEY);\n',
            'tests/fixtures/x/schema.sql': 'CREATE TABLE fixture_table (id INT);\n',
            'pkg/testdata/schema.sql': 'CREATE TABLE testdata_table (id INT);\n',
            'internal/bench/case/repo/migrations/001_init.sql': 'CREATE TABLE bench_table (id INT);\n',
            'prisma/schema.prisma': 'datasource db {\n  provider = "postgresql"\n  url = env("DATABASE_URL")\n}\nmodel Account {\n  id Int @id\n}\n',
            'fixtures/p/schema.prisma': 'datasource db {\n  provider = "postgresql"\n  url = env("DATABASE_URL")\n}\nmodel FixtureModel {\n  id Int @id\n}\n',
        });
        const r = await buildFromRepo(root, null, { lanes: true });
        const names = tableNames(r.graph);
        expect(names).toContain('real_orders');
        expect(names).toContain('Account');
        expect(names.some((n) => /fixture|testdata|bench|FixtureModel/i.test(n))).toBe(false);
    });

    it('a Laravel app copied under tests/fixtures contributes no table', async () => {
        const root = tree({ 'db/schema.sql': 'CREATE TABLE only_table (id INT);\n' });
        fs.cpSync(P1_BLOG, path.join(root, 'tests', 'fixtures', 'p1-blog'), { recursive: true });
        const names = tableNames((await buildFromRepo(root, null, { lanes: true })).graph);
        expect(names).toEqual(['only_table']);
    });

    it('the same Laravel app scanned as its own root keeps its tables', async () => {
        const names = tableNames((await buildFromRepo(P1_BLOG, null)).graph);
        expect(names).toEqual(expect.arrayContaining(['comments', 'posts', 'users']));
    });
});

describe('history: a pair of two generated files is no hidden dependency', () => {
    const RS = '\x1e';
    const US = '\x1f';
    const files = ['src/a.ts', 'dist/a.js', 'dist/b.js', 'package-lock.json', 'CHANGELOG.md', 'src/b.ts'];
    const log = [0, 1, 2, 3]
        .map((i) => `${RS}${'0'.repeat(39)}${i}${US}2026-10-0${i + 1}\n\n${files.map((f) => `M\t${f}`).join('\n')}\n`)
        .join('');
    const git = (_root: string, args: readonly string[]): string => {
        if (args.includes('-1')) return '2026-10-05T00:00:00Z\n';
        if (args.includes('--is-shallow-repository')) return 'false\n';
        if (args.includes('ls-files')) return files.join('\0');
        return log;
    };

    it('drops generated↔generated pairs, keeps source↔generated and source↔source', () => {
        const out = readHistory('/repo', { git });
        const pairs = out.relations.map((r) => `${r.from}|${r.to}`);
        expect(pairs).toContain('src/a.ts|src/b.ts');
        expect(pairs).toContain('dist/a.js|src/a.ts');
        expect(pairs).not.toContain('dist/a.js|dist/b.js');
        expect(pairs).not.toContain('CHANGELOG.md|package-lock.json');
        expect(pairs.some((p) => p.split('|').every((f) => /^dist\/|lock|CHANGELOG/.test(f)))).toBe(false);
        expect(skipReasons(out)).toContain('6 coupled pair(s) of two generated files skipped');
    });

    it('with no generated globs every pair stays', () => {
        const out = readHistory('/repo', { git, generated: [] });
        expect(out.relations).toHaveLength((files.length * (files.length - 1)) / 2);
    });

    it('matches a glob with a slash on the path and one without on the basename', () => {
        const g = generatedMatcher(['dist/**', '*.lock', 'CHANGELOG*']);
        expect(g('dist/x/y.js')).toBe(true);
        expect(g('packages/a/yarn.lock')).toBe(true);
        expect(g('docs/CHANGELOG.md')).toBe(true);
        expect(g('src/dist/x.js')).toBe(false);
        expect(g('src/lockfile.ts')).toBe(false);
    });
});

describe('delivery DL-4: a deploy word in a name is outweighed by a checking word', () => {
    const wf = (name: string, jobs: string): string => `name: ${name}\non:\n  push:\n    branches: [main]\njobs:\n${jobs}`;
    const job = (id: string, title: string, extra = ''): string => `  ${id}:\n    name: ${title}\n    runs-on: ubuntu-latest\n${extra}    steps:\n      - run: echo hi\n`;
    const dl4 = (root: string): string[] =>
        evaluateRules(DELIVERY_RULES, [readDelivery(root)])
            .filter((f) => f.rule === 'DL-4')
            .map((f) => f.subject)
            .sort();

    it('does not take dry-run, e2e, detector or a validation/health workflow for a deploy', () => {
        const root = tree({
            '.github/workflows/matrix.yml': wf('Matrix', job('worker-dry-run', 'Worker deploy dry-run') + job('release-e2e', 'Release install E2E') + job('release-shape', 'Release-PR shape detector')),
            '.github/workflows/validation.yml': wf('Release Validation', job('release-holds', 'No open hold blocks the cut')),
            '.github/workflows/health.yml': wf('Release-Adjacent Health', job('watch', 'Watch release workflows')),
        });
        expect(dl4(root)).toEqual([]);
    });

    it('still reports a real deploy by name, by environment and by command', () => {
        const root = tree({
            '.github/workflows/ship.yml': wf(
                'Ship',
                job('deploy', 'deploy') + job('publish', 'Publish', '    environment: production\n') + `  roll:\n    runs-on: ubuntu-latest\n    steps:\n      - run: kubectl apply -f k8s/\n`,
            ),
            '.github/workflows/validation.yml': wf('Release Validation', job('push-site', 'Push site', '    environment: pages\n')),
        });
        expect(dl4(root)).toEqual([
            'job:.github/workflows/ship.yml#deploy',
            'job:.github/workflows/ship.yml#publish',
            'job:.github/workflows/ship.yml#roll',
            'job:.github/workflows/validation.yml#push-site',
        ]);
    });

    it('is silent once the deploy needs a test job', () => {
        const root = tree({ '.github/workflows/ship.yml': wf('Ship', job('test', 'test') + job('deploy', 'deploy', '    needs: test\n')) });
        expect(dl4(root)).toEqual([]);
    });
});
