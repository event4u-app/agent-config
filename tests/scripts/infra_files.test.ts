import { describe, expect, it } from 'vitest';

import { parseCompose, parsePortShort } from '../../src/scripts/_lib/infra_files/compose.js';
import { parseDockerfile } from '../../src/scripts/_lib/infra_files/dockerfile.js';
import { globMatchesAny, globToRegExp, parsePipeline } from '../../src/scripts/_lib/infra_files/pipeline.js';

describe('compose reader', () => {
    it.each([
        ['80', { published: null, target: '80', protocol: 'tcp', hostIp: null }],
        ['8080:80', { published: '8080', target: '80', protocol: 'tcp', hostIp: null }],
        ['127.0.0.1:5432:5432', { published: '5432', target: '5432', protocol: 'tcp', hostIp: '127.0.0.1' }],
        ['[::1]:6379:6379/udp', { published: '6379', target: '6379', protocol: 'udp', hostIp: '::1' }],
        ['8000-8010:8000-8010', { published: '8000-8010', target: '8000-8010', protocol: 'tcp', hostIp: null }],
        [':80', { published: null, target: '80', protocol: 'tcp', hostIp: null }],
    ])('short port syntax %s', (spec, want) => {
        expect(parsePortShort(spec)).toEqual(want);
    });

    it('returns environment names from list and map form, never a value, and env_file by name', () => {
        const m = parseCompose(
            'services:\n  a:\n    environment:\n      - ONE=v1-secret\n      - TWO\n    env_file: [.env, extra.env]\n  b:\n    environment:\n      THREE: v3-secret\n    env_file: .env.b\n',
        );
        const a = m.services.find((s) => s.name === 'a')!;
        const b = m.services.find((s) => s.name === 'b')!;
        expect(a.envNames.map((e) => e.name)).toEqual(['ONE', 'TWO']);
        expect(b.envNames.map((e) => e.name)).toEqual(['THREE']);
        expect(a.envFiles.map((e) => e.name)).toEqual(['.env', 'extra.env']);
        expect(b.envFiles.map((e) => [e.name, e.line])).toEqual([['.env.b', 10]]);
        expect(JSON.stringify({ services: m.services, networks: m.networks })).not.toMatch(/secret/);
    });

    it('keeps the line of every element and resolves merge keys', () => {
        const m = parseCompose('x-base: &base\n  image: base:1\nservices:\n  web:\n    <<: *base\n    ports:\n      - "80:80"\n');
        const web = m.services[0]!;
        expect(web.image).toBe('base:1');
        expect(web.imageLine).toBe(2);
        expect(web.ports[0]!.line).toBe(7);
    });

    it('reports malformed YAML as an error instead of guessing', () => {
        const m = parseCompose('services:\n  a: [unclosed\n');
        expect(m.error).not.toBeNull();
        expect(m.services).toEqual([]);
    });
});

describe('dockerfile reader', () => {
    it('reads every stage, its alias and platform, and EXPOSE per stage', () => {
        const d = parseDockerfile('FROM --platform=linux/amd64 node:22 AS build\nEXPOSE 3000\nFROM nginx:1.27\nEXPOSE 80/tcp 53/udp # dns\n');
        expect(d.stages.map((s) => [s.image, s.alias, s.platform, s.line])).toEqual([
            ['node:22', 'build', 'linux/amd64', 1],
            ['nginx:1.27', null, null, 3],
        ]);
        expect(d.exposes.map((e) => [e.port, e.protocol, e.stage, e.line])).toEqual([
            ['3000', 'tcp', 0, 2],
            ['80', 'tcp', 1, 4],
            ['53', 'udp', 1, 4],
        ]);
    });
});

describe('pipeline model', () => {
    it('reads GitHub `on` in scalar, list and map form', () => {
        expect(parsePipeline('on: push\njobs: {}\n', 'github').triggers.map((t) => t.event)).toEqual(['push']);
        expect(parsePipeline('on: [push, pull_request]\njobs: {}\n', 'github').triggers.map((t) => t.event)).toEqual(['push', 'pull_request']);
        const m = parsePipeline("on:\n  push:\n    branches: [main]\n    paths: ['src/**']\n", 'github');
        expect(m.triggers[0]).toMatchObject({ event: 'push', branches: ['main'], paths: [{ glob: 'src/**', line: 4 }] });
    });

    it('resolves GitLab `extends` for stage, environment and script', () => {
        const m = parsePipeline('.deploy:\n  stage: deploy\n  environment: production\n  script: [kubectl apply -f k8s]\nship:\n  extends: .deploy\n', 'gitlab');
        expect(m.jobs.map((j) => j.id)).toEqual(['ship']);
        expect(m.jobs[0]).toMatchObject({ stage: 'deploy', environment: { name: 'production' }, extends: ['.deploy'] });
        expect(m.jobs[0]!.steps[0]!.run!.text).toContain('kubectl apply');
    });

    it('distinguishes no `needs` (stage order) from an empty `needs`', () => {
        const m = parsePipeline('a:\n  script: [x]\nb:\n  needs: []\n  script: [y]\n', 'gitlab');
        expect(m.jobs.find((j) => j.id === 'a')!.needs).toBeNull();
        expect(m.jobs.find((j) => j.id === 'b')!.needs).toEqual([]);
    });

    it('returns an error for a file that is not YAML', () => {
        expect(parsePipeline('jobs: [a\n', 'github').error).not.toBeNull();
    });
});

describe('path globs', () => {
    it('`**` crosses directories, `*` does not, directory entries match by prefix', () => {
        expect(globToRegExp('src/**').test('src/a/b.ts')).toBe(true);
        expect(globToRegExp('src/*.ts').test('src/a/b.ts')).toBe(false);
        expect(globMatchesAny('taskfiles', ['taskfiles/ci.yml'])).toBe(true);
        expect(globMatchesAny('docs/**', ['src/a.ts'])).toBe(false);
    });
});
