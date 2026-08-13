/**
 * The scripts-family template-defaults layer (`road-to-scripts-settings-defaults`).
 *
 * The server read path resolves an absent key from the template — pinned by
 * `tests/server/schemas/parity.test.ts`. The scripts path did not: `_DEFAULTS`
 * was `{}` and every consumer supplied its own fallback, so "absent means
 * default" was 167 independent promises and zero guarantees.
 *
 * This file pins the layer that closes the gap AND the two exclusions that keep
 * it from breaking existing installs — the `settingsCarveOut` set, whose
 * absence deliberately means something else, and placeholder-valued leaves the
 * installer fills. Losing either exclusion is a silent behaviour change on
 * every upgrade, which is exactly why they are asserted here rather than
 * described in a comment.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { load as parseYaml } from 'js-yaml';

import * as ags from '../../src/scripts/_lib/agent_settings';
import { SETTINGS_CARVE_OUT, carveOutKeys } from '../../src/shared/settingsCarveOut';

const tmp_dirs: string[] = [];

function make_tmp(): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ags-defaults-')));
    tmp_dirs.push(dir);
    return dir;
}

/** Merge with every FILE layer pointed at nothing — the defaults layer alone. */
function defaults_only(): Record<string, unknown> {
    const tmp = make_tmp();
    return ags.load_agent_settings({
        project_path: path.join(tmp, 'no-project.yml'),
        user_global_path: path.join(tmp, 'no-user.yml'),
    });
}

function leaf(tree: unknown, dotted: string): unknown {
    let node: unknown = tree;
    for (const part of dotted.split('.')) {
        if (typeof node !== 'object' || node === null || Array.isArray(node)) return undefined;
        node = (node as Record<string, unknown>)[part];
    }
    return node;
}

function template_tree(): Record<string, unknown> {
    const raw = fs.readFileSync(ags.default_template_path(), 'utf-8');
    return parseYaml(raw) as Record<string, unknown>;
}

/** Every dotted leaf path in a tree. */
function leaf_paths(value: unknown, prefix = ''): string[] {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return [prefix];
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
        leaf_paths(v, prefix === '' ? k : `${prefix}.${k}`),
    );
}

const IS_PLACEHOLDER = /^__[A-Z0-9_]+__$/;

afterEach(() => {
    ags._reset_template_defaults_cache();
    while (tmp_dirs.length > 0) {
        const d = tmp_dirs.pop() as string;
        fs.rmSync(d, { recursive: true, force: true });
    }
});

describe('template_defaults — the layer itself', () => {
    it('resolves an absent key to its shipped template value', () => {
        const merged = defaults_only();
        const template = template_tree();

        // Concrete, load-bearing keys rather than a smoke check: each of these
        // is read somewhere with its own fallback, and each is a key a sparse
        // settings file legitimately omits.
        for (const key of [
            'subagents.max_parallel',
            'model.auto_switch',
            'memory.cadence',
            'update_check.enabled',
            'commands.suggestion.confidence_floor',
            'emergency.orchestration_halt',
        ]) {
            expect(leaf(merged, key), `${key} should resolve from the template`).toEqual(
                leaf(template, key),
            );
        }
    });

    it('contributes EVERY template leaf that is neither carved out nor a placeholder', () => {
        const merged = defaults_only();
        const template = template_tree();
        const excluded = new Set(carveOutKeys());

        const missing = leaf_paths(template).filter((p) => {
            if (excluded.has(p)) return false;
            if (IS_PLACEHOLDER.test(String(leaf(template, p)))) return false;
            // A carve-out on a parent covers its children.
            if ([...excluded].some((e) => p.startsWith(`${e}.`))) return false;
            return leaf(merged, p) === undefined && leaf(template, p) !== null;
        });

        expect(missing, 'template leaves absent from the defaults layer').toEqual([]);
    });

    it('never injects a carve-out key — absence there means something else', () => {
        const merged = defaults_only();
        for (const row of SETTINGS_CARVE_OUT) {
            expect(
                leaf(merged, row.key),
                `${row.key} is carved out (${row.reader} resolves absent to ${row.absentResolvesTo}) `
                    + 'and must stay absent, or every existing install flips on upgrade',
            ).toBeUndefined();
        }
    });

    it('never injects an un-substituted installer placeholder', () => {
        const merged = defaults_only();
        const template = template_tree();
        const placeholders = leaf_paths(template).filter((p) =>
            IS_PLACEHOLDER.test(String(leaf(template, p))),
        );

        expect(placeholders.length, 'the template should still carry placeholders').toBeGreaterThan(0);
        for (const p of placeholders) {
            expect(leaf(merged, p), `${p} is an installer placeholder, not a default`).toBeUndefined();
        }
    });

    it('degrades to {} when the template is unreadable — the pre-existing behaviour', () => {
        const tmp = make_tmp();
        expect(ags.template_defaults(path.join(tmp, 'no-such-template.yml'))).toEqual({});
    });

    it('returns a deep copy — a mutated NESTED value never reaches the cache', () => {
        // A top-level-only check passes even when every sub-tree is shared by
        // reference, which is exactly the cache-poisoning shape `_deep_merge`
        // produces. Mutate a nested leaf and an array element instead.
        const first = ags.template_defaults();
        const suggestion = (first.commands as Record<string, Record<string, unknown>>)
            .suggestion as Record<string, unknown>;
        suggestion.confidence_floor = 0.99;
        (suggestion.blocklist as unknown[]).push('poison');

        const second = ags.template_defaults();
        expect(leaf(second, 'commands.suggestion.confidence_floor')).not.toBe(0.99);
        expect(leaf(second, 'commands.suggestion.blocklist')).not.toContain('poison');
    });

    it('a settings file read earlier in the process is not the next read\'s default', () => {
        // The regression the suite caught: the cascade merged a real file into
        // a sub-tree shared with the cache, so the FIRST file read became the
        // defaults every later read saw.
        const tmp = make_tmp();
        const loud = path.join(tmp, 'loud.yml');
        fs.writeFileSync(loud, 'commands:\n  suggestion:\n    confidence_floor: 0.75\n', 'utf-8');
        const no_user = path.join(tmp, 'no-user.yml');

        const first = ags.load_agent_settings({ project_path: loud, user_global_path: no_user });
        expect(leaf(first, 'commands.suggestion.confidence_floor')).toBe(0.75);

        const second = ags.load_agent_settings({
            project_path: path.join(tmp, 'no-project.yml'),
            user_global_path: no_user,
        });
        expect(leaf(second, 'commands.suggestion.confidence_floor')).toEqual(
            leaf(template_tree(), 'commands.suggestion.confidence_floor'),
        );
    });
});

describe('precedence — the layer sits BELOW every real layer', () => {
    it('a project-file value wins over the template default', () => {
        // The key must be LIVE in the template, or line two below passes
        // vacuously (undefined !== the written value) and the test certifies
        // nothing. This used `worktrees.mode` until ADR-229 deleted it.
        const tmp = make_tmp();
        const project = path.join(tmp, '.agent-settings.yml');
        fs.writeFileSync(project, 'design:\n  fidelity_mode: "structural"\n', 'utf-8');

        const merged = ags.load_agent_settings({
            project_path: project,
            user_global_path: path.join(tmp, 'no-user.yml'),
        });

        expect(leaf(merged, 'design.fidelity_mode')).toBe('structural');
        expect(leaf(template_tree(), 'design.fidelity_mode')).not.toBe('structural');
    });

    it('a whitelisted user-global value wins over the template default', () => {
        const tmp = make_tmp();
        const user = path.join(tmp, 'agent-settings.yml');
        fs.writeFileSync(user, 'personal:\n  autonomy: on\n', 'utf-8');

        const merged = ags.load_agent_settings({
            project_path: path.join(tmp, 'no-project.yml'),
            user_global_path: user,
        });

        expect(leaf(merged, 'personal.autonomy')).toBe(true);
    });

    it('a sibling key set in a file does not erase its defaulted neighbours', () => {
        const tmp = make_tmp();
        const project = path.join(tmp, '.agent-settings.yml');
        fs.writeFileSync(project, 'commands:\n  suggestion:\n    max_options: 2\n', 'utf-8');

        const merged = ags.load_agent_settings({
            project_path: project,
            user_global_path: path.join(tmp, 'no-user.yml'),
        });

        expect(leaf(merged, 'commands.suggestion.max_options')).toBe(2);
        // The deep merge must not replace the branch wholesale.
        expect(leaf(merged, 'commands.suggestion.confidence_floor')).toEqual(
            leaf(template_tree(), 'commands.suggestion.confidence_floor'),
        );
    });
});

describe('no behaviour change for a key that is present', () => {
    it('every leaf a populated file sets resolves to that file value, defaults layer or not', () => {
        const tmp = make_tmp();
        const project = path.join(tmp, '.agent-settings.yml');
        const body = [
            'worktrees:',
            '  mode: "off"',
            'model:',
            '  auto_switch: never',
            'update_check:',
            '  enabled: false',
            'memory:',
            '  cadence: manual',
            '',
        ].join('\n');
        fs.writeFileSync(project, body, 'utf-8');

        const opts = { project_path: project, user_global_path: path.join(tmp, 'no-user.yml') };
        const withLayer = ags.load_agent_settings(opts);
        const withoutLayer = ags.load_agent_settings({
            ...opts,
            template_path: path.join(tmp, 'no-such-template.yml'),
        });

        for (const p of leaf_paths(parseYaml(body) as Record<string, unknown>)) {
            expect(leaf(withLayer, p), `${p} changed value because of the defaults layer`).toEqual(
                leaf(withoutLayer, p),
            );
        }
    });
});
