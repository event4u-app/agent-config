import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { DELIVERY_RULES, readDelivery } from '../../src/scripts/code_graph/lanes/delivery/index.js';
import { excludedOwnFiles, selfTriggers } from '../../src/scripts/code_graph/lanes/delivery/self_trigger.js';
import { spanHash, type LaneOutput } from '../../src/scripts/code_graph/lanes/lane_fact.js';
import { evaluateRules } from '../../src/scripts/code_graph/lanes/runtime/index.js';

const FIX = path.resolve(__dirname, '..', 'fixtures', 'code-graph', 'delivery');
const DRIFT = path.join(FIX, 'drift');
const CLEAN = path.join(FIX, 'clean');
const drift = readDelivery(DRIFT);
const clean = readDelivery(CLEAN);

const tmpDirs: string[] = [];
afterAll(() => {
    for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

const GH = '.github/workflows';
const fact = (o: LaneOutput, id: string) => o.facts.find((f) => f.id === id);
const rel = (o: LaneOutput, relation: string, from: string, to: string) => o.relations.find((r) => r.relation === relation && r.from === from && r.to === to);
const job = (file: string, id: string) => `job:${file}#${id}`;

describe('delivery lane — one workflow model', () => {
    it('every witness is the line it was read from', () => {
        for (const [root, out] of [[DRIFT, drift], [CLEAN, clean]] as const) {
            for (const item of [...out.facts, ...out.relations]) {
                const lines = fs.readFileSync(path.join(root, item.witness.file), 'utf-8').split('\n');
                expect(spanHash((lines[item.witness.line - 1] ?? '').trimEnd())).toBe(item.witness.hash);
            }
        }
        expect(drift.skipped).toEqual([]);
    });

    it('reads the GitHub job graph: jobs, needs, contains', () => {
        const ci = `${GH}/ci.yml`;
        expect(drift.facts.filter((f) => f.kind === 'job' && f.owner === ci).map((f) => f.name)).toEqual(['test', 'build', 'deploy']);
        expect(rel(drift, 'needs', job(ci, 'build'), job(ci, 'test'))).toBeDefined();
        expect(rel(drift, 'needs', job(ci, 'deploy'), job(ci, 'build'))).toBeDefined();
        expect(rel(drift, 'contains', `workflow:${ci}`, job(ci, 'deploy'))).toBeDefined();
        expect(fact(drift, job(ci, 'test'))!.attrs).toMatchObject({ is_test: true, is_deploy: false });
        expect(fact(drift, job(ci, 'deploy'))!.attrs).toMatchObject({ is_test: false, is_deploy: true, environment: 'production' });
    });

    it('reads the GitLab job graph with explicit needs and implicit stage order', () => {
        const gl = '.gitlab-ci.yml';
        expect(fact(drift, `workflow:${gl}`)!.attrs['stages']).toEqual(['build', 'test', 'deploy', 'review']);
        expect(rel(drift, 'needs', job(gl, 'deploy-prod'), job(gl, 'build-image'))).toMatchObject({ attrs: {} });
        expect(rel(drift, 'needs', job(gl, 'deploy-prod'), job(gl, 'unit-test'))).toBeUndefined();
        expect(rel(drift, 'needs', job(gl, 'review-app'), job(gl, 'unit-test'))).toMatchObject({ attrs: { implicit: true } });
        expect(drift.facts.filter((f) => f.attrs['include'] === true).map((f) => [f.name, f.attrs['include_kind']])).toEqual([
            ['/ci/common.yml', 'local'],
            ['Security/SAST.gitlab-ci.yml', 'template'],
        ]);
    });

    it('records action pinning, reusable workflow calls and workflow_run triggers', () => {
        const actions = drift.facts.filter((f) => f.kind === 'action').map((f) => [f.attrs['owner_repo'], f.attrs['pinned']]);
        expect(actions).toContainEqual(['actions/checkout', false]);
        expect(actions).toContainEqual(['docker/build-push-action', true]);
        expect(rel(drift, 'calls', job(`${GH}/release.yml`, 'publish'), `workflow:${GH}/reusable-deploy.yml`)).toBeDefined();
        expect(fact(drift, `workflow:${GH}/reusable-deploy.yml`)!.attrs['reusable']).toBe(true);
        expect(rel(drift, 'triggers', `workflow:${GH}/ci.yml`, `workflow:${GH}/release.yml`)).toMatchObject({ attrs: { mechanism: 'workflow_run' } });
        const trig = fact(drift, `trigger:${GH}/ci.yml#pull_request`)!;
        expect(trig.attrs).toMatchObject({ paths: ['src/**'], self_triggering: false });
        expect(fact(drift, `trigger:${GH}/ci.yml#push`)!.attrs).toMatchObject({ branches: ['main'], self_triggering: null });
    });

    it('maps branches to environments', () => {
        expect(rel(drift, 'deploys-to', job(`${GH}/release.yml`, 'hotfix-deploy'), `environment:${GH}/release.yml#staging`)!.attrs['branches']).toEqual(['main']);
        expect(rel(drift, 'deploys-to', job('.gitlab-ci.yml', 'deploy-prod'), 'environment:.gitlab-ci.yml#production')!.attrs['branches']).toEqual(['<default>']);
        expect(rel(clean, 'deploys-to', job(`${GH}/ci.yml`, 'deploy'), `environment:${GH}/ci.yml#production`)!.attrs['branches']).toEqual(['main']);
    });

    it('follows build → image → deploy for both systems', () => {
        const ghImage = `image:${GH}/ci.yml#ghcr.io/acme/shop`;
        expect(rel(drift, 'builds', job(`${GH}/ci.yml`, 'build'), ghImage)).toBeDefined();
        expect(rel(drift, 'consumes', job(`${GH}/ci.yml`, 'deploy'), ghImage)).toBeDefined();
        expect(rel(drift, 'delivers', ghImage, `environment:${GH}/ci.yml#production`)).toBeDefined();
        const glImage = 'image:.gitlab-ci.yml#$CI_REGISTRY_IMAGE';
        expect(rel(drift, 'builds', job('.gitlab-ci.yml', 'build-image'), glImage)).toBeDefined();
        expect(rel(drift, 'delivers', glImage, 'environment:.gitlab-ci.yml#production')).toBeDefined();
        expect(drift.relations.filter((r) => r.relation === 'consumes' && r.from === job('.gitlab-ci.yml', 'review-app'))).toEqual([]);
    });

    it('marks review environments as dynamic and exempts them from protection', () => {
        const review = drift.facts.find((f) => f.kind === 'environment' && f.attrs['review'] === true)!;
        expect(review.attrs).toMatchObject({ name: 'review/$CI_COMMIT_REF_SLUG', dynamic: true, protected: null });
    });

    it('redacts environment URLs', () => {
        const json = JSON.stringify(drift);
        expect(json).not.toContain('client-corp.com');
        expect(fact(drift, `environment:${GH}/ci.yml#production`)!.attrs).toMatchObject({ url: 'https://<host>', redacted: true });
    });

    it('a path filter applies GitHub order and negation to the pipeline files', () => {
        expect(selfTriggers(['src/**'], [], ['.github/workflows/ci.yml'])).toBe(false);
        expect(selfTriggers(['src/**', '.github/**'], [], ['.github/workflows/ci.yml'])).toBe(true);
        expect(selfTriggers(['**', '!.github/**'], [], ['.github/workflows/ci.yml'])).toBe(false);
        expect(selfTriggers([], ['.github/**'], ['.github/workflows/ci.yml'])).toBe(false);
        expect(selfTriggers([], ['docs/**'], ['.github/workflows/ci.yml'])).toBe(true);
        expect(excludedOwnFiles(['.github/workflows/**'], [], ['.github/workflows/ci.yml', '.github/actions/setup'])).toEqual(['.github/actions/setup']);
    });
});

describe('delivery drift DL-1 … DL-5', () => {
    const driftFindings = evaluateRules(DELIVERY_RULES, [drift]);
    const cleanFindings = evaluateRules(DELIVERY_RULES, [clean]);

    it.each(['DL-1', 'DL-2', 'DL-3', 'DL-4', 'DL-5'])('%s fires on the drift fixture with two witnesses', (id) => {
        const hits = driftFindings.filter((f) => f.rule === id);
        expect(hits.length).toBeGreaterThan(0);
        for (const h of hits) {
            expect(h.tier).toBe('advice');
            expect(h.witnesses).toHaveLength(2);
            expect(h.subjects[0]).not.toBe(h.subjects[1]);
        }
    });

    it.each(['DL-1', 'DL-2', 'DL-3', 'DL-4', 'DL-5'])('%s is silent on the clean fixture', (id) => {
        expect(cleanFindings.filter((f) => f.rule === id)).toEqual([]);
    });

    it('names the drifted element', () => {
        const by = (id: string) => driftFindings.filter((f) => f.rule === id).map((f) => f.subjects[0]);
        expect(by('DL-1')).toEqual([`action:${GH}/ci.yml#test:actions/checkout@v4`]);
        expect(by('DL-2').sort()).toEqual([job(`${GH}/ci.yml`, 'build'), job(`${GH}/ci.yml`, 'deploy'), job(`${GH}/ci.yml`, 'test')]);
        expect(by('DL-3')).toEqual([`environment:${GH}/ci.yml#production`]);
        expect(by('DL-4').sort()).toEqual([job(`${GH}/release.yml`, 'hotfix-deploy'), job('.gitlab-ci.yml', 'deploy-prod')].sort());
        expect(driftFindings.find((f) => f.rule === 'DL-5' && f.subjects[0].endsWith('#pull_request'))!.message).toContain('.github/workflows/ci.yml');
        expect(by('DL-5').sort()).toEqual([`trigger:${GH}/ci.yml#pull_request`, 'trigger:.gitlab-ci.yml#unit-test:changes'].sort());
    });

    it('DL-3 rests on the committed settings entry: without it the staging environment is unprotected', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-delivery-'));
        tmpDirs.push(dir);
        fs.cpSync(CLEAN, dir, { recursive: true });
        fs.rmSync(path.join(dir, '.github', 'settings.yml'));
        const hits = evaluateRules(DELIVERY_RULES, [readDelivery(dir)]).filter((f) => f.rule === 'DL-3');
        expect(hits.map((h) => h.subjects[0])).toEqual([`environment:${GH}/ci.yml#staging`]);
    });
});
