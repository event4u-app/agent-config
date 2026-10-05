// The opt-in thinned install — Phase 1 of
// `road-to-an-installed-layer-that-is-thinned`, plus its step 2.2 fixture.
//
// Every case states a layer state BEFORE any code is consulted, and the fixture
// is a synthetic package root rather than this repository's own tree: the
// properties under test are about what the installer does to an arbitrary rule
// set, and pinning them to the live corpus would make them restate whatever the
// corpus happens to contain today.
//
// The one case that is NOT about thinning is the load-bearing one.
// `template-is-not-consent` holds the boundary the whole phase sits on: the
// shipped template already says `lean_projection.mode: delivery`, so an
// installer that resolved the mode through the shared resolver alone would thin
// every consumer's `~/.claude/rules` with nobody having decided it. Whether that
// default flips is owner-reserved (blocker `default-flip-of-the-installed-layer`,
// decision D4), so the gate must refuse a value that reached it from the
// template and from nowhere else.

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    describeThinInstalledLayer,
    thinInstalledRuleLayer,
} from '../../src/install/installThinLayer.js';
import { decideDeployWrite } from '../../src/install/preserve.js';
import { installerThinsHost } from '../../src/scripts/_lib/lean_projection_mode.js';
import { is_thin_entry, THIN_ENTRY_MARKER } from '../../src/scripts/_lib/thin_rules.js';
import { lawText, ruleBody } from '../../src/scripts/_lib/rule_law_section.js';

let tmp: string;
let pkg: string;
let home: string;
let rulesDir: string;
let sourceRules: string;
let savedHome: string | undefined;
let savedUserProfile: string | undefined;
let savedEvent4uHome: string | undefined;

/** A source rule as `dist/agent-src/rules/` carries it: full frontmatter, full body. */
function sourceRule(id: string, body: string): string {
    return (
        '---\n' +
        `description: "What ${id} is for"\n` +
        'triggers:\n' +
        `  - keyword: "${id}-word"\n` +
        '---\n' +
        `\n# ${id}\n\n${body}\n`
    );
}

/** The same rule as the installer leaves it after the copy and the host rewrite. */
function installedRule(id: string, body: string): string {
    return (
        '---\n' +
        'package: event4u/agent-config\n' +
        `source_path: dist/agent-src/rules/${id}.md\n` +
        '---\n' +
        `\n# ${id}\n\n${body}\n`
    );
}

/**
 * Bodies are deliberately LONG — a real rule body runs to thousands of
 * characters, and a one-sentence fixture would make the saving assertion of the
 * upgrade case pass or fail on the stub's own overhead rather than on the
 * mechanism. `padBody` is what makes `charsAfter < charsBefore` a statement
 * about thinning instead of about fixture size.
 */
function padBody(lead: string): string {
    return `${lead}\n\n${'Paragraph of rule prose that the stub replaces. '.repeat(40)}`;
}

const LAW_BODY =
    '## The Iron Law\n\n```\nNEVER SHIP A SHORTENED COPY OF A LAW.\n```\n\n' +
    'Paragraph of rule prose that the stub replaces. '.repeat(40);

/**
 * A package root with four rules, one per branch of `build_thin`'s predicate.
 *
 * `kern` is kernel, `pathy` is path-only, `mute` has no trigger, `routed` and
 * `lawful` are thinnable — `lawful` through the stub-with-law arm.
 */
function makePackage(): void {
    fs.mkdirSync(path.join(pkg, 'dist', 'agent-src', 'rules'), { recursive: true });
    fs.mkdirSync(path.join(pkg, 'src', 'config'), { recursive: true });
    fs.writeFileSync(
        path.join(pkg, 'dist', 'router.json'),
        JSON.stringify({
            schema_version: 2,
            kernel: ['kern'],
            tier_1: [
                { id: 'routed', triggers: [{ keyword: 'routed-word' }], workspaces: [] },
                { id: 'lawful', triggers: [{ keyword: 'lawful-word' }], workspaces: [] },
                { id: 'pathy', triggers: [{ file_pattern: '*.php' }], workspaces: [] },
                { id: 'mute', triggers: [], workspaces: [] },
            ],
            tier_2: [],
            profiles: {},
        }),
        'utf-8',
    );
    fs.writeFileSync(
        path.join(pkg, 'src', 'config', 'rule-consequence-class.json'),
        JSON.stringify({
            criterion_ref: 'test fixture',
            members: { lawful: { reason: 'carries a law a stub must stand behind' } },
            no_stub: {},
            excluded: {},
        }),
        'utf-8',
    );
    for (const [id, body] of [
        ['kern', padBody('Kernel body, never thinned.')],
        ['routed', padBody('A long routed body that the stub replaces.')],
        ['lawful', LAW_BODY],
        ['pathy', padBody('A path-only body, kept full.')],
        ['mute', padBody('A trigger-less body, kept full.')],
    ] as const) {
        fs.writeFileSync(path.join(sourceRules, `${id}.md`), sourceRule(id, body), 'utf-8');
    }
}

/** The installed layer a 16.2.0-shaped install left behind: every body, verbatim. */
function makeInstalledLayer(): void {
    fs.mkdirSync(rulesDir, { recursive: true });
    for (const [id, body] of [
        ['kern', padBody('Kernel body, never thinned.')],
        ['routed', padBody('A long routed body that the stub replaces.')],
        ['lawful', LAW_BODY],
        ['pathy', padBody('A path-only body, kept full.')],
        ['mute', padBody('A trigger-less body, kept full.')],
    ] as const) {
        fs.writeFileSync(path.join(rulesDir, `${id}.md`), installedRule(id, body), 'utf-8');
    }
}

/** Write a settings cascade under a fake HOME, and point the resolver at it. */
function writeUserGlobalSettings(yaml: string | null): void {
    const dir = path.join(home, '.event4u', 'agent-config', 'settings');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, '.agent-settings.yml');
    if (yaml === null) {
        if (fs.existsSync(file)) fs.rmSync(file);
        return;
    }
    fs.writeFileSync(file, yaml, 'utf-8');
}

/** The shipped template, verbatim in the shape that matters: it already says `delivery`. */
function writeShippedTemplate(): void {
    fs.writeFileSync(
        path.join(pkg, 'src', 'config', 'agent-settings.template.yml'),
        'lean_projection:\n  mode: delivery\n  hosts:\n    - claude-code\n',
        'utf-8',
    );
}

const read = (id: string): string => fs.readFileSync(path.join(rulesDir, `${id}.md`), 'utf-8');

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'install-thin-'));
    pkg = path.join(tmp, 'pkg');
    home = path.join(tmp, 'home');
    rulesDir = path.join(home, '.claude', 'rules');
    sourceRules = path.join(pkg, 'dist', 'agent-src', 'rules');
    makePackage();
    writeShippedTemplate();
    makeInstalledLayer();
    savedHome = process.env['HOME'];
    savedUserProfile = process.env['USERPROFILE'];
    savedEvent4uHome = process.env['EVENT4U_CONFIG_HOME'];
    process.env['HOME'] = home;
    process.env['USERPROFILE'] = home;
    // Pinned explicitly rather than left to `os.homedir()`. The user-global
    // layer resolves through `user_global_paths.event4u_root`, which honours
    // this override FIRST — so a machine that happens to carry one would
    // otherwise read the developer's real settings into these cases.
    process.env['EVENT4U_CONFIG_HOME'] = path.join(home, '.event4u', 'agent-config');
});

afterEach(() => {
    if (savedHome === undefined) delete process.env['HOME'];
    else process.env['HOME'] = savedHome;
    if (savedUserProfile === undefined) delete process.env['USERPROFILE'];
    else process.env['USERPROFILE'] = savedUserProfile;
    if (savedEvent4uHome === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
    else process.env['EVENT4U_CONFIG_HOME'] = savedEvent4uHome;
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('the installer applies the projector predicate when asked', () => {
    it('thins the routed rules and leaves the rest of the layer alone', () => {
        const res = thinInstalledRuleLayer({ rulesDir, packageRoot: pkg });

        expect(res.thinned).toBe(2);
        expect(res.kept).toBe(3);
        expect(res.failed).toEqual([]);

        expect(is_thin_entry(read('routed'))).toBe(true);
        expect(is_thin_entry(read('lawful'))).toBe(true);
        for (const id of ['kern', 'pathy', 'mute']) {
            expect(is_thin_entry(read(id)), id).toBe(false);
            expect(read(id), id).toContain('Paragraph of rule prose');
        }
    });

    it('writes an ABSOLUTE body pointer — the project-relative one resolves from no installed layer', () => {
        thinInstalledRuleLayer({ rulesDir, packageRoot: pkg });
        const link = /\]\((.+?)\)/.exec(read('routed'));
        expect(link).not.toBeNull();
        const target = (link as RegExpExecArray)[1] as string;

        expect(path.isAbsolute(target)).toBe(true);
        expect(fs.existsSync(target)).toBe(true);
        expect(target).toBe(path.join(sourceRules, 'routed.md'));
        expect(read('routed')).not.toContain('../../dist/agent-src/rules/');
    });

    it('keeps the ownership keys — they are the reaper only evidence', () => {
        thinInstalledRuleLayer({ rulesDir, packageRoot: pkg });
        for (const id of ['routed', 'lawful']) {
            expect(read(id), id).toContain('package: event4u/agent-config');
            expect(read(id), id).toContain(`source_path: dist/agent-src/rules/${id}.md`);
        }
    });

    it('keeps the matching signal a stub needs, read from the source and not from the rewritten file', () => {
        thinInstalledRuleLayer({ rulesDir, packageRoot: pkg });
        const stub = read('routed');
        expect(stub).toContain(THIN_ENTRY_MARKER);
        expect(stub).toContain('Fires on: routed-word');
        expect(stub).toContain('What routed is for');
    });

    it('is idempotent — a second pass over a thinned layer changes no byte', () => {
        thinInstalledRuleLayer({ rulesDir, packageRoot: pkg });
        const after_one = read('routed');
        const res = thinInstalledRuleLayer({ rulesDir, packageRoot: pkg });
        expect(read('routed')).toBe(after_one);
        expect(res.thinned).toBe(2);
    });

    it('reports a rule the layer does not carry rather than creating it', () => {
        fs.rmSync(path.join(rulesDir, 'routed.md'));
        const res = thinInstalledRuleLayer({ rulesDir, packageRoot: pkg });
        expect(res.absent).toEqual(['routed.md']);
        expect(fs.existsSync(path.join(rulesDir, 'routed.md'))).toBe(false);
    });
});

describe('template-is-not-consent — the gate the owner decision sits behind', () => {
    it('does NOT thin when the only layer carrying the mode is the shipped template', () => {
        writeUserGlobalSettings(null);
        expect(installerThinsHost('claude-code', { packageRoot: pkg, projectRoot: tmp })).toBe(false);
    });

    it('thins when a user-controlled layer sets delivery', () => {
        writeUserGlobalSettings('lean_projection:\n  mode: delivery\n');
        expect(installerThinsHost('claude-code', { packageRoot: pkg, projectRoot: tmp })).toBe(true);
    });

    it('does NOT thin a consumer who explicitly chose eager-all', () => {
        writeUserGlobalSettings('lean_projection:\n  mode: eager-all\n');
        expect(installerThinsHost('claude-code', { packageRoot: pkg, projectRoot: tmp })).toBe(false);
    });

    it('does NOT thin a host the chosen hosts list leaves out', () => {
        writeUserGlobalSettings('lean_projection:\n  mode: delivery\n  hosts:\n    - cursor\n');
        expect(installerThinsHost('claude-code', { packageRoot: pkg, projectRoot: tmp })).toBe(false);
        expect(installerThinsHost('cursor', { packageRoot: pkg, projectRoot: tmp })).toBe(true);
    });
});

describe('rollback', () => {
    it('leaves the layer untouched once the mode is back to eager-all', () => {
        writeUserGlobalSettings('lean_projection:\n  mode: eager-all\n');
        const before = read('routed');
        if (installerThinsHost('claude-code', { packageRoot: pkg, projectRoot: tmp })) {
            thinInstalledRuleLayer({ rulesDir, packageRoot: pkg });
        }
        expect(read('routed')).toBe(before);
        expect(is_thin_entry(read('routed'))).toBe(false);
    });

    it('lets the next copy overwrite a thinned file — the manifest records the bytes this pass left', () => {
        // The ordering IS the rollback: the manifest digest is taken from disk
        // AFTER the thin pass, so the stub is `recorded-unchanged` and the
        // verbatim copy may replace it. A digest taken BEFORE would read
        // `recorded-modified` and preserve the stub forever, which is the failure
        // this case exists to catch.
        thinInstalledRuleLayer({ rulesDir, packageRoot: pkg });
        const recorded = createHash('sha256')
            .update(fs.readFileSync(path.join(rulesDir, 'routed.md')))
            .digest('hex');
        expect(
            decideDeployWrite({
                exists: true,
                recordedSha256: recorded,
                onDiskSha256: recorded,
                force: false,
            }),
        ).toBe('write');

        // And the copy that follows restores the full body.
        fs.copyFileSync(path.join(sourceRules, 'routed.md'), path.join(rulesDir, 'routed.md'));
        expect(is_thin_entry(read('routed'))).toBe(false);
    });
});

describe('upgrade', () => {
    it('converges a 16.2.0-shaped layer to the thinned one', () => {
        for (const id of ['routed', 'lawful']) expect(is_thin_entry(read(id))).toBe(false);
        const res = thinInstalledRuleLayer({ rulesDir, packageRoot: pkg });
        expect(res.thinned).toBe(2);
        expect(res.charsAfter).toBeLessThan(res.charsBefore);
        for (const id of ['routed', 'lawful']) expect(is_thin_entry(read(id))).toBe(true);
    });

    it('preserves a user-modified rule and reports it, never overwrites it', () => {
        const target = path.join(rulesDir, 'routed.md');
        const edited = `${installedRule('routed', 'A long routed body that the stub replaces.')}\nMY OWN NOTE\n`;
        fs.writeFileSync(target, edited, 'utf-8');

        const res = thinInstalledRuleLayer({
            rulesDir,
            packageRoot: pkg,
            preserved: new Set([path.resolve(target)]),
        });

        expect(fs.readFileSync(target, 'utf-8')).toBe(edited);
        expect(res.preserved).toEqual(['routed.md']);
        expect(res.thinned).toBe(1);
        expect(describeThinInstalledLayer(res).join('\n')).toContain('routed.md');
    });

    it('reports both standing totals', () => {
        const res = thinInstalledRuleLayer({ rulesDir, packageRoot: pkg });
        const line = describeThinInstalledLayer(res)[0] as string;
        expect(line).toContain(`${String(res.charsBefore)} -> ${String(res.charsAfter)} chars`);
        expect(res.charsBefore).toBeGreaterThan(0);
        expect(res.charsAfter).toBeGreaterThan(0);
    });
});

describe('standing-only', () => {
    it('carries every consequence-class law byte-equal to its source section', () => {
        thinInstalledRuleLayer({ rulesDir, packageRoot: pkg });
        const sourceLaw = lawText(ruleBody(fs.readFileSync(path.join(sourceRules, 'lawful.md'), 'utf-8')));
        expect(sourceLaw).not.toBeNull();
        expect(read('lawful')).toContain(sourceLaw as string);
    });

    it('does not put a law into a stub for a rule that is not in the class', () => {
        thinInstalledRuleLayer({ rulesDir, packageRoot: pkg });
        expect(read('routed')).not.toContain('<!-- law: byte-copied');
    });
});

