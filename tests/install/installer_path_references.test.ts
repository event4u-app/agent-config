// No file under `src/` names `scripts/install.py` as a path or a command.
//
// `road-to-surfaces-no-gate-reads` Phase 2. That path does not exist — the
// Python installer was retired in ADR-200 and the wizard bridge spawns
// `src/scripts/install.ts`. 20 files named it anyway, in two shapes: live
// claims about what runs, and port/mirror comments whose `:NNNN` anchors
// pointed into a deleted file. Both are now gone, and this keeps them gone.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const TOKEN = /scripts\/install\.py/;

/**
 * Two files name the token on purpose, and neither names it as a path:
 *
 *   - `lint_pre_migration_refs.ts` is the gate that SEARCHES for it. Rewriting
 *     a detector's own pattern is how a sweep deletes the detector instead of
 *     the defect — caught here on 2026-10-12, by exactly that sweep.
 *   - `migration_status.ts` compares against the historical path to categorise
 *     a file from the git history as `installer`.
 *
 * Named individually rather than globbed: a directory-wide exemption would
 * grow quietly, and these two are the whole set.
 */
const ALLOWED = new Set(['src/scripts/lint_pre_migration_refs.ts', 'src/scripts/migration_status.ts']);

function* walk(dir: string): Generator<string> {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) yield* walk(full);
        else if (e.isFile()) yield full;
    }
}

interface Hit {
    file: string;
    line: number;
    text: string;
}

/** Every `scripts/install.py` token under `root`, outside the allow-list. */
export function findTokens(root: string, allowed: ReadonlySet<string> = new Set()): Hit[] {
    const hits: Hit[] = [];
    for (const abs of walk(root)) {
        const rel = path.relative(REPO, abs).split(path.sep).join('/');
        if (allowed.has(rel)) continue;
        let body: string;
        try {
            body = fs.readFileSync(abs, 'utf8');
        } catch {
            continue; // binary or unreadable — it carries no prose claim
        }
        body.split('\n').forEach((text, i) => {
            if (TOKEN.test(text)) hits.push({ file: rel, line: i + 1, text: text.trim().slice(0, 120) });
        });
    }
    return hits;
}

describe('installer path references — 2.2', () => {
    it('no file under src/ names scripts/install.py', () => {
        const hits = findTokens(path.join(REPO, 'src'), ALLOWED);
        const message = hits.map((h) => `${h.file}:${String(h.line)}  ${h.text}`).join('\n');
        expect(hits, `scripts/install.py does not exist; name src/scripts/install.ts\n${message}`).toHaveLength(0);
    });

    it('the README does not name it either', () => {
        const body = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
        expect(TOKEN.test(body)).toBe(false);
    });

    it('SENSITIVITY: the walk finds the token when it is there', () => {
        // A test that has never seen the thing it forbids has unknown
        // sensitivity. The fixture is written outside the repository entirely
        // and under a name vitest does not collect.
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'installer-ref-probe-'));
        try {
            const sub = path.join(dir, 'nested');
            fs.mkdirSync(sub, { recursive: true });
            fs.writeFileSync(path.join(sub, 'sample.fixture.ts'), '// run `scripts/install.py --apply-payload`\n');
            const hits = findTokens(dir);
            expect(hits).toHaveLength(1);
            expect(hits[0]?.line).toBe(1);
            expect(hits[0]?.file).toMatch(/sample\.fixture\.ts$/);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('SENSITIVITY: the allow-list is what keeps the two detectors green', () => {
        // Without the allow-list the gate that searches for the token reds on
        // its own pattern — so the exemption is load-bearing and is proved to
        // be, rather than assumed.
        const all = findTokens(path.join(REPO, 'src'));
        expect(all.length).toBeGreaterThan(0);
        expect(new Set(all.map((h) => h.file))).toEqual(ALLOWED);
    });
});
