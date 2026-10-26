/**
 * What the Runtime and Delivery pages draw beyond the resource and job lists:
 * the references between resources, the volumes and dependencies of a Compose
 * service, each trigger's branch filter, and the job flags the CI view judges a
 * scenario by — read from the drift fixtures, every fact with its witness.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';
import { areaProblems, type DeliveryPayload, type MapAreas, type RuntimePayload } from '../../src/scripts/code_graph/map_areas.js';

const FX = path.resolve(__dirname, '../fixtures/code-graph');
let root: string;
let out: string;
let runtime: RuntimePayload;
let delivery: DeliveryPayload;

beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'map-ops-'));
    out = fs.mkdtempSync(path.join(os.tmpdir(), 'map-ops-out-'));
    fs.cpSync(path.join(FX, 'runtime/drift'), root, { recursive: true });
    fs.cpSync(path.join(FX, 'delivery/drift'), root, { recursive: true });
    fs.mkdirSync(path.join(root, 'agents'));
    await buildMap(root, { outDir: path.join(out, 'map'), cachePath: path.join(out, 'graph.json') });
    const areas = (JSON.parse(fs.readFileSync(path.join(out, 'map', 'code', 'map.json'), 'utf-8')) as { areas: MapAreas }).areas;
    expect(areaProblems(areas)).toEqual([]);
    runtime = areas.runtime!;
    delivery = areas.delivery!;
}, 120_000);
afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(out, { recursive: true, force: true });
});

describe('Runtime: references between resources', () => {
    it('carries every Terraform and Kubernetes reference with its relation and mechanism', () => {
        const links = runtime.links ?? [];
        const has = (from: string, to: string, relation: string): boolean => links.some((l) => l.from === from && l.to === to && l.relation === relation);
        expect(has('aws_security_group.web', 'aws_security_group.db', 'connects')).toBe(true);
        expect(links.find((l) => l.relation === 'connects')?.mechanism).toBe('aws_security_group_rule');
        expect(has('Ingress/api', 'Service/api', 'routes-to')).toBe(true);
        expect(has('Service/api', 'Deployment/api', 'selects')).toBe(true);
        // A target no file declares is kept by name, so the page can say so.
        expect(has('aws_instance.app', 'aws_iam_instance_profile.app', 'references')).toBe(true);
        expect(runtime.resources.some((r) => r.name === 'aws_iam_instance_profile.app')).toBe(false);
        // A comment that names a resource is not a reference.
        expect(links.some((l) => l.to.includes('ghost') || l.to.includes('inside_heredoc'))).toBe(false);
        for (const l of links) expect(l.witness.line).toBeGreaterThan(0);
    });
});

describe('Runtime: what a Compose service mounts and needs', () => {
    it('names volumes with their container path and dependencies as written, including undeclared ones', () => {
        const app = runtime.services.find((s) => s.name === 'app (compose.yaml)');
        expect(app?.volumes).toEqual([{ name: 'appdata', target: '/var/app' }]);
        expect(app?.dependsOn?.slice().sort()).toEqual(['db', 'queue']);
        const db = runtime.services.find((s) => s.name === 'db (compose.yaml)');
        expect(db?.volumes).toEqual([{ name: 'dbdata', target: '/var/lib/postgresql/data' }]);
        expect(db?.dependsOn).toEqual([]);
        const cache = runtime.services.find((s) => s.name === 'cache');
        expect(cache?.volumes).toEqual([]);
    });
});

describe('Delivery: triggers and job flags the scenario view judges', () => {
    it('keeps each trigger event with its branch filter and whether a path filter narrows it', () => {
        const ci = delivery.workflows.find((w) => w.file === '.github/workflows/ci.yml');
        expect(ci?.events).toEqual(expect.arrayContaining([{ event: 'push', branches: ['main'], paths: false }, { event: 'pull_request', branches: [], paths: true }]));
        const reusable = delivery.workflows.find((w) => w.file === '.github/workflows/reusable-deploy.yml');
        expect(reusable?.events?.map((e) => e.event)).toEqual(['workflow_call']);
        // GitLab's `changes` rule gates one job, not the pipeline.
        const gl = delivery.workflows.find((w) => w.file === '.gitlab-ci.yml');
        expect(gl?.events?.find((e) => e.event === 'changes')).toMatchObject({ paths: true, job: '.gitlab-ci.yml#unit-test' });
    });

    it('flags test and deploy jobs, the CI system, the GitLab stage and a job\'s own branch rule', () => {
        const job = (id: string) => delivery.jobs.find((j) => j.id === id);
        expect(job('.github/workflows/ci.yml#test')).toMatchObject({ isTest: true, isDeploy: false, system: 'github', branches: [] });
        expect(job('.github/workflows/ci.yml#deploy')).toMatchObject({ isTest: false, isDeploy: true, environment: 'production' });
        expect(job('.github/workflows/release.yml#hotfix-deploy')).toMatchObject({ isDeploy: true, branches: ['main'] });
        expect(job('.gitlab-ci.yml#deploy-prod')).toMatchObject({ system: 'gitlab', stage: 'deploy', branches: ['<default>'], isDeploy: true });
        expect(job('.github/workflows/ci.yml#test')?.stage).toBeUndefined();
    });
});
