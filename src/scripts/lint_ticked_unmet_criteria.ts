#!/usr/bin/env tsx
/**
 * Reports an acceptance criterion ticked over its own "NOT met".
 *
 * A `- [x] AC-<n>` item whose own text says a half of it `is NOT met` is a
 * contradiction a reader of the checkbox never sees: the glyph says done, the
 * prose says not. The honest glyph is `[~]`, which carries the unmet half as a
 * deferral rather than hiding it under a tick.
 *
 * The criterion's text is the bullet line plus its indented continuation lines,
 * up to a blank line, a less-indented line or the next checkbox. Fenced code is
 * skipped, so a quoted example is not a finding. The match is the literal
 * `NOT met` — upper-case on purpose, because that is how an author marks the
 * unmet half, and a lower-case "not met" inside an explanation is prose.
 *
 * Usage:
 *   ./scripts-run src/scripts/lint_ticked_unmet_criteria
 *   ./scripts-run src/scripts/lint_ticked_unmet_criteria --root <repo>
 *
 * Scans every `*.md` under the roadmap tree, archive included: an archived
 * roadmap is exactly where a contradictory tick outlives the session that
 * made it.
 *
 * Exit codes: 0 no hit · 1 at least one hit · 2 usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

interface Hit {
    file: string;
    line: number;
    criterion: string;
}

const TICKED_AC_RE = /^([ \t]*)[-*][ \t]+\[[xX]\][ \t]+(AC-[\w.-]+)/;
const CHECKBOX_RE = /^[ \t]*[-*][ \t]+\[[ xX~-]\]/;
const FENCE_RE = /^[ \t]*(```|~~~)/;
const UNMET = 'NOT met';

function _indent(line: string): number {
    return (/^[ \t]*/.exec(line)?.[0] ?? '').length;
}

function scanText(text: string, file: string): Hit[] {
    const lines = text.split('\n');
    const hits: Hit[] = [];
    let inFence = false;
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] as string;
        if (FENCE_RE.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) {
            continue;
        }
        const m = TICKED_AC_RE.exec(line);
        if (!m) {
            continue;
        }
        const base = (m[1] as string).length;
        const block = [line];
        for (let j = i + 1; j < lines.length; j += 1) {
            const next = lines[j] as string;
            if (next.trim() === '' || CHECKBOX_RE.test(next) || FENCE_RE.test(next) || _indent(next) <= base) {
                break;
            }
            block.push(next);
        }
        if (block.join('\n').includes(UNMET)) {
            hits.push({ file, line: i + 1, criterion: m[2] as string });
        }
    }
    return hits;
}

function _walk(dir: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            out.push(..._walk(full));
        } else if (e.isFile() && e.name.endsWith('.md')) {
            out.push(full);
        }
    }
    return out;
}

function scanTree(root: string): { hits: Hit[]; scanned: number } {
    const files = _walk(path.join(root, 'agents', 'roadmaps'));
    const hits: Hit[] = [];
    for (const abs of files) {
        const rel = path.relative(root, abs).split(path.sep).join('/');
        hits.push(...scanText(fs.readFileSync(abs, 'utf8'), rel));
    }
    return { hits, scanned: files.length };
}

const _DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function main(argv: string[] = process.argv.slice(2)): number {
    let root = _DEFAULT_ROOT;
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--root') {
            const v = argv[i + 1];
            if (v === undefined) {
                process.stderr.write('lint_ticked_unmet_criteria: --root requires a value\n');
                return 2;
            }
            root = path.resolve(v);
            i += 1;
        } else {
            process.stderr.write(`lint_ticked_unmet_criteria: unknown argument: ${String(arg)}\n`);
            return 2;
        }
    }
    const { hits, scanned } = scanTree(root);
    if (hits.length === 0) {
        process.stdout.write(`✅  lint_ticked_unmet_criteria: ${String(scanned)} roadmap file(s), no criterion ticked over "${UNMET}".\n`);
        return 0;
    }
    process.stderr.write(
        `❌  lint_ticked_unmet_criteria: ${String(hits.length)} criterion/criteria ticked [x] over their own "${UNMET}":\n`,
    );
    for (const h of hits) {
        process.stderr.write(`  ${h.file}:${String(h.line)} · ${h.criterion}\n`);
    }
    process.stderr.write('\n    The unmet half is a deferral: use `[~]` and carry it, or meet it.\n');
    return 1;
}

if (process.argv[1] !== undefined) {
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        if (here === argv1) {
            process.exit(main());
        }
    } catch {
        if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
            process.exit(main());
        }
    }
}

export { scanText, scanTree, main };
export type { Hit };
