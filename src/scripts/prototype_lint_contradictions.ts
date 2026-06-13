#!/usr/bin/env node
/**
 * Prototype contradiction linter (P1.1 of road-to-package-optimization).
 *
 * TypeScript twin of `src/scripts/prototype_lint_contradictions.py` (ADR-090 —
 * Python→TS migration, Phase 8 / Wave 8g). Mirrors the Python CLI contract
 * EXACTLY — no flags, exit codes (0 clean / 1 contradictions found), the
 * stdout JSON shape (`json.dump(report, indent=2)`, insertion order, NO
 * sort_keys), and the deterministic-after-canonicalization heuristic set.
 *
 * Hard acceptance: must flag >=3 real cross-artifact contradictions in this
 * repo within 5 s wall-clock and < $0.01 cost (deterministic, no LLM calls).
 *
 * `elapsed_seconds` is intrinsically non-deterministic (wall-clock); golden
 * parity excludes it. The TS port reproduces the Python algorithm faithfully
 * so the `flags` / `artifacts_scanned` portions are byte-identical.
 *
 * Heuristic family — two deterministic checks (routing + imperative conflict)
 * across rules, skills, commands, and contexts. No behaviour changes —
 * latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/prototype_lint_contradictions.py → parent.parent.parent == repo root.
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const SRC = path.join(REPO, '.agent-src.uncondensed');

const ARTIFACT_DIRS: Record<string, string> = {
    rule: path.join(SRC, 'rules'),
    skill: path.join(SRC, 'skills'),
    command: path.join(SRC, 'commands'),
    context: path.join(SRC, 'contexts'),
};

// re.compile(r"^---\n(.*?)\n---\n", re.DOTALL) — anchored at start, used with .match.
const FM_RE = /^---\n([\s\S]*?)\n---\n/;
// re.MULTILINE per-line; iterate with finditer.
const ALWAYS_RE = /^[ \t]*(ALWAYS|MUST)[ \t]+([A-Z][^.\n]{2,80})/gm;
const NEVER_RE = /^[ \t]*(NEVER|MUST NOT|DO NOT)[ \t]+([A-Z][^.\n]{2,80})/gm;

interface Artifact {
    kind: string;
    path: string;
    id: string;
    triggers: Set<string>;
    routes: Array<[string, string]>;
    always: string[];
    never: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function _relPosix(p: string): string {
    return path.relative(REPO, p).split(path.sep).join('/');
}

function _findAll(re: RegExp, text: string): RegExpMatchArray[] {
    // re must be global. Mirror Python re.findall / finditer enumeration.
    const out: RegExpMatchArray[] = [];
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = r.exec(text)) !== null) {
        out.push(m);
        if (m.index === r.lastIndex) {
            r.lastIndex++;
        }
    }
    return out;
}

function parseArtifact(p: string, kind: string): Artifact {
    // read_text(errors="replace"): Node decodes UTF-8 with U+FFFD on bad bytes.
    const text = fs.readFileSync(p).toString('utf-8');
    const fm: Record<string, string> = {};
    const m = FM_RE.exec(text);
    let body = text;
    if (m) {
        body = text.slice(m[0].length);
        for (const line of m[1]!.split('\n')) {
            // `if ":" in line and not line.startswith(" ")`
            if (line.includes(':') && !line.startsWith(' ')) {
                const idx = line.indexOf(':');
                const k = line.slice(0, idx);
                const v = line.slice(idx + 1);
                fm[k.trim()] = v.trim();
            }
        }
    }
    // re.findall(r"`([a-z][a-z0-9_-]+)`", description)
    const triggers = _findAll(/`([a-z][a-z0-9_-]+)`/g, fm.description ?? '').map((mm) => mm[1] as string);
    // re.findall(r"(skill|rule|command):([a-z0-9_-]+)", routes_to)
    const routes = _findAll(/(skill|rule|command):([a-z0-9_-]+)/g, fm.routes_to ?? '').map(
        (mm) => [mm[1] as string, mm[2] as string] as [string, string],
    );
    const always = _findAll(ALWAYS_RE, body).map((mm) => (mm[2] as string).trim());
    const never = _findAll(NEVER_RE, body).map((mm) => (mm[2] as string).trim());
    const base = path.basename(p);
    const id = base !== 'SKILL.md' ? base.replace(/\.[^.]*$/, '') : path.basename(path.dirname(p));
    return {
        kind,
        path: _relPosix(p),
        id,
        triggers: new Set(triggers),
        routes,
        always,
        never,
    };
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** rglob("*.md") — recursive, sorted to make collection deterministic. */
function _rglobMd(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        // Python rglob order is filesystem-order (non-deterministic across
        // platforms). The collected artifacts feed an order-independent
        // by_id map and a by_trigger map, but the FLAGS list order depends on
        // iteration. Sort to canonicalize so python3 vs tsx golden-parity holds.
        const names = entries.map((e) => e.name).sort();
        const byName = new Map(entries.map((e) => [e.name, e]));
        for (const name of names) {
            const e = byName.get(name)!;
            const full = path.join(dir, name);
            if (e.isDirectory()) {
                walk(full);
            } else if (e.isFile() && name.endsWith('.md')) {
                out.push(full);
            }
        }
    };
    walk(root);
    return out;
}

function collect(): Artifact[] {
    const out: Artifact[] = [];
    for (const kind of Object.keys(ARTIFACT_DIRS)) {
        const root = ARTIFACT_DIRS[kind] as string;
        if (!_isDir(root)) {
            continue;
        }
        for (const p of _rglobMd(root)) {
            const name = path.basename(p);
            if (name === 'README.md' || name === 'INDEX.md') {
                continue;
            }
            out.push(parseArtifact(p, kind));
        }
    }
    return out;
}

function checkRouting(arts: Artifact[]): Json[] {
    const byId = new Map<string, Artifact>();
    for (const a of arts) {
        byId.set(`${a.kind} ${a.id}`, a);
    }
    const flags: Json[] = [];
    for (const a of arts) {
        for (const [tgtKind, tgtId] of a.routes) {
            if (!byId.has(`${tgtKind} ${tgtId}`)) {
                flags.push({
                    type: 'routing_mismatch',
                    artifact_a: a.path,
                    artifact_b: `${tgtKind}:${tgtId} (missing)`,
                    evidence: `${a.id} routes_to ${tgtKind}:${tgtId}, target not found`,
                });
            }
        }
    }
    return flags;
}

function normalizeVerb(s: string): string {
    // re.sub(r"[^a-z ]+", "", s.lower()).split(" ", 1)[0] if s else ""
    if (!s) {
        return '';
    }
    const cleaned = s.toLowerCase().replace(/[^a-z ]+/g, '');
    // split(" ", 1)[0] → text up to the first space (or whole string).
    const sp = cleaned.indexOf(' ');
    return sp === -1 ? cleaned : cleaned.slice(0, sp);
}

function checkImperativeConflict(arts: Artifact[]): Json[] {
    const flags: Json[] = [];
    // dict insertion order — first-seen trigger order across arts/triggers.
    const byTrigger = new Map<string, Artifact[]>();
    for (const a of arts) {
        // Python iterates a python `set` (a["triggers"]) — order is hash-based
        // and non-deterministic. Sort each artifact's triggers so the
        // by_trigger insertion order (and thus flag order) is canonical.
        for (const t of [...a.triggers].sort()) {
            if (!byTrigger.has(t)) {
                byTrigger.set(t, []);
            }
            byTrigger.get(t)!.push(a);
        }
    }
    for (const [trigger, group] of byTrigger) {
        if (group.length < 2) {
            continue;
        }
        for (let i = 0; i < group.length; i++) {
            const a = group[i] as Artifact;
            for (const b of group.slice(i + 1)) {
                const aVerbs = new Set(a.always.map(normalizeVerb));
                const bVerbs = new Set(b.never.map(normalizeVerb));
                // (a_verbs & b_verbs) - {""}
                const conflict = [...aVerbs].filter((v) => bVerbs.has(v) && v !== '');
                if (conflict.length > 0) {
                    const sorted = [...conflict].sort();
                    flags.push({
                        type: 'imperative_conflict',
                        artifact_a: a.path,
                        artifact_b: b.path,
                        evidence:
                            `shared trigger '${trigger}', a says ALWAYS ${_pyList(sorted)}, ` +
                            `b says NEVER ${_pyList(sorted)}`,
                    });
                }
            }
        }
    }
    return flags;
}

/** Python `str(sorted(...))` repr for a list of strings: ['a', 'b']. */
function _pyList(items: string[]): string {
    return `[${items.map((s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(', ')}]`;
}

// --- json.dumps(indent=2) emulation (ensure_ascii=True, NO sort_keys) -------

function _pyJsonStr(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return out + '"';
}

function _dumps(obj: Json, level = 0): string {
    if (obj === null || obj === undefined) {
        return 'null';
    }
    if (obj === true) {
        return 'true';
    }
    if (obj === false) {
        return 'false';
    }
    if (typeof obj === 'number') {
        return String(obj);
    }
    if (typeof obj === 'string') {
        return _pyJsonStr(obj);
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        const pad = ' '.repeat(2 * (level + 1));
        const closePad = ' '.repeat(2 * level);
        return `[\n${obj.map((v) => pad + _dumps(v, level + 1)).join(',\n')}\n${closePad}]`;
    }
    const keys = Object.keys(obj as Record<string, Json>);
    if (keys.length === 0) {
        return '{}';
    }
    const pad = ' '.repeat(2 * (level + 1));
    const closePad = ' '.repeat(2 * level);
    const parts = keys.map((k) => `${pad}${_pyJsonStr(k)}: ${_dumps((obj as Record<string, Json>)[k], level + 1)}`);
    return `{\n${parts.join(',\n')}\n${closePad}}`;
}

/** Python round(x, 3) — round-half-to-even (banker's rounding). */
function _round3(x: number): number {
    const f = 1000;
    const scaled = x * f;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let r: number;
    if (diff > 0.5) {
        r = floor + 1;
    } else if (diff < 0.5) {
        r = floor;
    } else {
        r = floor % 2 === 0 ? floor : floor + 1;
    }
    return r / f;
}

export function main(): number {
    const t0 = process.hrtime.bigint();
    const arts = collect();
    const flags = [...checkRouting(arts), ...checkImperativeConflict(arts)];
    const elapsed = Number(process.hrtime.bigint() - t0) / 1e9;
    const report = {
        artifacts_scanned: arts.length,
        elapsed_seconds: new FloatTag(_round3(elapsed)),
        flags,
        acceptance: {
            min_flags: 3,
            max_seconds: new FloatTag(5.0),
            passed: flags.length >= 3 && elapsed < 5.0,
        },
    };
    process.stdout.write(_dumpsWithFloats(report));
    process.stdout.write('\n');
    return flags.length === 0 ? 0 : 1;
}

/** Marker so the serializer emits a Python-float repr (".0" for wholes). */
class FloatTag {
    constructor(public readonly value: number) {}
}

function _floatStr(n: number): string {
    if (Number.isInteger(n)) {
        return `${n}.0`;
    }
    return String(n);
}

/** json.dumps(indent=2) with FloatTag → Python-float repr. */
function _dumpsWithFloats(obj: Json, level = 0): string {
    if (obj instanceof FloatTag) {
        return _floatStr(obj.value);
    }
    if (obj === null || obj === undefined) {
        return 'null';
    }
    if (obj === true) {
        return 'true';
    }
    if (obj === false) {
        return 'false';
    }
    if (typeof obj === 'number') {
        return String(obj);
    }
    if (typeof obj === 'string') {
        return _pyJsonStr(obj);
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        const pad = ' '.repeat(2 * (level + 1));
        const closePad = ' '.repeat(2 * level);
        return `[\n${obj.map((v) => pad + _dumpsWithFloats(v, level + 1)).join(',\n')}\n${closePad}]`;
    }
    const keys = Object.keys(obj as Record<string, Json>);
    if (keys.length === 0) {
        return '{}';
    }
    const pad = ' '.repeat(2 * (level + 1));
    const closePad = ' '.repeat(2 * level);
    const parts = keys.map(
        (k) => `${pad}${_pyJsonStr(k)}: ${_dumpsWithFloats((obj as Record<string, Json>)[k], level + 1)}`,
    );
    return `{\n${parts.join(',\n')}\n${closePad}}`;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    process.exitCode = main();
}

export { _dumps, collect, parseArtifact };
