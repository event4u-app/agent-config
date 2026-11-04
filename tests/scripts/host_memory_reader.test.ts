// road-to-a-noted-that-is-a-write 1.3 — the host's auto-memory is a read-only
// recurrence source (owner answer OQ-33, 2026-10-29).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    hostConfigRoots,
    hostMemoryArrivals,
    readHostMemory,
} from '../../src/scripts/_lib/host_memory_reader.js';
import { detectUserReport } from '../../src/scripts/_lib/self_repair.js';
import { subjectCounts, upsertFinding } from '../../src/scripts/_lib/self_repair_store.js';

let tmp: string;
let root: string;
let memDir: string;

function snapshot(dir: string): Record<string, string> {
    const out: Record<string, string> = {};
    const walk = (d: string): void => {
        for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, ent.name);
            if (ent.isDirectory()) walk(p);
            else out[path.relative(dir, p)] = `${fs.statSync(p).mtimeMs}|${fs.readFileSync(p, 'utf-8')}`;
        }
    };
    walk(dir);
    return out;
}

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hostmem-')));
    root = path.join(tmp, 'claude');
    memDir = path.join(root, 'projects', '-repo', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(path.join(memDir, 'MEMORY.md'), '- [Tabs](tabs.md) — use tabs\n');
    fs.writeFileSync(
        path.join(memDir, 'tabs.md'),
        '---\nname: tabs-not-spaces\ndescription: indent with Tabs\nmetadata:\n  type: feedback\n---\n\nUse tabs.\n',
    );
    fs.writeFileSync(
        path.join(memDir, 'role.md'),
        '---\nname: role\ndescription: senior dev who likes tabs\nmetadata:\n  type: user\n---\n\nBackend.\n',
    );
    fs.writeFileSync(path.join(memDir, 'notes.txt'), 'not a memory');
});

afterEach(() => {
    fs.chmodSync(memDir, 0o755);
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('host memory reader', () => {
    it('reads every memory file with its frontmatter and skips the index', () => {
        const entries = readHostMemory([root]);
        expect(entries.map((e) => e.name).sort()).toEqual(['role', 'tabs-not-spaces']);
        expect(entries.find((e) => e.name === 'tabs-not-spaces')).toMatchObject({
            project: '-repo',
            type: 'feedback',
            description: 'indent with Tabs',
            body: 'Use tabs.',
        });
    });

    it('counts only feedback memories, by whole word, case-insensitively', () => {
        const entries = readHostMemory([root]);
        expect(hostMemoryArrivals(entries, 'tabs')).toBe(1);
        expect(hostMemoryArrivals(entries, 'tab')).toBe(0);
        expect(hostMemoryArrivals(entries, '')).toBe(0);
    });

    it('never writes to the host directory', () => {
        const before = snapshot(root);
        fs.chmodSync(memDir, 0o555);
        const entries = readHostMemory([root]);
        const store = path.join(tmp, 'repo');
        upsertFinding(store, detectUserReport('For the third time: tabs.')!, '2026-11-04T10:00:00.000Z');
        expect(subjectCounts(store, entries)[0]).toMatchObject({ subject: 'tabs', arrivals: 2, host_memory: 1 });
        expect(snapshot(root)).toEqual(before);
    });

    it('returns nothing for an absent config root instead of throwing', () => {
        expect(readHostMemory([path.join(tmp, 'absent')])).toEqual([]);
    });

    it('honours CLAUDE_CONFIG_DIR as a replacement for ~/.claude', () => {
        expect(hostConfigRoots({ CLAUDE_CONFIG_DIR: '/cfg' }, '/home/u')).toEqual(['/cfg']);
        expect(hostConfigRoots({}, '/home/u')).toEqual([path.join('/home/u', '.claude')]);
    });
});
