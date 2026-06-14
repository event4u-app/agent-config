// Tests for src/scripts/ai_council/advisors.ts (py2ts Phase 1).
//
// advisors selects advisor personas (frontmatter strip + condensed-tree
// preference + one-advisor-per-provider invariant). Golden parity drives the
// LIVE Python twin via a `python3 -c` importlib direct-file load. advisors.py
// imports `scripts.ai_council.config` (which pulls `scripts._lib` + yaml but
// NOT the networked clients), so the rig puts `<repo>/src` on sys.path so the
// real config + _lib resolve, then loads advisors.py off disk.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    AdvisorPlan,
    build_persona_labels,
    plan_advisor_swap,
    resolve_persona_text,
} from '../../../src/scripts/ai_council/advisors.js';
import type { AdvisorConfig } from '../../../src/scripts/ai_council/config.js';

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
// advisors.py needs PyYAML; gate the differential on both being present.
function hasPyYaml(): boolean {
    return spawnSync('python3', ['-c', 'import yaml'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3() && hasPyYaml();

const ADVISORS_PY = 'src/scripts/ai_council/advisors.py';
const REPO_SRC = path.resolve('src');

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'advisors-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length) {
        fs.rmSync(tmpDirs.pop() as string, { recursive: true, force: true });
    }
});

function writePersona(root: string, tree: string, relPath: string, body: string): void {
    const full = path.join(root, tree, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body, 'utf-8');
}

function adv(partial: Partial<AdvisorConfig> & { name: string; member: string }): AdvisorConfig {
    return {
        name: partial.name,
        enabled: partial.enabled ?? true,
        member: partial.member,
        persona: partial.persona ?? 'personas/p.md',
        model: partial.model ?? null,
    };
}

// Python driver: put <repo>/src on sys.path (so real config/_lib resolve),
// load advisors.py off disk as module "adv".
function pyDriver(body: string): string {
    return [
        'import importlib.util, sys, json',
        `sys.path.insert(0, ${JSON.stringify(REPO_SRC)})`,
        `_spec = importlib.util.spec_from_file_location("adv", ${JSON.stringify(ADVISORS_PY)})`,
        'adv = importlib.util.module_from_spec(_spec)',
        'sys.modules["adv"] = adv',
        '_spec.loader.exec_module(adv)',
        'from scripts.ai_council.config import AdvisorConfig',
        'from pathlib import Path',
        body,
    ].join('\n');
}

function py(body: string): { status: number; stdout: string; stderr: string } {
    const r = spawnSync('python3', ['-c', pyDriver(body)], { encoding: 'utf8' });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

// ── Unit tests ───────────────────────────────────────────────────────

describe('advisors — resolve_persona_text', () => {
    it('reads condensed tree, strips frontmatter, returns trimmed body + meta', () => {
        const root = mkTmp();
        writePersona(
            root,
            'dist/agent-src',
            'personas/c.md',
            '---\nrole: The Contrarian\nx: 1\n---\nBody line.\n\nMore.\n',
        );
        const [body, meta] = resolve_persona_text('personas/c.md', root);
        expect(body).toBe('Body line.\n\nMore.');
        expect(meta).toEqual({ role: 'The Contrarian', x: 1 });
    });
    it('falls back to uncondensed tree', () => {
        const root = mkTmp();
        writePersona(root, '.agent-src.uncondensed', 'personas/u.md', 'No frontmatter here.\n');
        const [body, meta] = resolve_persona_text('personas/u.md', root);
        expect(body).toBe('No frontmatter here.');
        expect(meta).toEqual({});
    });
    it('prefers condensed over uncondensed', () => {
        const root = mkTmp();
        writePersona(root, 'dist/agent-src', 'personas/d.md', 'CONDENSED');
        writePersona(root, '.agent-src.uncondensed', 'personas/d.md', 'UNCONDENSED');
        expect(resolve_persona_text('personas/d.md', root)[0]).toBe('CONDENSED');
    });
    it('raises CouncilConfigError when no candidate exists', () => {
        const root = mkTmp();
        expect(() => resolve_persona_text('personas/nope.md', root)).toThrow(
            /Persona file not found for advisor \(path='personas\/nope.md'\)/,
        );
    });
});

describe('advisors — plan_advisor_swap', () => {
    it('skips disabled, builds plan per enabled advisor', () => {
        const root = mkTmp();
        writePersona(root, 'dist/agent-src', 'personas/contra.md', '---\nrole: Contra\n---\nC body');
        writePersona(root, 'dist/agent-src', 'personas/red.md', 'Red body');
        const advisors = new Map<string, AdvisorConfig>([
            ['contrarian', adv({ name: 'contrarian', member: 'anthropic', persona: 'personas/contra.md' })],
            ['red-team', adv({ name: 'red-team', member: 'openai', persona: 'personas/red.md', model: 'gpt-x' })],
            ['off', adv({ name: 'off', member: 'google', persona: 'personas/contra.md', enabled: false })],
        ]);
        const plans = plan_advisor_swap(advisors, root);
        expect([...plans.keys()].sort()).toEqual(['anthropic', 'openai']);
        expect(plans.get('anthropic')!.display_name).toBe('Contra');
        const red = plans.get('openai')!;
        expect(red.display_name).toBe('Red Team'); // titleized from key
        expect(red.persona_text).toBe('Red body');
        expect(red.model_override).toBe('gpt-x');
    });
    it('raises when two enabled advisors bind the same provider', () => {
        const root = mkTmp();
        writePersona(root, 'dist/agent-src', 'personas/p.md', 'body');
        const advisors = new Map<string, AdvisorConfig>([
            ['a', adv({ name: 'a', member: 'anthropic', persona: 'personas/p.md' })],
            ['b', adv({ name: 'b', member: 'anthropic', persona: 'personas/p.md' })],
        ]);
        expect(() => plan_advisor_swap(advisors, root)).toThrow(
            /advisors.b and advisors.a both bind member='anthropic'/,
        );
    });
});

describe('advisors — build_persona_labels', () => {
    it('maps provider:model → display_name for matching members only', () => {
        const plans = new Map<string, AdvisorPlan>([
            [
                'anthropic',
                new AdvisorPlan({
                    name: 'contrarian',
                    display_name: 'Contra',
                    member: 'anthropic',
                    persona_text: 'x',
                }),
            ],
        ]);
        const labels = build_persona_labels(plans, [
            { name: 'anthropic', model: 'claude' },
            { name: 'openai', model: 'gpt' },
        ]);
        expect([...labels]).toEqual([['anthropic:claude', 'Contra']]);
    });
});

// ── Golden parity vs the CPython twin ────────────────────────────────

describe.runIf(py3)('advisors — golden parity vs CPython twin', () => {
    function makeRepo(): string {
        const root = mkTmp();
        writePersona(
            root,
            'dist/agent-src',
            'personas/contra.md',
            '---\nrole: The Contrarian\ntier: core\n---\nContrarian body.\n\nSecond paragraph.\n',
        );
        writePersona(root, 'dist/agent-src', 'personas/red.md', 'Red body, no frontmatter.\n');
        writePersona(root, '.agent-src.uncondensed', 'personas/fallback.md', 'Fallback only body.\n');
        return root;
    }

    it('resolve_persona_text matches (condensed + frontmatter)', () => {
        const root = makeRepo();
        const r = py(
            `body, meta = adv.resolve_persona_text("personas/contra.md", Path(${JSON.stringify(root)}))\n` +
                'print(json.dumps([body, meta]))',
        );
        expect(r.status).toBe(0);
        expect(resolve_persona_text('personas/contra.md', root)).toEqual(JSON.parse(r.stdout.trim()));
    });

    it('resolve_persona_text matches (uncondensed fallback)', () => {
        const root = makeRepo();
        const r = py(
            `body, meta = adv.resolve_persona_text("personas/fallback.md", Path(${JSON.stringify(root)}))\n` +
                'print(json.dumps([body, meta]))',
        );
        expect(r.status).toBe(0);
        expect(resolve_persona_text('personas/fallback.md', root)).toEqual(JSON.parse(r.stdout.trim()));
    });

    it('resolve_persona_text missing-file error text matches', () => {
        const root = makeRepo();
        const r = py(
            'try:\n' +
                `    adv.resolve_persona_text("personas/nope.md", Path(${JSON.stringify(root)}))\n` +
                'except adv.CouncilConfigError as e:\n' +
                '    print(json.dumps(str(e)))',
        );
        expect(r.status).toBe(0);
        let msg = '';
        try {
            resolve_persona_text('personas/nope.md', root);
        } catch (e) {
            msg = (e as Error).message;
        }
        expect(msg).toEqual(JSON.parse(r.stdout.trim()));
    });

    it('plan_advisor_swap matches (skip disabled + titleize + override)', () => {
        const root = makeRepo();
        const r = py(
            `advisors = {\n` +
                `  "contrarian": AdvisorConfig(name="contrarian", enabled=True, member="anthropic", persona="personas/contra.md", model=None),\n` +
                `  "red-team": AdvisorConfig(name="red-team", enabled=True, member="openai", persona="personas/red.md", model="gpt-x"),\n` +
                `  "off": AdvisorConfig(name="off", enabled=False, member="google", persona="personas/contra.md", model=None),\n` +
                `}\n` +
                `plans = adv.plan_advisor_swap(advisors, Path(${JSON.stringify(root)}))\n` +
                'out = {k: {"name": v.name, "display_name": v.display_name, "member": v.member, ' +
                '"persona_text": v.persona_text, "model_override": v.model_override} for k, v in plans.items()}\n' +
                'print(json.dumps(out, sort_keys=True))',
        );
        expect(r.status).toBe(0);
        const advisors = new Map<string, AdvisorConfig>([
            ['contrarian', adv({ name: 'contrarian', member: 'anthropic', persona: 'personas/contra.md' })],
            ['red-team', adv({ name: 'red-team', member: 'openai', persona: 'personas/red.md', model: 'gpt-x' })],
            ['off', adv({ name: 'off', member: 'google', persona: 'personas/contra.md', enabled: false })],
        ]);
        const plans = plan_advisor_swap(advisors, root);
        const tsOut: Record<string, unknown> = {};
        for (const [k, v] of plans) {
            tsOut[k] = {
                name: v.name,
                display_name: v.display_name,
                member: v.member,
                persona_text: v.persona_text,
                model_override: v.model_override,
            };
        }
        expect(tsOut).toEqual(JSON.parse(r.stdout.trim()));
    });

    it('plan_advisor_swap duplicate-provider error text matches', () => {
        const root = makeRepo();
        const r = py(
            `advisors = {\n` +
                `  "a": AdvisorConfig(name="a", enabled=True, member="anthropic", persona="personas/red.md", model=None),\n` +
                `  "b": AdvisorConfig(name="b", enabled=True, member="anthropic", persona="personas/red.md", model=None),\n` +
                `}\n` +
                'try:\n' +
                `    adv.plan_advisor_swap(advisors, Path(${JSON.stringify(root)}))\n` +
                'except adv.CouncilConfigError as e:\n' +
                '    print(json.dumps(str(e)))',
        );
        expect(r.status).toBe(0);
        const advisors = new Map<string, AdvisorConfig>([
            ['a', adv({ name: 'a', member: 'anthropic', persona: 'personas/red.md' })],
            ['b', adv({ name: 'b', member: 'anthropic', persona: 'personas/red.md' })],
        ]);
        let msg = '';
        try {
            plan_advisor_swap(advisors, root);
        } catch (e) {
            msg = (e as Error).message;
        }
        expect(msg).toEqual(JSON.parse(r.stdout.trim()));
    });

    // .title() boundary parity — kebab/snake/digit advisor keys.
    const TITLE_KEYS = ['contrarian', 'red-team', 'foo_bar', 'abc123def', 'a-b_c'];
    it.each(TITLE_KEYS)('display_name titleize(%s) matches', (key) => {
        const root = mkTmp();
        writePersona(root, 'dist/agent-src', 'personas/x.md', 'body'); // no role → titleize the key
        const r = py(
            `advisors = {${JSON.stringify(key)}: AdvisorConfig(name=${JSON.stringify(key)}, enabled=True, member="m", persona="personas/x.md", model=None)}\n` +
                `plans = adv.plan_advisor_swap(advisors, Path(${JSON.stringify(root)}))\n` +
                'print(json.dumps(plans["m"].display_name))',
        );
        expect(r.status).toBe(0);
        const advisors = new Map<string, AdvisorConfig>([
            [key, adv({ name: key, member: 'm', persona: 'personas/x.md' })],
        ]);
        const plans = plan_advisor_swap(advisors, root);
        expect(plans.get('m')!.display_name).toEqual(JSON.parse(r.stdout.trim()));
    });
});
