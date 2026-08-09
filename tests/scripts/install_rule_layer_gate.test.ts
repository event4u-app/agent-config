// Integration tests for the installer's duplicate-rule-layer gate
// (`install.ts::_gate_rule_layer_overlap`) — P1.1 of
// `road-to-rule-delivery-integrity`.
//
// The gate exists because Claude Code loads `~/.claude/rules/` and
// `<project>/.claude/rules/` BOTH, user layer first, with no dedup. Measured
// 2026-08-08 on a maintainer machine: 91 shared rules, 74,137 exact-BPE tokens
// redundant. Contract + citations:
// `agents/evidence/analysis/claude-code-rules-dir-contract.md`.
//
// Four properties are pinned, and the last one is the reason the gate suppresses
// instead of deleting:
//
// 1. No overlap → silent pass. The common case must cost nothing.
// 2. Overlap with no `--layer` → refuse. Guessing either doubles the context or
//    hides a layer the user wanted.
// 3. Each `--layer` value produces its stated write set and its suppression.
// 4. **No file outside the chosen layer is unlinked or rewritten, in any path.**
//    Deleting a user's `~/.claude/rules/` would be a Hard-Floor action.
//
// The gate is called directly rather than through the CLI: `main()` returns from
// `_dry_run_summary` before scope resolution, so `--dry-run` cannot reach it.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _gate_rule_layer_overlap, RULE_LAYER_CHOICES } from '../../src/scripts/install.js';

let tmp: string;
let fake_home: string;
let project: string;
let global_rules: string;
let global_rules_real: string;
let project_rules: string;
let saved_home: string | undefined;
let saved_userprofile: string | undefined;

/** Rule text as the installer stamps it into the global layer. */
const stamped = (body: string): string =>
    `---\ntype: "always"\npackage: event4u/agent-config\nsource_path: dist/agent-src/rules/x.md\n---\n\n${body}\n`;
/** The same rule as the project projection carries it. */
const plain = (body: string): string => `---\ntype: "always"\n---\n\n${body}\n`;

const write = (dir: string, name: string, text: string): void => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), text, 'utf-8');
};

/** Snapshot every file under `dir` as `relpath → content`, for an untouched-assert. */
const snapshot = (dir: string): Map<string, string> => {
    const out = new Map<string, string>();
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true }) as fs.Dirent[]) {
        const p = path.join(entry.parentPath ?? dir, entry.name);
        if (entry.isFile()) out.set(path.relative(dir, p), fs.readFileSync(p, 'utf-8'));
    }
    return out;
};

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-layer-gate-'));
    fake_home = path.join(tmp, 'home');
    project = path.join(tmp, 'project');
    global_rules = path.join(fake_home, '.claude', 'rules');
    project_rules = path.join(project, '.claude', 'rules');
    fs.mkdirSync(fake_home, { recursive: true });
    fs.mkdirSync(project, { recursive: true });
    // `os.homedir()` reads $HOME (POSIX) / %USERPROFILE% (Windows) on every call,
    // so redirecting the env is how the gate's homedir is controlled. Spying on
    // the `os` namespace is not an option — an ESM namespace property is
    // non-configurable and `vi.spyOn` throws "Cannot redefine property".
    saved_home = process.env['HOME'];
    saved_userprofile = process.env['USERPROFILE'];
    process.env['HOME'] = fake_home;
    process.env['USERPROFILE'] = fake_home;
    // The gate compares absolute paths it derived itself, and on macOS
    // `os.tmpdir()` is a symlink (`/var` → `/private/var`), so the expected glob
    // must be built from the same realpath the gate will see.
    global_rules_real = path.join(fs.realpathSync(fake_home), '.claude', 'rules');
});

afterEach(() => {
    if (saved_home === undefined) delete process.env['HOME'];
    else process.env['HOME'] = saved_home;
    if (saved_userprofile === undefined) delete process.env['USERPROFILE'];
    else process.env['USERPROFILE'] = saved_userprofile;
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('no overlap → silent pass', () => {
    it('passes when only the global layer exists', () => {
        write(global_rules, 'a.md', stamped('A'));
        expect(_gate_rule_layer_overlap(project, null, false)).toBe(true);
    });

    it('passes when only the project layer exists', () => {
        write(project_rules, 'a.md', plain('A'));
        expect(_gate_rule_layer_overlap(project, null, false)).toBe(true);
    });

    it('passes when both exist but share no basename', () => {
        write(global_rules, 'a.md', stamped('A'));
        write(project_rules, 'b.md', plain('B'));
        expect(_gate_rule_layer_overlap(project, null, false)).toBe(true);
    });

    it('writes no settings file on the silent-pass path', () => {
        write(global_rules, 'a.md', stamped('A'));
        write(project_rules, 'b.md', plain('B'));
        _gate_rule_layer_overlap(project, null, false);
        expect(fs.existsSync(path.join(project, '.claude', 'settings.local.json'))).toBe(false);
    });
});

describe('overlap with no --layer → refuse', () => {
    beforeEach(() => {
        write(global_rules, 'shared.md', stamped('S'));
        write(project_rules, 'shared.md', plain('S'));
    });

    it('returns false', () => {
        expect(_gate_rule_layer_overlap(project, null, false)).toBe(false);
    });

    it('writes nothing while refusing', () => {
        const before = snapshot(tmp);
        _gate_rule_layer_overlap(project, null, false);
        expect(snapshot(tmp)).toEqual(before);
    });
});

describe('each --layer value produces its stated effect', () => {
    beforeEach(() => {
        write(global_rules, 'shared.md', stamped('S'));
        write(project_rules, 'shared.md', plain('S'));
    });

    const excludes = (): unknown => {
        const p = path.join(project, '.claude', 'settings.local.json');
        return fs.existsSync(p)
            ? (JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>)['claudeMdExcludes']
            : undefined;
    };

    it('layer=global suppresses the project rules dir', () => {
        expect(_gate_rule_layer_overlap(project, 'global', false)).toBe(true);
        // Realpath'd: the host reports the dereferenced path, so a glob built
        // from a symlinked one would match nothing. macOS tmpdir is symlinked,
        // which is why this assertion is written against the realpath.
        expect(excludes()).toEqual([`${fs.realpathSync(project_rules)}/**`]);
    });

    it('layer=project suppresses the global rules dir', () => {
        expect(_gate_rule_layer_overlap(project, 'project', false)).toBe(true);
        expect(excludes()).toEqual([`${global_rules_real}/**`]);
    });

    it('layer=both-acknowledged suppresses nothing', () => {
        expect(_gate_rule_layer_overlap(project, 'both-acknowledged', false)).toBe(true);
        expect(excludes()).toBeUndefined();
    });

    it('appends to a pre-existing claudeMdExcludes instead of replacing it', () => {
        const p = path.join(project, '.claude', 'settings.local.json');
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify({ claudeMdExcludes: ['/pre/existing/**'], other: 1 }), 'utf-8');
        _gate_rule_layer_overlap(project, 'global', false);
        const json = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
        expect(json['claudeMdExcludes']).toEqual([
            '/pre/existing/**',
            `${fs.realpathSync(project_rules)}/**`,
        ]);
        expect(json['other']).toBe(1); // unrelated keys survive
    });

    it('is idempotent across a re-install', () => {
        _gate_rule_layer_overlap(project, 'global', false);
        _gate_rule_layer_overlap(project, 'global', false);
        expect(excludes()).toEqual([`${fs.realpathSync(project_rules)}/**`]);
    });

    it('dry_run=true suppresses nothing', () => {
        expect(_gate_rule_layer_overlap(project, 'global', true)).toBe(true);
        expect(excludes()).toBeUndefined();
    });
});

describe('no rule file is ever deleted or rewritten', () => {
    it('holds for all four paths — refuse, global, project, both-acknowledged', () => {
        for (const choice of [null, ...RULE_LAYER_CHOICES]) {
            fs.rmSync(tmp, { recursive: true, force: true });
            fs.mkdirSync(global_rules, { recursive: true });
            fs.mkdirSync(project_rules, { recursive: true });
            write(global_rules, 'shared.md', stamped('S'));
            write(global_rules, 'global-only.md', stamped('G'));
            write(project_rules, 'shared.md', plain('S'));
            const rules_before = new Map([
                ...snapshot(global_rules).entries(),
                ...[...snapshot(project_rules).entries()].map(([k, v]) => [`p/${k}`, v] as const),
            ]);
            _gate_rule_layer_overlap(project, choice, false);
            const rules_after = new Map([
                ...snapshot(global_rules).entries(),
                ...[...snapshot(project_rules).entries()].map(([k, v]) => [`p/${k}`, v] as const),
            ]);
            expect(rules_after, `choice=${String(choice)}`).toEqual(rules_before);
        }
    });
});

describe('a divergent body refuses even with a --layer', () => {
    beforeEach(() => {
        write(global_rules, 'shared.md', stamped('old body'));
        write(project_rules, 'shared.md', plain('new body'));
    });

    it('refuses layer=global — suppressing would drop what only that copy carries', () => {
        expect(_gate_rule_layer_overlap(project, 'global', false)).toBe(false);
    });

    it('refuses layer=project for the same reason', () => {
        expect(_gate_rule_layer_overlap(project, 'project', false)).toBe(false);
    });

    it('allows both-acknowledged — nothing is suppressed, so nothing can be lost', () => {
        expect(_gate_rule_layer_overlap(project, 'both-acknowledged', false)).toBe(true);
    });
});
