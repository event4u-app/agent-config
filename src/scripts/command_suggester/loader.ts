/**
 * Read command frontmatter into `CommandSpec` instances.
 *
 * TypeScript twin of `src/scripts/command_suggester/loader.py`
 * (ADR-200 py2ts).
 *
 * Reuses the package's `validate_frontmatter.parse_frontmatter` twin
 * so the loader and the linter agree on what counts as well-formed.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse_frontmatter } from '../validate_frontmatter.js';
import { CommandSpec } from './types.js';

/**
 * Load every `*.md` under `commands_dir` as a `CommandSpec`.
 *
 * Files without a `suggestion` block are loaded as `eligible=false`
 * with empty rationale — keeps tests deterministic on legacy data.
 * Bad frontmatter is skipped silently; the linter is the gate, not
 * this loader.
 *
 * Mirrors `sorted(commands_dir.rglob("*.md"))` with pathlib
 * component-wise ordering so the iteration order is deterministic
 * regardless of OS directory-listing order.
 */
export function load_commands(commands_dir: string): CommandSpec[] {
    const specs: CommandSpec[] = [];
    for (const p of _rglobMdSorted(commands_dir)) {
        // Skip cluster authoring docs — not commands.
        if (path.basename(p) === 'AGENTS.md') {
            continue;
        }
        const text = fs.readFileSync(p, 'utf-8');
        const [data] = parse_frontmatter(text);
        if (data === null) {
            continue;
        }
        // Python: str(data.get("name") or path.stem) — `or` falls back on
        // any falsy value (None, "", 0), not just absent keys.
        const name = String(_pyOr(data.name, _stem(p)));
        const description = String(_pyOr(data.description, ''));
        const spec = _spec_from_data(name, description, data.suggestion);
        specs.push(spec);
    }
    return specs;
}

/** `Path.stem` — basename without its final suffix. */
function _stem(p: string): string {
    const base = path.basename(p);
    const ext = path.extname(base);
    return ext ? base.slice(0, base.length - ext.length) : base;
}

function _spec_from_data(
    name: string,
    description: string,
    suggestion: unknown,
): CommandSpec {
    if (!_isPlainObject(suggestion)) {
        return new CommandSpec({ name, description, eligible: false });
    }
    const eligible = suggestion.eligible === true;
    if (!eligible) {
        return new CommandSpec({
            name,
            description,
            eligible: false,
            rationale: String(_pyOr(suggestion.rationale, '')),
        });
    }
    const floor = suggestion.confidence_floor;
    let floor_f: number | null;
    if (floor === null || floor === undefined) {
        floor_f = null;
    } else {
        const coerced = _pyFloat(floor);
        floor_f = coerced === null ? null : coerced;
    }
    const cooldown = suggestion.cooldown;
    const cooldown_s = cooldown === null || cooldown === undefined ? null : String(cooldown);
    return new CommandSpec({
        name,
        description,
        eligible: true,
        trigger_description: String(_pyOr(suggestion.trigger_description, '')),
        trigger_context: String(_pyOr(suggestion.trigger_context, '')),
        confidence_floor: floor_f,
        cooldown: cooldown_s,
    });
}

/**
 * Mirror of Python `float(value)` for the values YAML can hand us,
 * returning null where Python raises `TypeError` / `ValueError`
 * (the loader catches those and falls back to null).
 *
 *  - number → itself.
 *  - bool   → 1.0 / 0.0 (Python `float(True) == 1.0`).
 *  - string → `float(str)` semantics: leading/trailing whitespace
 *    allowed, otherwise a numeric literal; anything else → null.
 *  - everything else (list, dict, null) → null.
 */
function _pyFloat(value: unknown): number | null {
    if (typeof value === 'boolean') {
        return value ? 1.0 : 0.0;
    }
    if (typeof value === 'number') {
        return Number.isNaN(value) ? value : value;
    }
    if (typeof value === 'string') {
        const s = value.trim();
        if (s === '') {
            return null;
        }
        // Python float() accepts inf/nan/underscores; the suggestion
        // schema never carries those, but mirror the common numeric path.
        const n = Number(s);
        return Number.isNaN(n) ? null : n;
    }
    return null;
}

/**
 * Mirror of Python `value or fallback` — returns `value` when it is
 * truthy by Python rules (not None / False / 0 / "" / [] / {}),
 * otherwise `fallback`.
 */
function _pyOr<T>(value: unknown, fallback: T): unknown | T {
    return _pyTruthy(value) ? value : fallback;
}

/** Python truthiness for the scalar / container values YAML produces. */
function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }
    if (value === 0) {
        return false;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return true;
}

function _isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
    );
}

// --- sorted(rglob("*.md")) with pathlib component-wise ordering ----------

/** `sorted(root.rglob("*.md"))` with pathlib component-wise ordering. */
function _rglobMdSorted(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory() && !e.isSymbolicLink()) {
                walk(full);
            } else if (e.isFile() && e.name.endsWith('.md')) {
                out.push(full);
            }
        }
    };
    walk(root);
    out.sort(_pathCompare);
    return out;
}

function _pathCompare(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i += 1) {
        const x = pa[i] as string;
        const y = pb[i] as string;
        if (x < y) {
            return -1;
        }
        if (x > y) {
            return 1;
        }
    }
    return pa.length - pb.length;
}
