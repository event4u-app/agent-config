#!/usr/bin/env tsx
/**
 * Single-namespace collision lint (road-to-6.0.0-D Phase 0 Step 4).
 *
 * TypeScript twin of `src/scripts/lint_namespace_collisions.py` (ADR-096,
 * Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY — exit codes
 * (0 no collisions, 1 collision, 3 internal error), stdout/stderr split,
 * byte-identical finding messages, same `iter_all_sources()` scan order,
 * same normalization, same frontmatter `name:` extraction.
 *
 * The 6.0.0-D target keeps skills + rules in one flat shared library and
 * folds commands into a flat hyphenated namespace. For that to be safe,
 * names must be unique within each namespace after normalization (lowercase,
 * `_` -> `-`, `:` -> `-`):
 *
 *   - library = skills ∪ rules (one flat slug space);
 *   - commands = the flat hyphenated command space.
 *
 * A command sharing a name with a skill/rule is NOT a collision — that is
 * the endorsed thin-command pattern.
 *
 * Exit codes: 0 = no collisions · 1 = at least one collision · 3 = internal
 * error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { iter_all_sources } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);

/**
 * Reuse the canonical frontmatter splitter from `condense`. The Python
 * original imports `condense._parse_frontmatter` with a try/except fallback
 * to `None`; `condense` always imports in practice, so the FM splitter is
 * available. Replicated here byte-for-byte (the only consumer is the
 * command-name extraction below).
 */
function _parse_frontmatter(content: string): [Record<string, unknown>, string] {
    if (!content.startsWith('---')) {
        return [{}, content];
    }
    const end = content.indexOf('\n---', 3);
    if (end === -1) {
        return [{}, content];
    }
    const raw = content.slice(3, end).trim();
    const body = _lstripNewlines(content.slice(end + 4));
    let meta: unknown;
    try {
        meta = parseYaml(raw, { version: '1.1' }) ?? {};
    } catch {
        meta = {};
    }
    return [isPlainObject(meta) ? (meta as Record<string, unknown>) : {}, body];
}

function _lstripNewlines(s: string): string {
    let i = 0;
    while (i < s.length && s[i] === '\n') {
        i += 1;
    }
    return s.slice(i);
}

function _normalize(name: string): string {
    return name.trim().toLowerCase().replaceAll('_', '-').replaceAll(':', '-');
}

function _category(rel: string): string | null {
    const top = rel.split('/', 1)[0] as string;
    return top === 'skills' || top === 'rules' || top === 'commands' ? top : null;
}

function _artefact_name(rel: string, p: string, category: string): string {
    if (category === 'skills') {
        return rel.includes('/') ? (rel.split('/')[1] as string) : _stem(rel);
    }
    if (category === 'rules') {
        return _stem(rel);
    }
    // command — prefer frontmatter name, else path slug.
    try {
        const [meta] = _parse_frontmatter(fs.readFileSync(p, 'utf-8'));
        const name = meta['name'];
        if (typeof name === 'string' && name.trim()) {
            return name;
        }
    } catch {
        // OSError / decode error → fall through.
    }
    return _stem(rel);
}

/** Mirror Python `Path(rel).stem` — basename without final extension. */
function _stem(rel: string): string {
    const base = rel.split('/').pop() ?? rel;
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(0, dot) : base;
}

// Which namespace each artefact category belongs to for collision purposes.
const _NAMESPACE: Record<string, string> = {
    skills: 'library',
    rules: 'library',
    commands: 'commands',
};

function main(): number {
    // (namespace\x00normalized name) -> list of [category, logical_rel]
    const seen = new Map<string, Array<[string, string]>>();
    let total = 0;
    for (const [p, rel] of iter_all_sources()) {
        const category = _category(rel);
        if (category === null || !rel.endsWith('.md')) {
            continue;
        }
        if (category === 'skills' && !rel.endsWith('/SKILL.md')) {
            continue; // only the SKILL.md head names a skill
        }
        const name = _normalize(_artefact_name(rel, p, category));
        if (!name) {
            continue;
        }
        total += 1;
        const key = `${_NAMESPACE[category]}\x00${name}`;
        const bucket = seen.get(key);
        if (bucket) {
            bucket.push([category, rel]);
        } else {
            seen.set(key, [[category, rel]]);
        }
    }

    const collisions = [...seen.entries()].filter(([, v]) => v.length > 1);
    if (collisions.length) {
        // sorted(collisions) — by (namespace, name) tuple, which the key
        // encodes as `namespace\x00name`; \x00 sorts before any printable
        // char so namespace-then-name ordering is preserved.
        const sortedKeys = collisions.map(([k]) => k).sort();
        for (const key of sortedKeys) {
            const [namespace, name] = key.split('\x00') as [string, string];
            const bucket = seen.get(key) as Array<[string, string]>;
            const entries = [...bucket]
                .sort(_pairCompare)
                .map(([cat, rel]) => `${cat}:${rel}`)
                .join(', ');
            process.stderr.write(
                `❌  ${namespace} name collision '${name}': ${entries}\n`,
            );
        }
        process.stderr.write(
            `\n${collisions.length} within-namespace name collision(s).\n`,
        );
        return 1;
    }
    process.stdout.write(
        `✅  ${total} skill/rule/command names unique within each namespace (normalized).\n`,
    );
    return 0;
}

/** Mirror Python tuple ordering for [category, rel] pairs. */
function _pairCompare(a: [string, string], b: [string, string]): number {
    if (a[0] !== b[0]) {
        return a[0] < b[0] ? -1 : 1;
    }
    if (a[1] !== b[1]) {
        return a[1] < b[1] ? -1 : 1;
    }
    return 0;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exit(main());
    } catch (e) {
        // Mirror an uncaught Python exception → non-zero. The Python script
        // has no explicit exit-3 wrapper around main(); an exception would
        // surface a traceback + exit 1. Keep parity by exiting 1.
        const msg = e instanceof Error ? (e.stack ?? e.message) : String(e);
        process.stderr.write(msg + '\n');
        process.exit(1);
    }
}

export {
    _normalize,
    _category,
    _artefact_name,
    _NAMESPACE,
    main,
};
