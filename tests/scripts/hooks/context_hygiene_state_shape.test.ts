/**
 * Step 1.2 of road-to-signals-that-mean-what-they-say: `loop_detected` and
 * `consecutive_same_tool` are removed from the context-hygiene hook's state,
 * its readers, and every prose mention — a flag that fired true after 74 of
 * 110 calls of ordinary, non-looping work, reached no model, and had one
 * reader pointed at a path nothing wrote.
 *
 * This is the "fails on any hit" sweep the roadmap step names: it greps
 * `src/` and `docs/` (never `tests/`, which legitimately asserts the fields'
 * ABSENCE using the field names as strings) for both field names and fails
 * if either survives anywhere in those two trees.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const REMOVED_FIELDS = ['loop_detected', 'consecutive_same_tool'];

// Directories that are themselves build output / vendored and would only
// echo a stale copy of whatever src/ used to say — never hand-authored.
const SKIP_DIR_NAMES = new Set(['node_modules', '.git']);

function* walk(dir: string): Generator<string> {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        if (SKIP_DIR_NAMES.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            yield* walk(full);
        } else if (entry.isFile()) {
            yield full;
        }
    }
}

function findHits(root: string): { file: string; field: string }[] {
    const hits: { file: string; field: string }[] = [];
    for (const file of walk(root)) {
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf-8');
        } catch {
            continue;
        }
        for (const field of REMOVED_FIELDS) {
            if (text.includes(field)) {
                hits.push({ file: path.relative(REPO_ROOT, file), field });
            }
        }
    }
    return hits;
}

describe('context-hygiene loop fields are fully removed from src/ and docs/', () => {
    it('no file under src/ mentions loop_detected or consecutive_same_tool', () => {
        const hits = findHits(path.join(REPO_ROOT, 'src'));
        expect(hits).toEqual([]);
    });

    it('no file under docs/ mentions loop_detected or consecutive_same_tool', () => {
        const hits = findHits(path.join(REPO_ROOT, 'docs'));
        expect(hits).toEqual([]);
    });
});
