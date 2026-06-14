#!/usr/bin/env node
/**
 * Inventory frontmatter keys across all agent artefacts.
 *
 * TypeScript twin of `src/scripts/inventory_frontmatter.py` (ADR-096 —
 * Python→TS migration, Phase 8 / Wave 8c). Mirrors the CLI contract
 * EXACTLY: no flags, exit code 0, byte-identical Markdown stdout. No
 * behaviour changes — latent bugs (line-based frontmatter parse, the
 * `value or "{empty}"` falsiness on `"0"` / `""`, integer `//` percent)
 * replicated.
 *
 * Reads `.agent-src.uncondensed/{skills,rules,commands,personas}`, parses
 * the YAML frontmatter of every file, and prints per-type:
 *
 * - total file count
 * - every key observed, with count and percentage
 * - sample values (up to 3) per key
 *
 * Output is Markdown on stdout, intended to be captured into
 * `agents/reference/docs/frontmatter-contract.md` as raw material for
 * Phase 1 of the frontmatter-schema roadmap.
 *
 * Stdlib-only (no YAML library) — a simple line-based parse sufficient for
 * our frontmatter shapes (flat keys, inline lists, block lists, one nested
 * `execution:` block).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/inventory_frontmatter.ts → parents[2] is the repo root.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SRC = path.join(ROOT, '.agent-src.uncondensed');

// Python: re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;

function extract_frontmatter(text: string): string | null {
    const m = FRONTMATTER_RE.exec(text);
    return m ? m[1]! : null;
}

const _TOPLEVEL_KEY_RE = /^([\w-]+):\s*(.*?)\s*$/;
const _NESTED_KEY_RE = /^\s+([\w-]+):\s*(.*?)\s*$/;

/**
 * Return a flat {key: raw_value_string} for a frontmatter block.
 *
 * For nested blocks (e.g. `execution:`), the nested keys are flattened with
 * dot notation: `execution.type`, `execution.handler`, etc. Inline lists
 * (`personas: [a, b]`) and block lists (`- a\n- b`) are rendered as their
 * raw value.
 */
function parse_frontmatter_keys(fm: string): Map<string, string> {
    const result = new Map<string, string>();
    const lines = fm.split('\n');
    let i = 0;
    let current_nested: string | null = null;
    let current_list_key: string | null = null;
    let list_buffer: string[] = [];

    const flush_list = (): void => {
        if (current_list_key !== null) {
            result.set(current_list_key, '[' + list_buffer.join(', ') + ']');
        }
        current_list_key = null;
        list_buffer = [];
    };

    while (i < lines.length) {
        const line = lines[i]!;
        const stripped = _pyStrip(line);

        if (!stripped || stripped.startsWith('#')) {
            i += 1;
            continue;
        }

        // Top-level key (no leading whitespace). Python: `line[0].isspace()`.
        if (line.length > 0 && !_isPySpace(line[0]!)) {
            flush_list();
            current_nested = null;
            const m = _TOPLEVEL_KEY_RE.exec(line);
            if (m) {
                const key = m[1]!;
                const value = m[2]!;
                if (value === '' || value === '|') {
                    // Could start a nested block OR a list. Look ahead.
                    const nxt = i + 1 < lines.length ? _pyStrip(lines[i + 1]!) : '';
                    if (nxt.startsWith('- ')) {
                        current_list_key = key;
                    } else {
                        current_nested = key;
                        result.set(key, '{nested}');
                    }
                } else {
                    result.set(key, value);
                }
            }
        } else if (current_nested !== null) {
            // Nested (indented) key.
            const m = _NESTED_KEY_RE.exec(line);
            if (m) {
                const key = m[1]!;
                const value = m[2]!;
                result.set(`${current_nested}.${key}`, value || '{nested}');
            }
        } else if (current_list_key !== null && stripped.startsWith('- ')) {
            // Block list item.
            list_buffer.push(_pyStrip(stripped.slice(2)));
        }

        i += 1;
    }

    flush_list();
    return result;
}

function gather_files(artefact_dir: string, predicate: (basename: string) => boolean): string[] {
    if (!fs.existsSync(artefact_dir)) {
        return [];
    }
    const files: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            // Python: `if not f.is_symlink()` — drop symlinks (dirs + files).
            if (e.isSymbolicLink()) {
                continue;
            }
            if (e.isDirectory()) {
                walk(full);
            } else if (e.isFile() && predicate(e.name)) {
                files.push(full);
            }
        }
    };
    walk(artefact_dir);
    return _pySortPaths(files);
}

/**
 * pathlib `sorted(list[Path])` — component-wise comparison of the path
 * parts. Mirrors how Python orders Path objects.
 */
function _pySortPaths(paths: string[]): string[] {
    return [...paths].sort((a, b) => {
        const pa = a.split(path.sep);
        const pb = b.split(path.sep);
        const n = Math.min(pa.length, pb.length);
        for (let i = 0; i < n; i++) {
            const c = _pyStrCmp(pa[i]!, pb[i]!);
            if (c !== 0) {
                return c;
            }
        }
        return pa.length - pb.length;
    });
}

function _pyStrCmp(a: string, b: string): number {
    const ca = Array.from(a);
    const cb = Array.from(b);
    const n = Math.min(ca.length, cb.length);
    for (let i = 0; i < n; i++) {
        const x = ca[i]!.codePointAt(0)!;
        const y = cb[i]!.codePointAt(0)!;
        if (x !== y) {
            return x - y;
        }
    }
    return ca.length - cb.length;
}

const _OUT: string[] = [];
function emit(line = ''): void {
    _OUT.push(line);
}

function inventory_type(name: string, files: string[]): void {
    const total = files.length;
    emit(`### ${name} — ${total} files\n`);
    if (total === 0) {
        emit('_(no files)_\n');
        return;
    }

    // Counter[str] — insertion-ordered key counts.
    const key_counts = new Map<string, number>();
    // dict[str, Counter[str]] — per-key value counts, insertion-ordered.
    const key_value_counts = new Map<string, Map<string, number>>();

    for (const f of files) {
        const text = fs.readFileSync(f, 'utf-8');
        const fm = extract_frontmatter(text);
        if (fm === null) {
            continue;
        }
        const parsed = parse_frontmatter_keys(fm);
        for (const [k, v] of parsed) {
            key_counts.set(k, (key_counts.get(k) ?? 0) + 1);
            // Record distinct values for enum detection; truncate to keep
            // the table readable and strip surrounding quotes.
            // Python: `v.strip('"').strip("'")[:80] if v else "{empty}"`.
            const normalized = v ? _sliceCodepoints(_pyStripChars(_pyStripChars(v, '"'), "'"), 80) : '{empty}';
            const inner = key_value_counts.get(k) ?? new Map<string, number>();
            inner.set(normalized, (inner.get(normalized) ?? 0) + 1);
            key_value_counts.set(k, inner);
        }
    }

    emit('| key | count | % | status | distinct values (count) |');
    emit('|---|---:|---:|---|---|');
    // sorted(key_counts.items(), key=lambda kv: (-kv[1], kv[0])).
    const sortedKeys = [...key_counts.entries()].sort((a, b) => {
        if (a[1] !== b[1]) {
            return b[1] - a[1]; // -count ascending == count descending
        }
        return _pyStrCmp(a[0], b[0]);
    });
    for (const [key, count] of sortedKeys) {
        // Python integer division: count * 100 // total.
        const pct = Math.floor((count * 100) / total);
        const status = pct >= 95 ? 'required' : 'optional';
        const values = key_value_counts.get(key)!;
        let rendered: string;
        if (values.size <= 8) {
            rendered = _mostCommon(values)
                .map(([val, n]) => `\`${val}\` (${n})`)
                .join(' · ');
        } else {
            const top = _mostCommon(values).slice(0, 5);
            rendered = top.map(([val, n]) => `\`${val}\` (${n})`).join(' · ');
            rendered += ` · … +${values.size - 5} more`;
        }
        emit(`| \`${key}\` | ${count} | ${pct}% | ${status} | ${rendered} |`);
    }
    emit();
}

/**
 * Mirror collections.Counter.most_common(): sort by count descending,
 * ties keep insertion order (Python's Counter.most_common is stable on
 * insertion order for equal counts via heapq/sorted stability).
 */
function _mostCommon(counter: Map<string, number>): [string, number][] {
    const indexed = [...counter.entries()].map((e, idx) => ({ e, idx }));
    indexed.sort((a, b) => {
        if (a.e[1] !== b.e[1]) {
            return b.e[1] - a.e[1];
        }
        return a.idx - b.idx;
    });
    return indexed.map((x) => x.e);
}

export function main(): number {
    _OUT.length = 0;
    emit('# Frontmatter inventory (generated)\n');
    emit('Generated by `scripts/inventory_frontmatter.py`. Raw material for');
    emit('Phase 1 of the frontmatter-schema roadmap. Do not edit by hand.\n');

    inventory_type('skills', gather_files(path.join(SRC, 'skills'), (b) => b === 'SKILL.md'));
    inventory_type('rules', gather_files(path.join(SRC, 'rules'), (b) => b.endsWith('.md')));
    inventory_type('commands', gather_files(path.join(SRC, 'commands'), (b) => b.endsWith('.md')));
    inventory_type(
        'personas',
        gather_files(path.join(SRC, 'personas'), (b) => b.endsWith('.md')).filter(
            (f) => path.basename(f).toLowerCase() !== 'readme.md',
        ),
    );

    process.stdout.write(_OUT.join('\n') + '\n');
    return 0;
}

// --- Python string-method helpers --------------------------------------------

/** Mirror Python str.strip() default — strip leading + trailing whitespace. */
function _pyStrip(s: string): string {
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}

/** Mirror Python str.strip(chars) — strip any of the given chars from both ends. */
function _pyStripChars(s: string, chars: string): string {
    const set = new Set(Array.from(chars));
    const arr = Array.from(s);
    let start = 0;
    let end = arr.length;
    while (start < end && set.has(arr[start]!)) {
        start += 1;
    }
    while (end > start && set.has(arr[end - 1]!)) {
        end -= 1;
    }
    return arr.slice(start, end).join('');
}

/** Mirror Python str[:n] on code points. */
function _sliceCodepoints(s: string, n: number): string {
    return Array.from(s).slice(0, n).join('');
}

/** Mirror Python str.isspace() for a single char (subset: common whitespace). */
function _isPySpace(ch: string): boolean {
    return /\s/u.test(ch);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    process.exitCode = main();
}
