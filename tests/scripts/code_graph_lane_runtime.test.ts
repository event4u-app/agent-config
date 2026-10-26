import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { spanHash, type LaneOutput } from '../../src/scripts/code_graph/lanes/lane_fact.js';
import { RUNTIME_RULES, evaluateRules, readRuntime } from '../../src/scripts/code_graph/lanes/runtime/index.js';
import { redactText } from '../../src/scripts/code_graph/lanes/runtime/redact.js';

const FIX = path.resolve(__dirname, '..', 'fixtures', 'code-graph', 'runtime');
const DRIFT = path.join(FIX, 'drift');
const CLEAN = path.join(FIX, 'clean');

const drift = readRuntime(DRIFT);
const clean = readRuntime(CLEAN);

const tmpDirs: string[] = [];
afterAll(() => {
    for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

function copyFixture(src: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-runtime-'));
    tmpDirs.push(dir);
    fs.cpSync(src, dir, { recursive: true });
    return dir;
}

const fact = (o: LaneOutput, id: string) => o.facts.find((f) => f.id === id);
const rel = (o: LaneOutput, relation: string, from: string, to: string) => o.relations.find((r) => r.relation === relation && r.from === from && r.to === to);
const dataLane = (engine: string): LaneOutput => ({
    lane: 'data',
    facts: [{ kind: 'connection', id: 'connection:default', name: 'default', attrs: { engine }, witness: { file: 'config/database.php', line: 4, hash: '00000000' }, rung: 'T1', owner: 'config/database.php' }],
    relations: [],
    skipped: [],
});

describe('runtime lane — facts', () => {
    it('every witness points at the line it was read from, and its hash is that line', () => {
        for (const [root, out] of [[DRIFT, drift], [CLEAN, clean]] as const) {
            for (const item of [...out.facts, ...out.relations]) {
                const lines = fs.readFileSync(path.join(root, item.witness.file), 'utf-8').split('\n');
                expect(item.witness.line, `${item.witness.file}`).toBeGreaterThanOrEqual(1);
                expect(spanHash((lines[item.witness.line - 1] ?? '').trimEnd())).toBe(item.witness.hash);
                expect(item.owner).toBe(item.witness.file);
            }
        }
    });

    it('reads compose services, images, published ports, networks, volumes and depends_on', () => {
        const names = drift.facts.filter((f) => f.kind === 'service' && f.attrs['source'] === 'compose').map((f) => f.name).sort();
        expect(names).toEqual(['app', 'cache', 'db', 'proxy']);
        const app = 'service:compose:compose.yaml#app';
        const db = 'service:compose:compose.yaml#db';
        expect(fact(drift, db)!.witness.line).toBe(16);
        const dbPort = drift.facts.find((f) => f.kind === 'port' && f.attrs['service'] === 'db')!;
        expect(dbPort.attrs).toMatchObject({ published: '5432', target: '5432', is_published: true, local_only: false });
        expect(rel(drift, 'publishes', db, dbPort.id)).toBeDefined();
        expect(rel(drift, 'on-network', app, 'network:compose.yaml#backend')).toBeDefined();
        expect(rel(drift, 'mounts', db, 'volume:compose.yaml#dbdata')).toMatchObject({ attrs: { target: '/var/lib/postgresql/data' } });
        expect(rel(drift, 'depends-on', app, db)).toBeDefined();
        expect(rel(drift, 'uses-image', app, 'image:built:Dockerfile')).toMatchObject({ attrs: { mechanism: 'build' } });
        const longSyntax = drift.facts.find((f) => f.kind === 'port' && f.attrs['service'] === 'proxy')!;
        expect(longSyntax.attrs).toMatchObject({ published: '8080', target: '8080', protocol: 'tcp' });
    });

    it('sets the database engine from the image on the service, so the data lane can read it', () => {
        expect(fact(drift, 'service:compose:compose.yaml#db')!.attrs['db_engine']).toBe('postgres');
        expect(fact(drift, 'service:compose:compose.yaml#cache')!.attrs['db_engine']).toBeNull();
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-runtime-engines-'));
        tmpDirs.push(dir);
        fs.writeFileSync(
            path.join(dir, 'compose.yaml'),
            'services:\n  a:\n    image: mysql:8.4\n  b:\n    image: mariadb:11\n  c:\n    image: mcr.microsoft.com/mssql/server:2022-latest\n  d:\n    image: keinos/sqlite3:3.46\n  e:\n    image: bitnami/postgresql:16\n  f:\n    image: mongo:7\n  g:\n    image: phpmyadmin:5\n',
        );
        const out = readRuntime(dir, { codeEnv: false });
        const engine = (n: string) => out.facts.find((f) => f.kind === 'service' && f.name === n)!.attrs['db_engine'];
        expect(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(engine)).toEqual(['mysql', 'mariadb', 'sqlserver', 'sqlite', 'postgres', null, null]);
    });

    it('reads Dockerfile base images per stage and exposed ports', () => {
        const stages = drift.facts.filter((f) => f.kind === 'image' && f.owner === 'Dockerfile' && f.attrs['stage'] !== undefined);
        expect(stages.map((s) => [s.attrs['repo'], s.attrs['tag'], s.attrs['alias']])).toEqual([
            ['node', '22-alpine', 'build'],
            ['nginx', 'latest', null],
        ]);
        const exposed = drift.facts.filter((f) => f.kind === 'port' && f.attrs['exposed'] === true).map((f) => f.name).sort();
        expect(exposed).toEqual(['443/tcp', '80/tcp']);
        const cleanStage = clean.facts.find((f) => f.id === 'image:Dockerfile#stage1')!;
        expect(cleanStage.attrs['from_stage']).toBe(0);
        expect(rel(clean, 'based-on', 'image:Dockerfile#stage1', 'image:Dockerfile#stage0')).toBeDefined();
    });

    it('reads the devcontainer, its compose service and forwarded ports', () => {
        const dc = 'service:devcontainer:.devcontainer/devcontainer.json';
        expect(fact(drift, dc)!.attrs['compose_service']).toBe('app');
        expect(rel(drift, 'depends-on', dc, 'service:compose:compose.yaml#app')).toBeDefined();
        expect(drift.facts.filter((f) => f.kind === 'port' && f.attrs['forwarded'] === true).map((f) => f.attrs['target']).sort()).toEqual(['5432', '8080']);
    });

    it('reads Make and Task targets with their dependencies', () => {
        const targets = drift.facts.filter((f) => f.kind === 'target').map((f) => `${f.attrs['tool']}:${f.name}`).sort();
        expect(targets).toEqual(['make:build', 'make:test', 'make:up', 'task:ci', 'task:lint', 'task:test']);
        expect(rel(drift, 'depends-on', 'target:make:Makefile#up', 'target:make:Makefile#build')).toBeDefined();
        expect(rel(drift, 'depends-on', 'target:task:Taskfile.yml#ci', 'target:task:Taskfile.yml#test')).toBeDefined();
    });

    it('a Taskfile with includes does not claim an undeclared dependency is missing', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-runtime-task-'));
        tmpDirs.push(dir);
        fs.writeFileSync(path.join(dir, 'Taskfile.yml'), "version: '3'\nincludes:\n  ci: ./taskfiles/ci.yml\ntasks:\n  all:\n    deps: [from-include]\n");
        expect(readRuntime(dir, { codeEnv: false }).relations).toEqual([]);
        fs.writeFileSync(path.join(dir, 'Taskfile.yml'), "version: '3'\ntasks:\n  all:\n    deps: [nowhere]\n");
        expect(readRuntime(dir, { codeEnv: false }).relations.map((r) => r.to)).toEqual(['target:task:Taskfile.yml#nowhere']);
    });

    it('reads Terraform blocks and references; a mapped connection type is an edge, not a node', () => {
        const tf = drift.facts.filter((f) => f.kind === 'resource' && f.attrs['tf_block']).map((f) => f.attrs['address']).sort();
        expect(tf).toEqual(['aws_instance.app', 'aws_route53_record.api', 'aws_security_group.db', 'aws_security_group.web', 'data.aws_ami.base', 'module.vpc', 'provider.aws']);
        const id = (a: string) => `resource:tf:infra:${a}`;
        expect(rel(drift, 'connects', id('aws_security_group.web'), id('aws_security_group.db'))).toMatchObject({ attrs: { mechanism: 'aws_security_group_rule' } });
        expect(rel(drift, 'references', id('aws_instance.app'), id('data.aws_ami.base'))).toBeDefined();
        expect(rel(drift, 'references', id('aws_route53_record.api'), id('module.vpc'))).toBeDefined();
        expect(fact(drift, id('module.vpc'))!.attrs['source']).toBe('./modules/vpc');
        const json = JSON.stringify(drift);
        expect(json).not.toContain('ghost');
        expect(json).not.toContain('inside_heredoc');
    });

    it('an unmapped type stays a node, and a mapped type whose ends cannot both resolve falls back to a node', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-runtime-tf-'));
        tmpDirs.push(dir);
        fs.writeFileSync(path.join(dir, 'main.tf'), 'resource "aws_security_group_rule" "half" {\n  security_group_id = var.sg\n}\nresource "unknown_thing" "x" {\n}\n');
        const out = readRuntime(dir, { codeEnv: false });
        expect(out.facts.map((f) => f.attrs['address']).sort()).toEqual(['aws_security_group_rule.half', 'unknown_thing.x']);
        expect(out.relations.filter((r) => r.relation === 'connects')).toEqual([]);
    });

    it('never reads Terraform state', () => {
        const dir = copyFixture(DRIFT);
        fs.writeFileSync(path.join(dir, 'infra', 'terraform.tfstate'), '{"resources":[{"type":"aws_db_instance","name":"from_state"}]}');
        const out = readRuntime(dir, { codeEnv: false });
        expect(JSON.stringify(out)).not.toContain('from_state');
        expect(out.skipped.map((s) => s.file)).not.toContain('infra/terraform.tfstate');
    });

    it('reads Kubernetes names with explicit-reference, label-selector and owner edges', () => {
        const k = (kind: string, name: string) => `resource:k8s:shop/${kind}/${name}`;
        expect(rel(drift, 'configured-by', k('Deployment', 'api'), k('ConfigMap', 'api-config'))).toMatchObject({ attrs: { mechanism: 'envFrom' } });
        expect(rel(drift, 'selects', k('Service', 'api'), k('Deployment', 'api'))).toMatchObject({ attrs: { mechanism: 'label-selector' } });
        expect(rel(drift, 'selects', k('Service', 'api'), k('ReplicaSet', 'api-7d9f'))).toBeUndefined();
        expect(rel(drift, 'routes-to', k('Ingress', 'api'), k('Service', 'api'))).toBeDefined();
        expect(rel(drift, 'owned-by', k('ReplicaSet', 'api-7d9f'), k('Deployment', 'api'))).toBeDefined();
    });

    it('skips a templated manifest instead of guessing', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-runtime-helm-'));
        tmpDirs.push(dir);
        fs.writeFileSync(path.join(dir, 'deploy.yaml'), 'apiVersion: v1\nkind: Service\nmetadata:\n  name: {{ .Values.name }}\n');
        const out = readRuntime(dir, { codeEnv: false });
        expect(out.facts).toEqual([]);
        expect(out.skipped[0]!.reason).toMatch(/templated/);
    });

    it('relates a configured service to its resolved form from a user-produced compose config (T3)', () => {
        const r = rel(drift, 'resolves-to', 'service:compose:compose.yaml#app', 'service:resolved:compose.resolved.yaml#app')!;
        expect(r.rung).toBe('T3');
        expect(r.attrs['differs']).toEqual(['image', 'environment', 'depends_on']);
        expect(fact(drift, 'service:resolved:compose.resolved.yaml#app')!.rung).toBe('T3');
        expect(fact(drift, 'service:compose:compose.yaml#app')!.rung).toBe('T1');
    });
});

describe('runtime lane — names only, redaction', () => {
    it('never emits an environment value, a config-map value or the contents of a .env file', () => {
        const dir = copyFixture(DRIFT);
        fs.writeFileSync(path.join(dir, '.env'), 'ONLY_IN_DOTENV=dotenv-value-must-not-appear\n');
        const json = JSON.stringify(readRuntime(dir));
        for (const value of ['fixture-placeholder-value', 'resolved-placeholder-value', 'dotenv-value-must-not-appear', 'ONLY_IN_DOTENV', 'localhost', 'debug']) {
            expect(json, value).not.toContain(value);
        }
        expect(fact(drift, 'service:compose:compose.yaml#app')!.attrs['env_files']).toEqual(['.env']);
        expect(drift.facts.filter((f) => f.kind === 'env-var' && f.attrs['source'] === 'compose').map((f) => f.name).sort()).toEqual(['APP_TOKEN', 'DB_HOST', 'POSTGRES_PASSWORD']);
    });

    it('redacts hostnames, IP addresses and cloud account ids, and marks what it redacted', () => {
        const json = JSON.stringify(drift);
        for (const raw of ['123456789012', 'amazonaws.com', '10.20.30.40', 'client-name.de', 'client-internal']) expect(json, raw).not.toContain(raw);
        const proxy = fact(drift, 'service:compose:compose.yaml#proxy')!;
        expect(proxy.attrs['image']).toBe('<registry>/edge-proxy:2.1');
        expect(proxy.attrs['redacted']).toBe(true);
        const cachePort = drift.facts.find((f) => f.kind === 'port' && f.attrs['service'] === 'cache')!;
        expect(cachePort.attrs).toMatchObject({ host_ip: '<ip>', redacted: true });
        expect(fact(drift, 'service:compose:compose.yaml#db')!.attrs['redacted']).toBe(false);
    });

    it('redactText keeps public registries, file names and ports, and replaces the rest', () => {
        expect(redactText('ghcr.io/acme/app').text).toBe('ghcr.io/acme/app');
        expect(redactText('.env.local').redacted).toBe(false);
        expect(redactText('db:5432:5432').redacted).toBe(false);
        expect(redactText('arn:aws:iam::123456789012:role/x').text).toBe('arn:aws:iam::<account>:role/x');
        expect(redactText('fe80::1').text).toBe('<ip>');
        expect(redactText('https://api.acme-corp.com/v1').text).toBe('https://<host>/v1');
    });

    it('no runtime or delivery module opens a process, socket or HTTP client', () => {
        const dirs = ['src/scripts/code_graph/lanes/runtime', 'src/scripts/code_graph/lanes/delivery', 'src/scripts/_lib/infra_files'].map((d) => path.resolve(__dirname, '..', '..', d));
        for (const d of dirs) {
            for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.ts'))) {
                const src = fs.readFileSync(path.join(d, f), 'utf-8');
                expect(src, f).not.toMatch(/from 'node:(child_process|net|http|https|dgram|tls)'|\bfetch\(|execa/);
            }
        }
    });
});

describe('runtime drift RT-1 … RT-6', () => {
    const driftFindings = evaluateRules(RUNTIME_RULES, [drift, dataLane('mysql')]);
    const cleanFindings = evaluateRules(RUNTIME_RULES, [clean, dataLane('pgsql')]);
    const ids = (fs: { rule: string }[]) => new Set(fs.map((f) => f.rule));

    it.each(['RT-1', 'RT-2', 'RT-3', 'RT-4', 'RT-5', 'RT-6'])('%s fires on the drift fixture with two checkable witnesses', (id) => {
        const hits = driftFindings.filter((f) => f.rule === id);
        expect(hits.length).toBeGreaterThan(0);
        for (const h of hits) {
            expect(h.tier).toBe('advice');
            expect(h.witnesses).toHaveLength(2);
            expect(h.subjects[0]).not.toBe(h.subjects[1]);
            for (const w of h.witnesses) expect(w!.file).not.toBe('');
        }
    });

    it.each(['RT-1', 'RT-2', 'RT-3', 'RT-4', 'RT-5', 'RT-6'])('%s is silent on the clean fixture', (id) => {
        expect(ids(cleanFindings).has(id)).toBe(false);
    });

    it('names what drifted', () => {
        const msg = (id: string) => driftFindings.filter((f) => f.rule === id).map((f) => f.message).join('\n');
        expect(msg('RT-1')).toMatch(/8080\/tcp .*proxy.*app|8080\/tcp .*app.*proxy/);
        expect(msg('RT-2')).toMatch(/mysql.*postgres/);
        expect(msg('RT-3')).toContain('PAYMENT_GATEWAY_KEY');
        expect(msg('RT-3')).not.toContain('NODE_ENV');
        expect(msg('RT-4')).toMatch(/postgres port 5432 of db/);
        expect(msg('RT-5')).toMatch(/redis/);
        expect(msg('RT-6')).toMatch(/queue/);
        expect(msg('RT-6')).toMatch(/aws_iam_instance_profile\.app/);
    });

    it('an override file republishing the same service is not a collision', () => {
        expect(clean.facts.filter((f) => f.kind === 'port' && f.attrs['published'] === '8080')).toHaveLength(2);
        expect(cleanFindings.filter((f) => f.rule === 'RT-1')).toEqual([]);
    });

    it('RT-2 is silent while the data lane says nothing about the engine', () => {
        expect(evaluateRules(RUNTIME_RULES, [drift]).filter((f) => f.rule === 'RT-2')).toEqual([]);
    });

    it('the T3 copy of a published port does not double RT-4', () => {
        expect(driftFindings.filter((f) => f.rule === 'RT-4')).toHaveLength(1);
    });
});
