// `installed_layer_report` — what a host actually loads, per host rule
// directory (step 0.1 of `road-to-a-rule-carrier-that-works-outside-the-repo`).
//
// Every expectation here is DERIVED FROM THE FIXTURE CONSTANTS, never copied
// from a real run — the house style `preamble_byte_census.test.ts` states. A
// report test that pins numbers it read off the maintainer's machine passes
// until someone else runs it, and then reports the machine instead of the bug.
//
// The fixtures build host rule directories rather than installing, and the
// library is what makes that legitimate: `home` and `projectRoot` are
// parameters, so a staged tree and a real `HOME` are the same call. One case
// asserts that property directly, because it is the whole reason step 0.1's
// "install into a temporary HOME" is reachable at all.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    buildInstalledLayerReport,
    isUnconditional,
    readLayer,
    renderInstalledLayerReport,
    TOP_FILES,
} from '../../src/scripts/_lib/installed_layer.js';
import { parseArgs } from '../../src/scripts/installed_layer_report.js';

const made: string[] = [];

function mkTmp(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    made.push(dir);
    return dir;
}

afterEach(() => {
    while (made.length > 0) {
        const dir = made.pop() as string;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

/** A rule whose BODY is exactly `chars` characters after the strip. */
function rule(chars: number, opts: { scoped?: boolean } = {}): string {
    const front = opts.scoped
        ? '---\ntype: auto\npaths:\n  - "**/*.php"\n---\n'
        : '---\ntype: auto\n---\n';
    // The comment and the frontmatter are both stripped, so neither may count
    // toward `chars` — including them here is what makes the strip falsifiable
    // rather than merely exercised.
    return `${front}<!-- authoring scaffolding nobody renders -->\n${'x'.repeat(chars)}`;
}

/** Stage `~/.claude/rules` under a throwaway HOME. */
function stageGlobal(home: string, files: Record<string, string>): string {
    const dir = path.join(home, '.claude', 'rules');
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, text] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, name), text, 'utf-8');
    }
    return dir;
}

describe('installed-layer report — the strip, which no existing census performs', () => {
    it('counts characters AFTER frontmatter and block comments, not bytes on disk', () => {
        const home = mkTmp('ilr-strip-');
        const dir = stageGlobal(home, { 'a.md': rule(100) });
        const onDisk = fs.statSync(path.join(dir, 'a.md')).size;
        const layer = readLayer('claude-code', 'global', dir, new Map());
        expect(layer.chars).toBe(100);
        // The gap is the point: every published figure for this tree is the
        // left-hand number, and this report is the right-hand one.
        expect(onDisk).toBeGreaterThan(layer.chars);
    });

    it('a file with nothing left after the strip counts as a file and as zero characters', () => {
        const home = mkTmp('ilr-empty-');
        const dir = stageGlobal(home, { 'empty.md': '---\ntype: auto\n---\n<!-- only this -->\n' });
        const layer = readLayer('claude-code', 'global', dir, new Map());
        expect(layer.files).toBe(1);
        expect(layer.chars).toBe(0);
    });
});

describe('installed-layer report — unconditional against scoped', () => {
    it('a rule with no `paths:` key loads every session', () => {
        expect(isUnconditional(rule(10))).toBe(true);
        expect(isUnconditional(rule(10, { scoped: true }))).toBe(false);
    });

    it('the layer counts both, and the counts are over the same file set', () => {
        const home = mkTmp('ilr-uncond-');
        const dir = stageGlobal(home, {
            'u1.md': rule(10),
            'u2.md': rule(20),
            's1.md': rule(30, { scoped: true }),
        });
        const layer = readLayer('claude-code', 'global', dir, new Map());
        expect(layer.files).toBe(3);
        expect(layer.unconditional).toBe(2);
        expect(layer.chars).toBe(60);
    });
});

describe('installed-layer report — the step own fixture: one unscoped 5,000-character rule', () => {
    it('moves BOTH the file count and the character count', () => {
        // Verbatim from step 0.1: "A fixture that adds one unscoped
        // 5,000-character rule must move both the file and the character
        // count." Both halves are asserted, because an instrument that moved
        // only the file count would be counting files and calling it
        // characters, and one that moved only the characters would be summing a
        // directory without knowing what is in it.
        const home = mkTmp('ilr-delta-');
        const dir = stageGlobal(home, { 'base.md': rule(40) });
        const before = readLayer('claude-code', 'global', dir, new Map());
        fs.writeFileSync(path.join(dir, 'added.md'), rule(5000), 'utf-8');
        const after = readLayer('claude-code', 'global', dir, new Map());
        expect(after.files - before.files).toBe(1);
        expect(after.chars - before.chars).toBe(5000);
        expect(after.unconditional - before.unconditional).toBe(1);
    });

    it('a SCOPED 5,000-character rule moves the characters and not the unconditional count', () => {
        // The negative half of the same fixture. Without it, "unconditional"
        // would be satisfied by a counter that returns the file count.
        const home = mkTmp('ilr-delta-scoped-');
        const dir = stageGlobal(home, { 'base.md': rule(40) });
        const before = readLayer('claude-code', 'global', dir, new Map());
        fs.writeFileSync(path.join(dir, 'scoped.md'), rule(5000, { scoped: true }), 'utf-8');
        const after = readLayer('claude-code', 'global', dir, new Map());
        expect(after.chars - before.chars).toBe(5000);
        expect(after.unconditional - before.unconditional).toBe(0);
    });
});

describe('installed-layer report — the 20 largest', () => {
    it('ranks by the SAME measure as the total, descending, capped at 20', () => {
        const home = mkTmp('ilr-top-');
        const files: Record<string, string> = {};
        // 25 files, each a different size, named so that alphabetical order is
        // the REVERSE of size order — a ranking that fell back to readdir order
        // would be visibly wrong rather than accidentally right.
        for (let i = 0; i < 25; i += 1) files[`r${String(i).padStart(2, '0')}.md`] = rule(100 + i);
        const dir = stageGlobal(home, files);
        const layer = readLayer('claude-code', 'global', dir, new Map());
        expect(layer.files).toBe(25);
        expect(layer.top).toHaveLength(TOP_FILES);
        expect(layer.top[0]).toMatchObject({ file: 'r24.md', chars: 124 });
        expect(layer.top.map((f) => f.chars)).toEqual(
            [...layer.top.map((f) => f.chars)].sort((a, b) => b - a),
        );
        // The smallest five are absent, which is what "the 20 largest" means.
        expect(layer.top.map((f) => f.file)).not.toContain('r00.md');
    });
});

describe('installed-layer report — package-owned against foreign', () => {
    it('a file the manifest records is package-owned; one it does not is foreign', () => {
        const home = mkTmp('ilr-own-');
        const dir = stageGlobal(home, { 'ours.md': rule(10), 'theirs.md': rule(20) });
        const recorded = new Map<string, string | null>([[path.join(dir, 'ours.md'), 'deadbeef']]);
        const layer = readLayer('claude-code', 'global', dir, recorded);
        expect(layer.package_owned).toBe(1);
        expect(layer.foreign).toBe(1);
    });

    it('a recorded path with a null digest is still package-owned', () => {
        // `null` means "recorded without a digest" — bridges carry that. The
        // report's question is whether the install CLAIMS the file, and a claim
        // without a digest is still a claim; `classifyOwnership` answers the
        // finer did-the-bytes-change question and is deliberately not folded in.
        const home = mkTmp('ilr-own-null-');
        const dir = stageGlobal(home, { 'bridge.md': rule(10) });
        const recorded = new Map<string, string | null>([[path.join(dir, 'bridge.md'), null]]);
        expect(readLayer('claude-code', 'global', dir, recorded).package_owned).toBe(1);
    });

    it('no manifest means every file reads foreign, and the report SAYS that is no evidence', () => {
        const home = mkTmp('ilr-own-none-');
        stageGlobal(home, { 'a.md': rule(10) });
        const report = buildInstalledLayerReport({
            home,
            projectRoot: mkTmp('ilr-own-proj-'),
            manifestPath: null,
        });
        expect(report.manifest_present).toBe(false);
        expect(report.totals.foreign).toBe(1);
        expect(report.totals.package_owned).toBe(0);
        expect(renderInstalledLayerReport(report).join('\n')).toContain('no evidence');
    });
});

describe('installed-layer report — per host rule directory, both scopes', () => {
    it('reads every host global layer and every host project layer', () => {
        const home = mkTmp('ilr-hosts-home-');
        const project = mkTmp('ilr-hosts-proj-');
        stageGlobal(home, { 'g.md': rule(11) });
        const projDir = path.join(project, '.claude', 'rules');
        fs.mkdirSync(projDir, { recursive: true });
        fs.writeFileSync(path.join(projDir, 'p.md'), rule(22), 'utf-8');
        const report = buildInstalledLayerReport({ home, projectRoot: project });
        const scopes = report.layers.filter((l) => l.host === 'claude-code');
        expect(scopes.map((l) => l.scope).sort()).toEqual(['global', 'project']);
        // BOTH, because the host unions them — a reading of the global layer
        // alone understates a consumer carrying its own project rules.
        expect(report.totals.chars).toBe(33);
        expect(report.totals.files).toBe(2);
    });

    it('an absent directory reports present:false rather than failing', () => {
        const report = buildInstalledLayerReport({
            home: mkTmp('ilr-absent-home-'),
            projectRoot: mkTmp('ilr-absent-proj-'),
        });
        expect(report.layers.every((l) => !l.present)).toBe(true);
        expect(report.totals.files).toBe(0);
        expect(renderInstalledLayerReport(report).join('\n')).toContain('absent');
    });

    it('a directory that is not `.md` contributes nothing', () => {
        const home = mkTmp('ilr-ext-');
        const dir = stageGlobal(home, { 'a.md': rule(5) });
        fs.writeFileSync(path.join(dir, 'b.mdc'), rule(999), 'utf-8');
        fs.mkdirSync(path.join(dir, 'nested'));
        expect(readLayer('claude-code', 'global', dir, new Map()).chars).toBe(5);
    });
});

describe('installed-layer report — HOME is a parameter, which is what makes a temp install observable', () => {
    it('two HOMEs under one process give two different readings', () => {
        // The property step 0.1 needs and `check_standing_rule_delivery` denied
        // in its header: nothing here reads `os.homedir()`, so a runner that
        // stages an install under a temporary HOME can be measured.
        const a = mkTmp('ilr-home-a-');
        const b = mkTmp('ilr-home-b-');
        const project = mkTmp('ilr-home-proj-');
        stageGlobal(a, { 'one.md': rule(7) });
        stageGlobal(b, { 'one.md': rule(7), 'two.md': rule(9) });
        const ra = buildInstalledLayerReport({ home: a, projectRoot: project });
        const rb = buildInstalledLayerReport({ home: b, projectRoot: project });
        expect(ra.totals).toMatchObject({ files: 1, chars: 7 });
        expect(rb.totals).toMatchObject({ files: 2, chars: 16 });
    });

    it('the host version is never fabricated', () => {
        const report = buildInstalledLayerReport({
            home: mkTmp('ilr-ver-'),
            projectRoot: mkTmp('ilr-ver-proj-'),
        });
        expect(report.host_version).toBe('unknown');
    });
});

describe('installed-layer report — the CLI surface', () => {
    it('takes --home and --project, so the report can be pointed anywhere', () => {
        expect(parseArgs(['--home', '/tmp/h', '--project', '/tmp/p'])).toMatchObject({
            home: '/tmp/h',
            project: '/tmp/p',
            json: false,
        });
        expect(parseArgs(['--json'])?.json).toBe(true);
    });

    it('refuses an unknown flag and a flag with no value', () => {
        expect(parseArgs(['--nope'])).toBeNull();
        expect(parseArgs(['--home'])).toBeNull();
    });
});
