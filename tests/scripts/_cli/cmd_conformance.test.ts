/**
 * Conformance contract checks — road-to-flow-learnings Phase 0.
 *
 * Exit-gate requirement: one negative fixture per check — sabotage the
 * surface, the check goes red; clean fixture stays green.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CONFORMANCE_CHECK_IDS,
    THIN_STUB_MARKER,
    _check_host_manifest,
    _check_hook_dispatcher,
    _check_lean_projection,
    _check_router_pointers,
    _check_txlog_clean,
    appendConformanceReport,
    conformanceLogPath,
    detectSmokePlatform,
    routeTargetPaths,
} from '../../../src/scripts/_cli/cmd_conformance.js';

let tmp: string;

beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'conformance-'));
});

afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    delete process.env['AGENT_CONFIG_CONFORMANCE_LOG'];
});

describe('registry', () => {
    it('exposes exactly the five contract checks in order', () => {
        expect([...CONFORMANCE_CHECK_IDS]).toEqual([
            'txlog-clean',
            'router-pointers',
            'hook-dispatcher',
            'lean-projection',
            'host-manifest',
        ]);
    });
});

describe('_check_txlog_clean', () => {
    it('is ok when no log exists', () => {
        const res = _check_txlog_clean(join(tmp, 'absent.jsonl'));
        expect(res['status']).toBe('ok');
    });

    it('is ok when the tail is a completed run', () => {
        const log = join(tmp, 'log.jsonl');
        writeFileSync(
            log,
            [
                JSON.stringify({ ts: '2026-07-07T00:00:00Z', kind: 'write', path: '/x', sha256: 'a' }),
                JSON.stringify({ ts: '2026-07-07T00:00:01Z', kind: 'skip', path: '/y', sha256: null }),
            ].join('\n') + '\n',
        );
        expect(_check_txlog_clean(log)['status']).toBe('ok');
    });

    it('SABOTAGE: fails when the tail is an abandoned abort', () => {
        const log = join(tmp, 'log.jsonl');
        writeFileSync(
            log,
            [
                JSON.stringify({ ts: '2026-07-07T00:00:00Z', kind: 'write', path: '/x', sha256: 'a' }),
                JSON.stringify({
                    ts: '2026-07-07T00:00:01Z',
                    kind: 'abort',
                    path: '/y',
                    sha256: null,
                    note: 'client disconnect',
                }),
            ].join('\n') + '\n',
        );
        const res = _check_txlog_clean(log);
        expect(res['status']).toBe('fail');
        expect(String(res['message'])).toContain('abandoned');
    });
});

describe('_check_router_pointers', () => {
    function scaffoldPackage(root: string): void {
        mkdirSync(join(root, 'dist', 'agent-src', 'rules'), { recursive: true });
        mkdirSync(join(root, 'dist', 'agent-src', 'skills', 'php-coder'), { recursive: true });
        mkdirSync(join(root, 'docs', 'contracts'), { recursive: true });
        writeFileSync(join(root, 'dist', 'agent-src', 'rules', 'kernel-a.md'), '# a');
        writeFileSync(join(root, 'dist', 'agent-src', 'rules', 'tiered-b.md'), '# b');
        writeFileSync(
            join(root, 'dist', 'agent-src', 'skills', 'php-coder', 'SKILL.md'),
            '# skill',
        );
        writeFileSync(join(root, 'docs', 'contracts', 'some-contract.md'), '# contract');
    }

    function routerJson(routes: string[]): string {
        return JSON.stringify({
            schema_version: 1,
            kernel: ['kernel-a'],
            tier_1: [{ id: 'tiered-b', triggers: [], routes_to: routes }],
            tier_2: [],
        });
    }

    it('resolves rule ids and all four target kinds', () => {
        scaffoldPackage(tmp);
        writeFileSync(
            join(tmp, 'dist', 'router.json'),
            routerJson(['skill:php-coder', 'contract:some-contract']),
        );
        const res = _check_router_pointers(tmp);
        expect(res['status']).toBe('ok');
    });

    it('SABOTAGE: fails on a dangling routes_to target', () => {
        scaffoldPackage(tmp);
        writeFileSync(join(tmp, 'dist', 'router.json'), routerJson(['skill:does-not-exist']));
        const res = _check_router_pointers(tmp);
        expect(res['status']).toBe('fail');
        expect(String(res['message'])).toContain('does-not-exist');
    });

    it('SABOTAGE: fails on a missing rule body for a tier id', () => {
        scaffoldPackage(tmp);
        rmSync(join(tmp, 'dist', 'agent-src', 'rules', 'tiered-b.md'));
        writeFileSync(join(tmp, 'dist', 'router.json'), routerJson([]));
        expect(_check_router_pointers(tmp)['status']).toBe('fail');
    });

    it('SABOTAGE: fails on corrupt router JSON', () => {
        scaffoldPackage(tmp);
        writeFileSync(join(tmp, 'dist', 'router.json'), '{not json');
        expect(_check_router_pointers(tmp)['status']).toBe('fail');
    });

    it('maps every routes_to kind to the documented candidate paths', () => {
        expect(routeTargetPaths('skill:x')).toEqual([
            join('dist', 'agent-src', 'skills', 'x', 'SKILL.md'),
        ]);
        expect(routeTargetPaths('command:y')).toEqual([
            join('dist', 'agent-src', 'commands', 'y.md'),
        ]);
        expect(routeTargetPaths('guideline:a/b')).toEqual([join('docs', 'guidelines', 'a/b.md')]);
        expect(routeTargetPaths('contract:c')).toEqual([
            join('docs', 'contracts', 'c.md'),
            join('dist', 'agent-src', 'contexts', 'contracts', 'c.md'),
        ]);
        expect(routeTargetPaths('unknown:z')).toEqual([]);
        expect(routeTargetPaths('no-colon')).toEqual([]);
    });

    it('accepts a contract target shipped under contexts/contracts (second home)', () => {
        scaffoldPackage(tmp);
        mkdirSync(join(tmp, 'dist', 'agent-src', 'contexts', 'contracts'), { recursive: true });
        writeFileSync(
            join(tmp, 'dist', 'agent-src', 'contexts', 'contracts', 'flow-x.md'),
            '# ctx contract',
        );
        writeFileSync(join(tmp, 'dist', 'router.json'), routerJson(['contract:flow-x']));
        expect(_check_router_pointers(tmp)['status']).toBe('ok');
    });
});

describe('_check_hook_dispatcher', () => {
    /** Fake dispatcher: a script file so appended flags land in script argv. */
    function fakeDispatcher(body: string): string[] {
        const script = join(tmp, `fake-dispatcher-${Math.random().toString(36).slice(2)}.cjs`);
        writeFileSync(script, body);
        return [process.execPath, script];
    }

    it('passes with a runner that answers both synthetic events', () => {
        const res = _check_hook_dispatcher(tmp, tmp, {
            runner: fakeDispatcher('process.exit(0)'),
            platform: 'claude',
        });
        expect(res['status']).toBe('ok');
        expect(String(res['message'])).toContain('session_start=0');
    });

    it('treats the dispatcher warn exit (2) as firing', () => {
        const res = _check_hook_dispatcher(tmp, tmp, {
            runner: fakeDispatcher('process.exit(2)'),
            platform: 'claude',
        });
        expect(res['status']).toBe('ok');
    });

    it('SABOTAGE: fails when the dispatcher crashes', () => {
        const res = _check_hook_dispatcher(tmp, tmp, {
            runner: fakeDispatcher('console.error("boom"); process.exit(7)'),
            platform: 'claude',
        });
        expect(res['status']).toBe('fail');
        expect(String(res['message'])).toContain('exit 7');
    });

    it('SABOTAGE: fails when the dispatcher binary is missing', () => {
        const res = _check_hook_dispatcher(tmp, tmp, {
            runner: [join(tmp, 'no-such-binary')],
            platform: 'claude',
        });
        expect(res['status']).toBe('fail');
    });

    it('detects the smoke platform from the project tree', () => {
        mkdirSync(join(tmp, '.cursor'), { recursive: true });
        expect(detectSmokePlatform(tmp)).toBe('cursor');
        expect(detectSmokePlatform(join(tmp, 'nowhere'))).toBe('claude');
    });
});

describe('_check_lean_projection', () => {
    function scaffold(mode: string | null, ruleBody: string): { proj: string; pkg: string } {
        const proj = join(tmp, 'proj');
        const pkg = join(tmp, 'pkg');
        mkdirSync(join(proj, '.augment', 'rules'), { recursive: true });
        mkdirSync(join(pkg, 'dist'), { recursive: true });
        writeFileSync(
            join(pkg, 'dist', 'router.json'),
            JSON.stringify({ schema_version: 1, kernel: ['kernel-a'], tier_1: [], tier_2: [] }),
        );
        if (mode !== null) {
            writeFileSync(join(proj, '.agent-settings.yml'), `lean_projection:\n  mode: ${mode}\n`);
        }
        writeFileSync(join(proj, '.augment', 'rules', 'kernel-a.md'), '# full kernel body');
        writeFileSync(join(proj, '.augment', 'rules', 'routed-x.md'), ruleBody);
        return { proj, pkg };
    }

    it('is ok when eager-all projection carries full bodies', () => {
        const { proj, pkg } = scaffold('eager-all', '# Routed X\n\nfull body prose here\n');
        expect(_check_lean_projection(proj, pkg)['status']).toBe('ok');
    });

    it('is ok when thin projection carries thin stubs', () => {
        const { proj, pkg } = scaffold('thin', `## Routed X\n> ${THIN_STUB_MARKER}. Body: link\n`);
        expect(_check_lean_projection(proj, pkg)['status']).toBe('ok');
    });

    it('SABOTAGE: fails when mode=thin but a full body is projected', () => {
        const { proj, pkg } = scaffold('thin', '# Routed X\n\nfull body prose here\n');
        const res = _check_lean_projection(proj, pkg);
        expect(res['status']).toBe('fail');
        expect(String(res['message'])).toContain('full body under thin mode');
    });

    it('SABOTAGE: fails when mode=eager-all but a thin stub is projected', () => {
        const { proj, pkg } = scaffold('eager-all', `## Routed X\n> ${THIN_STUB_MARKER}.\n`);
        expect(_check_lean_projection(proj, pkg)['status']).toBe('fail');
    });

    it('SABOTAGE: fails on an unknown mode value', () => {
        const { proj, pkg } = scaffold('warp-speed', '# body');
        expect(_check_lean_projection(proj, pkg)['status']).toBe('fail');
    });

    it('skips when no projection dir exists', () => {
        const proj = join(tmp, 'bare');
        mkdirSync(proj, { recursive: true });
        expect(_check_lean_projection(proj, tmp)['status']).toBe('skipped');
    });
});

describe('_check_host_manifest', () => {
    it('is ok with no settings file (safe defaults)', () => {
        const proj = join(tmp, 'p1');
        mkdirSync(proj);
        expect(_check_host_manifest(proj)['status']).toBe('ok');
    });

    it('is ok with a valid override', () => {
        const proj = join(tmp, 'p2');
        mkdirSync(proj);
        writeFileSync(
            join(proj, '.agent-settings.yml'),
            'subagents:\n  host_capabilities:\n    schema_version: 1\n    subagent_spawn: true\n',
        );
        expect(_check_host_manifest(proj)['status']).toBe('ok');
    });

    it('SABOTAGE: fails on an unknown key (typo guard)', () => {
        const proj = join(tmp, 'p3');
        mkdirSync(proj);
        writeFileSync(
            join(proj, '.agent-settings.yml'),
            'subagents:\n  host_capabilities:\n    subagent_spwan: true\n',
        );
        const res = _check_host_manifest(proj);
        expect(res['status']).toBe('fail');
        expect(String(res['message'])).toContain('subagent_spwan');
    });

    it('SABOTAGE: fails on a non-boolean capability value', () => {
        const proj = join(tmp, 'p4');
        mkdirSync(proj);
        writeFileSync(
            join(proj, '.agent-settings.yml'),
            'subagents:\n  host_capabilities:\n    subagent_spawn: "yes"\n',
        );
        expect(_check_host_manifest(proj)['status']).toBe('fail');
    });
});

describe('appendConformanceReport', () => {
    it('appends one txlog-shaped JSONL line to the override path', () => {
        const log = join(tmp, 'report.jsonl');
        process.env['AGENT_CONFIG_CONFORMANCE_LOG'] = log;
        expect(conformanceLogPath()).toBe(log);
        appendConformanceReport(
            [
                { id: 'txlog-clean', status: 'ok', message: '', remedy: '' },
                { id: 'router-pointers', status: 'fail', message: '', remedy: '' },
            ],
            '/some/project',
            log,
        );
        const lines = readFileSync(log, 'utf8').trim().split('\n');
        expect(lines).toHaveLength(1);
        const entry = JSON.parse(lines[0] as string);
        expect(entry.kind).toBe('conformance');
        expect(entry.path).toBe('/some/project');
        expect(entry.sha256).toBeNull();
        expect(entry.note).toContain('fails: router-pointers');
        expect(Number.isNaN(Date.parse(entry.ts))).toBe(false);
    });
});
