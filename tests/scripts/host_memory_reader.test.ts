// road-to-a-noted-that-is-a-write-carried — step 1.1: the host's auto-memory as
// a read-only recurrence source for the self-repair subject index.
//
// Boundary (AI council 2026-11-04, both seats): the current project's memory
// directory only — never a sibling project, never a worktree's own directory.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { projectStoreSlug } from '../../src/scripts/_lib/cc_transcript.js';
import { detectUserReport } from '../../src/scripts/_lib/self_repair.js';
import {
    HOST_MEMORY_MAX_BYTES,
    hostMemoryArrivals,
    hostMemoryDir,
    readHostFeedback,
} from '../../src/scripts/_lib/host_memory_reader.js';
import { subjectCounts, upsertFinding, writeSubjectIndex } from '../../src/scripts/_lib/self_repair_store.js';

const NOW = '2026-11-04T10:00:00.000Z';

function memoryFile(name: string, type: string, body: string): string {
    return `---\nname: ${name}\ndescription: a correction\nmetadata:\n  type: ${type}\n---\n\n${body}\n`;
}

let tmp: string;
let root: string;
let projects: string;
beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'host-memory-')));
    root = path.join(tmp, 'repo');
    projects = path.join(tmp, 'host', 'projects');
    fs.mkdirSync(root, { recursive: true });
});
afterEach(() => {
    // Restore write bits so the read-only fixture can be removed.
    for (const dir of [projects]) {
        if (!fs.existsSync(dir)) continue;
        for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
            const p = path.join(entry.parentPath, entry.name);
            if (!entry.isSymbolicLink()) fs.chmodSync(p, 0o755);
        }
    }
    fs.rmSync(tmp, { recursive: true, force: true });
});

function seedMemory(dir: string, files: Record<string, string>): void {
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text, 'utf-8');
}

function snapshot(dir: string): Map<string, { bytes: string; mtimeMs: number }> {
    const out = new Map<string, { bytes: string; mtimeMs: number }>();
    for (const name of fs.readdirSync(dir).sort()) {
        const p = path.join(dir, name);
        const st = fs.lstatSync(p);
        out.set(name, { bytes: st.isSymbolicLink() ? fs.readlinkSync(p) : fs.readFileSync(p, 'utf-8'), mtimeMs: st.mtimeMs });
    }
    out.set('.', { bytes: '', mtimeMs: fs.statSync(dir).mtimeMs });
    return out;
}

describe('hostMemoryDir — the decided boundary', () => {
    it('resolves to the current project slug and nothing else', () => {
        expect(hostMemoryDir(root, projects)).toBe(path.join(projects, projectStoreSlug(root), 'memory'));
    });

    it('reads the current project, skips another project and a worktree of the same repo', () => {
        const current = hostMemoryDir(root, projects);
        const other = path.join(projects, projectStoreSlug(path.join(tmp, 'client-repo')), 'memory');
        const worktree = path.join(projects, projectStoreSlug(path.join(root, '.claude', 'worktrees', 'wt')), 'memory');
        seedMemory(current, { 'a.md': memoryFile('a', 'feedback', 'Use `tabs`, not spaces.') });
        seedMemory(other, { 'b.md': memoryFile('b', 'feedback', 'Indent with tabs.') });
        seedMemory(worktree, { 'c.md': memoryFile('c', 'feedback', 'Indent with tabs.') });
        upsertFinding(root, detectUserReport('Du hast schon wieder `tabs` ignoriert')!, NOW);

        const read = readHostFeedback(current);
        expect(read.map((f) => f.file)).toEqual([path.join(current, 'a.md')]);

        const counts = subjectCounts(root, current);
        expect(counts).toEqual([
            expect.objectContaining({ subject: 'tabs', arrivals: 2, host_memory: 1 }),
        ]);
    });
});

describe('readHostFeedback — read-only and bounded', () => {
    it('reads feedback from a 0o555 fixture and leaves its bytes and mtimes unchanged', () => {
        const dir = hostMemoryDir(root, projects);
        seedMemory(dir, {
            'tabs.md': memoryFile('tabs', 'feedback', 'Indent with `tabs`.'),
            'project.md': memoryFile('p', 'project', 'tabs are the project default'),
            'huge.md': memoryFile('h', 'feedback', `tabs ${'x'.repeat(HOST_MEMORY_MAX_BYTES)}`),
            'MEMORY.md': '- [Tabs](tabs.md) — tabs\n',
            'notes.txt': 'tabs',
        });
        fs.symlinkSync(path.join(tmp, 'outside.md'), path.join(dir, 'escape.md'));
        fs.writeFileSync(path.join(tmp, 'outside.md'), memoryFile('o', 'feedback', 'tabs'), 'utf-8');
        for (const name of fs.readdirSync(dir)) {
            if (!fs.lstatSync(path.join(dir, name)).isSymbolicLink()) fs.chmodSync(path.join(dir, name), 0o444);
        }
        fs.chmodSync(dir, 0o555);
        const before = snapshot(dir);

        upsertFinding(root, detectUserReport('I already told you about `tabs`')!, NOW);
        const counts = writeSubjectIndex(root, dir);

        expect(readHostFeedback(dir).map((f) => path.basename(f.file))).toEqual(['tabs.md']);
        expect(counts).toEqual([expect.objectContaining({ subject: 'tabs', arrivals: 2, host_memory: 1 })]);
        expect(snapshot(dir)).toEqual(before);
    });

    it('reads nothing when the directory is missing or is itself a symlink', () => {
        expect(readHostFeedback(path.join(tmp, 'absent'))).toEqual([]);
        const real = path.join(tmp, 'real-memory');
        seedMemory(real, { 'a.md': memoryFile('a', 'feedback', 'tabs') });
        const link = path.join(tmp, 'linked-memory');
        fs.symlinkSync(real, link);
        expect(readHostFeedback(link)).toEqual([]);
    });
});

describe('hostMemoryArrivals — only subjects the store already knows', () => {
    it('counts one arrival per matching file, whole-word, case-insensitive', () => {
        const feedback = [
            { file: '/m/a.md', text: 'Use TABS here' },
            { file: '/m/b.md', text: 'tabs and tabs again' },
            { file: '/m/c.md', text: 'tabsize is unrelated' },
            { file: '/m/d.md', text: 'run lint first' },
        ];
        expect(hostMemoryArrivals(['tabs', 'pnpm build'], feedback)).toEqual({ tabs: 2 });
    });

    it('creates no subject from memory content and is stable across repeat scans', () => {
        const dir = hostMemoryDir(root, projects);
        seedMemory(dir, { 'lint.md': memoryFile('lint', 'feedback', 'Always run `lint`.') });
        upsertFinding(root, detectUserReport('For the third time: tabs.')!, NOW);
        const once = subjectCounts(root, dir);
        expect(once).toEqual([{ subject: 'tabs', arrivals: 1, records: once[0]!.records }]);
        expect(subjectCounts(root, dir)).toEqual(once);
    });
});
