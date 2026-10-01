/**
 * Coexistence fixtures for the rule emitter and the reserved-name sweep
 * (road-to-a-tree-that-keeps-its-neighbours Phase 1.3 and 1.4).
 *
 * Both used to decide by NAME: anything in `.cursor/rules` this run had not
 * just emitted was deleted, and any builtin-named flat command was deleted.
 * These fixtures pin the replacement: a neighbour's file survives, and a
 * stale file of OURS is still removed, so the gate is ownership rather than
 * a blanket refusal to clean.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    WINDSURFRULES_HEADER,
    cleanOwnedOnly,
    keptLine,
    mayWriteWindsurfRules,
} from '../../src/install/host_rule_ownership.js';
import { readRecordedHashes } from '../../src/install/recordedOwnership.js';
import { sweepReservedNames } from '../../src/scripts/_lib/reserved_name_sweep.js';

const dirs: string[] = [];

function tmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), prefix));
    dirs.push(d);
    return d;
}

afterEach(() => {
    while (dirs.length > 0) {
        const d = dirs.pop();
        if (d !== undefined) fs.rmSync(d, { recursive: true, force: true });
    }
});

/** A consumer root with a manifest claiming `claimed` under `.cursor/rules`. */
function consumerWithManifest(claimed: readonly string[]): string {
    const root = tmp('tree-neighbours-');
    fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
    const files = claimed
        .map((rel) => `      - path: ${rel}\n        kind: file\n        sha256: "deadbeef"`)
        .join('\n');
    fs.writeFileSync(
        path.join(root, 'agents', 'installed-tools.lock'),
        `version: "1"\ntools:\n  - name: cursor\n    scope: project\n    files:\n${files}\n`,
        'utf-8',
    );
    return root;
}

function ownedOf(root: string): ReturnType<typeof readRecordedHashes> {
    return readRecordedHashes(path.join(root, 'agents', 'installed-tools.lock'), root);
}

describe('cleanOwnedOnly (1.3)', () => {
    it('keeps a foreign .mdc and removes a stale one of ours', () => {
        const root = consumerWithManifest(['.cursor/rules/stale.mdc', '.cursor/rules/kept.mdc']);
        const dir = path.join(root, '.cursor', 'rules');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'other.mdc'), 'a neighbour wrote this', 'utf-8');
        fs.writeFileSync(path.join(dir, 'stale.mdc'), 'ours, from a previous version', 'utf-8');
        fs.writeFileSync(path.join(dir, 'kept.mdc'), 'ours, emitted this run', 'utf-8');

        const res = cleanOwnedOnly(dir, new Set(['kept.mdc']), ownedOf(root));

        expect(res.removed).toStrictEqual(['stale.mdc']);
        expect(res.kept).toBe(1);
        expect(fs.readFileSync(path.join(dir, 'other.mdc'), 'utf-8')).toBe('a neighbour wrote this');
        expect(fs.existsSync(path.join(dir, 'stale.mdc'))).toBe(false);
        expect(fs.existsSync(path.join(dir, 'kept.mdc'))).toBe(true);
    });

    it('keeps everything when no manifest claims anything', () => {
        const root = tmp('tree-neighbours-');
        const dir = path.join(root, '.cursor', 'rules');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'other.mdc'), 'x', 'utf-8');

        const res = cleanOwnedOnly(dir, new Set(), ownedOf(root));

        expect(res.removed).toStrictEqual([]);
        expect(res.kept).toBe(1);
        expect(fs.existsSync(path.join(dir, 'other.mdc'))).toBe(true);
    });

    it('never removes README.md, and counts it as neither kept nor removed', () => {
        const root = consumerWithManifest(['.cursor/rules/README.md']);
        const dir = path.join(root, '.cursor', 'rules');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'README.md'), 'x', 'utf-8');

        const res = cleanOwnedOnly(dir, new Set(), ownedOf(root));

        expect(res).toStrictEqual({ removed: [], kept: 0 });
        expect(fs.existsSync(path.join(dir, 'README.md'))).toBe(true);
    });

    it('keeps a whole directory when one file inside it is unclaimed', () => {
        const root = consumerWithManifest(['.cursor/rules/sub/ours.mdc']);
        const dir = path.join(root, '.cursor', 'rules');
        fs.mkdirSync(path.join(dir, 'sub'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'sub', 'ours.mdc'), 'ours', 'utf-8');
        fs.writeFileSync(path.join(dir, 'sub', 'theirs.mdc'), 'theirs', 'utf-8');

        const res = cleanOwnedOnly(dir, new Set(), ownedOf(root));

        expect(res.removed).toStrictEqual([]);
        expect(fs.existsSync(path.join(dir, 'sub', 'theirs.mdc'))).toBe(true);
    });

    it('removes a directory when every file inside it is ours', () => {
        const root = consumerWithManifest(['.cursor/rules/sub/ours.mdc']);
        const dir = path.join(root, '.cursor', 'rules');
        fs.mkdirSync(path.join(dir, 'sub'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'sub', 'ours.mdc'), 'ours', 'utf-8');

        const res = cleanOwnedOnly(dir, new Set(), ownedOf(root));

        expect(res.removed).toStrictEqual(['sub']);
        expect(fs.existsSync(path.join(dir, 'sub'))).toBe(false);
    });

    it('reports the kept count on one line, and nothing at zero', () => {
        expect(keptLine(3)).toBe('kept: 3 neighbour file(s)');
        expect(keptLine(0)).toBeNull();
    });
});

describe('mayWriteWindsurfRules (1.3)', () => {
    it('writes when the file is absent', () => {
        const root = tmp('tree-neighbours-');
        expect(mayWriteWindsurfRules(path.join(root, '.windsurfrules'), ownedOf(root))).toBe(true);
    });

    it('writes over our own generated file', () => {
        const root = tmp('tree-neighbours-');
        const target = path.join(root, '.windsurfrules');
        fs.writeFileSync(target, `${WINDSURFRULES_HEADER}\n\n---\n\nrule\n`, 'utf-8');
        expect(mayWriteWindsurfRules(target, ownedOf(root))).toBe(true);
    });

    it("never writes over a file this package did not generate", () => {
        const root = tmp('tree-neighbours-');
        const target = path.join(root, '.windsurfrules');
        fs.writeFileSync(target, "# the consumer's own rules\n", 'utf-8');
        expect(mayWriteWindsurfRules(target, ownedOf(root))).toBe(false);
    });

    it('writes when the manifest claims the path even without the header', () => {
        const root = consumerWithManifest(['.windsurfrules']);
        const target = path.join(root, '.windsurfrules');
        fs.writeFileSync(target, 'no header, but recorded as ours\n', 'utf-8');
        expect(mayWriteWindsurfRules(target, ownedOf(root))).toBe(true);
    });
});

describe('sweepReservedNames (1.4)', () => {
    const isBuiltin = (slug: string): boolean => slug === 'review' || slug === 'init';

    it('keeps a foreign builtin-named command and reports it', () => {
        const anchor = tmp('tree-neighbours-anchor-');
        const commands = path.join(anchor, 'commands');
        fs.mkdirSync(commands, { recursive: true });
        fs.writeFileSync(path.join(commands, 'review.md'), "the consumer's own", 'utf-8');
        fs.writeFileSync(path.join(commands, 'init.md'), 'ours, just written', 'utf-8');

        const current = new Set(['commands/init.md']);
        const res = sweepReservedNames(commands, current, isBuiltin, new Set());

        expect(res.reserved).toStrictEqual(['init']);
        expect(res.foreign).toStrictEqual(['review']);
        expect(fs.readFileSync(path.join(commands, 'review.md'), 'utf-8')).toBe("the consumer's own");
        expect(fs.existsSync(path.join(commands, 'init.md'))).toBe(false);
        expect(current.has('commands/init.md')).toBe(false);
    });

    it('reaps a stale builtin-named file a previous deploy recorded', () => {
        const anchor = tmp('tree-neighbours-anchor-');
        const commands = path.join(anchor, 'commands');
        fs.mkdirSync(commands, { recursive: true });
        fs.writeFileSync(path.join(commands, 'review.md'), 'ours, older version', 'utf-8');

        const res = sweepReservedNames(
            commands,
            new Set(),
            isBuiltin,
            new Set(['commands/review.md']),
        );

        expect(res.reserved).toStrictEqual(['review']);
        expect(res.foreign).toStrictEqual([]);
        expect(fs.existsSync(path.join(commands, 'review.md'))).toBe(false);
    });

    it('leaves a non-builtin name alone whoever wrote it', () => {
        const anchor = tmp('tree-neighbours-anchor-');
        const commands = path.join(anchor, 'commands');
        fs.mkdirSync(commands, { recursive: true });
        fs.writeFileSync(path.join(commands, 'deploy.md'), 'x', 'utf-8');

        const res = sweepReservedNames(commands, new Set(), isBuiltin, new Set());

        expect(res).toStrictEqual({ reserved: [], foreign: [] });
        expect(fs.existsSync(path.join(commands, 'deploy.md'))).toBe(true);
    });

    it('answers empty for a missing commands directory', () => {
        const anchor = tmp('tree-neighbours-anchor-');
        const res = sweepReservedNames(path.join(anchor, 'commands'), new Set(), isBuiltin, new Set());
        expect(res).toStrictEqual({ reserved: [], foreign: [] });
    });
});
