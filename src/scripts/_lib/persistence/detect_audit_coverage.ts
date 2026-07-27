/**
 * SPIKE S0.4 — audit-coverage detection (F8 "missing audit history",
 * rule R-B1, tier: gate) for the persistence-lint substrate.
 * Falsification question (agents/roadmaps/archive/road-to-scale-and-history-discipline.md):
 * given a DECLARED audit scope (audit-scope.json listing audit-scoped models),
 * can mutation call sites lacking audit emission be detected deterministically?
 * PASS bar: recall >= 0.9 at precision >= 0.8 against the labeled fixture repo.
 *
 * Tier-1 (Laravel-flavored) coverage model:
 *   (a) model — or an ancestor — uses a recognized auditing trait
 *       (OwenIt\Auditing\Auditable, Spatie\Activitylog\Traits\LogsActivity,
 *        or a project-local `Auditable` trait);
 *   (b) a REGISTERED observer (Model::observe(...) in a provider, or
 *       #[ObservedBy(...)] on the model) whose class writes an audit record;
 *   (c) an explicit inline audit write (AuditLog::create / activity())
 *       in the same function as the mutation.
 *
 * Event semantics matter: mass mutations (Model::query()->update/delete,
 * DB::table(...)->update/insert/delete) bypass Eloquent model events, so
 * mechanisms (a)/(b) do NOT cover them — only (c) does. Event-firing
 * mutations (::create, ->save, ->update, ->delete, ::destroy) are covered
 * by any of (a)/(b)/(c).
 *
 * Deterministic PATTERN detection (see types.ts): regex + brace-scope
 * heuristics, no PHP AST. Variable→model resolution is heuristic
 * (type hints, `$x = Model::…` / `new Model` assignments, then the
 * `$invoice` → `Invoice` naming convention); unresolvable receivers are
 * skipped rather than guessed, biasing toward precision.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Finding } from './types.ts';

export interface AuditScope {
    audit_scoped_models: string[];
}

export interface AuditCoverageResult {
    findings: Finding[];
    mutations_total: number;
    covered: number;
    uncovered: number;
}

interface ModelInfo {
    name: string;
    file: string;
    extends_class: string | null;
    body_traits: string[]; // resolved (full) trait names used in the class body
    observed_by: string[]; // observer class short names from #[ObservedBy]
    table: string; // explicit $table or snake_case+'s' convention
}

interface FunctionSpan {
    name: string;
    start: number; // 0-indexed line of the `function` keyword
    end: number; // 0-indexed line of the closing brace
    signature: string;
}

const AUDIT_TRAIT_FULL = new Set([
    'OwenIt\\Auditing\\Auditable',
    'Spatie\\Activitylog\\Traits\\LogsActivity',
]);
const AUDIT_TRAIT_SHORT = new Set(['Auditable', 'LogsActivity']);
const INLINE_AUDIT_RE = /\bAuditLog::create\s*\(|\bactivity\s*\(\s*\)/;

// ---------------------------------------------------------------- helpers

function list_php_files(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string): void => {
        for (const entry of readdirSync(d)) {
            const full = join(d, entry);
            let st;
            try {
                st = statSync(full); // broken symlinks must not crash the walk
            } catch {
                continue;
            }
            if (st.isDirectory()) {
                if (entry === 'vendor' || entry === 'node_modules' || entry.startsWith('.')) continue;
                walk(full);
            } else if (entry.endsWith('.php')) {
                out.push(full);
            }
        }
    };
    walk(dir);
    return out;
}

/** Map of short name -> fully-qualified name from top-of-file `use` imports. */
function parse_imports(lines: string[], class_line: number): Map<string, string> {
    const imports = new Map<string, string>();
    for (let i = 0; i < class_line; i++) {
        const m = lines[i]!.match(/^\s*use\s+([\w\\]+)(?:\s+as\s+(\w+))?\s*;/);
        if (!m) continue;
        const full = m[1]!;
        const short = m[2] ?? full.split('\\').pop()!;
        imports.set(short, full);
    }
    return imports;
}

function snake_case(name: string): string {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/** Naive Laravel table convention: snake_case + 's' (fixture-sufficient). */
function default_table(model: string): string {
    return `${snake_case(model)}s`;
}

/** Brace-tracked function spans (regex-level; fixture PHP is simple). */
function parse_function_spans(lines: string[]): FunctionSpan[] {
    const spans: FunctionSpan[] = [];
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i]!.match(/\bfunction\s+(\w+)\s*\(/);
        if (!m) continue;
        // Find the opening brace, then track depth to the matching close.
        let depth = 0;
        let started = false;
        let end = lines.length - 1;
        outer: for (let j = i; j < lines.length; j++) {
            for (const ch of lines[j]!) {
                if (ch === '{') {
                    depth++;
                    started = true;
                } else if (ch === '}') {
                    depth--;
                    if (started && depth === 0) {
                        end = j;
                        break outer;
                    }
                }
            }
        }
        spans.push({ name: m[1]!, start: i, end, signature: lines[i]! });
    }
    return spans;
}

function enclosing_span(spans: FunctionSpan[], line0: number): FunctionSpan | null {
    // Innermost span containing the line (closures nest inside methods).
    let best: FunctionSpan | null = null;
    for (const s of spans) {
        if (line0 >= s.start && line0 <= s.end) {
            if (!best || s.start > best.start) best = s;
        }
    }
    return best;
}

// ---------------------------------------------------------------- model map

function parse_models(dir: string): Map<string, ModelInfo> {
    const models = new Map<string, ModelInfo>();
    const models_dir = join(dir, 'app', 'Models');
    let files: string[] = [];
    try {
        files = list_php_files(models_dir);
    } catch {
        return models;
    }
    for (const file of files) {
        const lines = readFileSync(file, 'utf8').split('\n');
        let class_line = -1;
        let name = '';
        let extends_class: string | null = null;
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i]!.match(/^\s*(?:abstract\s+|final\s+)?class\s+(\w+)(?:\s+extends\s+([\w\\]+))?/);
            if (m) {
                class_line = i;
                name = m[1]!;
                extends_class = m[2] ? m[2].split('\\').pop()! : null;
                break;
            }
        }
        if (class_line < 0) continue;
        const imports = parse_imports(lines, class_line);

        // Trait uses inside the class body.
        const body_traits: string[] = [];
        for (let i = class_line + 1; i < lines.length; i++) {
            const m = lines[i]!.match(/^\s*use\s+([\w\\,\s]+);/);
            if (!m) continue;
            for (const raw of m[1]!.split(',')) {
                const short = raw.trim().split('\\').pop()!;
                body_traits.push(imports.get(raw.trim()) ?? imports.get(short) ?? raw.trim());
            }
        }

        // #[ObservedBy(FooObserver::class)] attribute (may list several).
        const observed_by: string[] = [];
        for (let i = 0; i < class_line; i++) {
            const attr = lines[i]!.match(/#\[\s*ObservedBy\s*\(([^)]*)\)\s*\]/);
            if (!attr) continue;
            for (const cm of attr[1]!.matchAll(/([\w\\]+)::class/g)) {
                observed_by.push(cm[1]!.split('\\').pop()!);
            }
        }

        // Explicit $table override, else convention.
        let table = default_table(name);
        const tm = lines.join('\n').match(/protected\s+\$table\s*=\s*['"](\w+)['"]/);
        if (tm) table = tm[1]!;

        models.set(name, { name, file, extends_class, body_traits, observed_by, table });
    }
    return models;
}

/** Mechanism (a): recognized auditing trait on the model or any ancestor. */
function has_audit_trait(model: string, models: Map<string, ModelInfo>, seen = new Set<string>()): boolean {
    if (seen.has(model)) return false;
    seen.add(model);
    const info = models.get(model);
    if (!info) return false;
    for (const t of info.body_traits) {
        if (AUDIT_TRAIT_FULL.has(t)) return true;
        if (AUDIT_TRAIT_SHORT.has(t.split('\\').pop()!)) return true;
    }
    if (info.extends_class) return has_audit_trait(info.extends_class, models, seen);
    return false;
}

// ------------------------------------------------------------ observer map

/** Observer registrations: Model::observe(FooObserver::class) in providers. */
function parse_provider_registrations(dir: string): Map<string, string[]> {
    const reg = new Map<string, string[]>();
    let files: string[] = [];
    try {
        files = list_php_files(join(dir, 'app', 'Providers'));
    } catch {
        return reg;
    }
    for (const file of files) {
        const src = readFileSync(file, 'utf8');
        for (const m of src.matchAll(/(\w+)::observe\s*\(\s*([\w\\]+)::class\s*\)/g)) {
            const model = m[1]!;
            const observer = m[2]!.split('\\').pop()!;
            reg.set(model, [...(reg.get(model) ?? []), observer]);
        }
    }
    return reg;
}

/** Does the observer class file write an audit record anywhere? */
function observer_emits_audit(dir: string, observer: string): boolean {
    const file = join(dir, 'app', 'Observers', `${observer}.php`);
    try {
        const src = readFileSync(file, 'utf8');
        // Require lifecycle hooks AND an audit write.
        const has_hook = /function\s+(created|updated|deleted|saved)\s*\(/.test(src);
        return has_hook && INLINE_AUDIT_RE.test(src);
    } catch {
        return false;
    }
}

// ---------------------------------------------------------- mutation sites

interface MutationSite {
    file: string; // absolute
    line0: number;
    model: string;
    kind: 'event' | 'mass'; // 'mass' bypasses model events
    snippet: string;
}

const RECEIVER_BLOCKLIST = new Set(['this', 'request', 'query', 'response']);

function resolve_receiver(
    varname: string,
    lines: string[],
    span: FunctionSpan | null,
    line0: number,
    known_models: Set<string>,
): string | null {
    const start = span ? span.start : 0;
    // 1. Parameter type hint in the enclosing signature: `Invoice $invoice`.
    if (span) {
        const sig = span.signature.match(new RegExp(String.raw`(\w+)\s+\$${varname}\b`));
        if (sig && sig[1] && known_models.has(sig[1])) return sig[1];
    }
    // 2. Assignment earlier in the function: `$x = Model::…` / `$x = new Model`.
    for (let i = line0; i >= start; i--) {
        const a = lines[i]!.match(new RegExp(String.raw`\$${varname}\s*=\s*(?:new\s+)?(\w+)(?:::|\s*\()`));
        if (a && a[1] && known_models.has(a[1])) return a[1];
    }
    // 3. Naming convention: $invoice -> Invoice, $auditLog -> AuditLog.
    const conv = varname.charAt(0).toUpperCase() + varname.slice(1);
    if (known_models.has(conv)) return conv;
    return null;
}

function scan_mutations(dir: string, models: Map<string, ModelInfo>): MutationSite[] {
    const sites: MutationSite[] = [];
    const known = new Set(models.keys());
    const table_to_model = new Map<string, string>();
    for (const m of models.values()) table_to_model.set(m.table, m.name);

    // Model/trait/observer internals emit TO the audit sink; scanning them is
    // harmless (AuditLog is never audit-scoped) but Traits register closures
    // that would resolve oddly — scan everything under app/ and let scoping
    // plus receiver resolution filter.
    const files = list_php_files(join(dir, 'app'));
    for (const file of files) {
        const lines = readFileSync(file, 'utf8').split('\n');
        const spans = parse_function_spans(lines);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!;
            if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue; // pure comment lines

            // (1) DB::table('x')->…->update/insert/delete(…)  [mass]
            const db = line.match(/DB::table\s*\(\s*['"](\w+)['"]\s*\)[^;]*->\s*(update|insert|delete|upsert)\s*\(/);
            if (db) {
                const model = table_to_model.get(db[1]!);
                if (model) sites.push({ file, line0: i, model, kind: 'mass', snippet: line.trim() });
                continue;
            }

            // (2) Model::query()->…->update/delete(…)  [mass]
            const massq = line.match(/(\w+)::query\s*\(\s*\)[^;]*->\s*(update|delete)\s*\(/);
            if (massq && massq[1] && known.has(massq[1])) {
                sites.push({ file, line0: i, model: massq[1], kind: 'mass', snippet: line.trim() });
                continue;
            }

            // (3) Model::create(…) / Model::destroy(…)  [event-firing]
            const stat = line.match(/(\w+)::(create|destroy|forceCreate)\s*\(/);
            if (stat && stat[1] && known.has(stat[1]) && stat[1] !== 'AuditLog') {
                sites.push({ file, line0: i, model: stat[1], kind: 'event', snippet: line.trim() });
                continue;
            }

            // (4) $var->save()/update()/delete()  [event-firing]
            const inst = line.match(/\$(\w+)->(save|update|delete|forceDelete)\s*\(/);
            if (inst && inst[1] && !RECEIVER_BLOCKLIST.has(inst[1])) {
                const span = enclosing_span(spans, i);
                const model = resolve_receiver(inst[1], lines, span, i, known);
                if (model && model !== 'AuditLog') {
                    sites.push({ file, line0: i, model, kind: 'event', snippet: line.trim() });
                }
            }
        }
    }
    return sites;
}

// ---------------------------------------------------------------- analyze

export function analyze_repo(dir: string, scope: AuditScope): AuditCoverageResult {
    const scoped = new Set(scope.audit_scoped_models);
    const models = parse_models(dir);
    const registrations = parse_provider_registrations(dir);
    const sites = scan_mutations(dir, models);

    // Per-model event coverage: trait (a) or registered audit-emitting observer (b).
    const event_covered = new Map<string, boolean>();
    for (const name of models.keys()) {
        let cov = has_audit_trait(name, models);
        if (!cov) {
            const observers = [
                ...(registrations.get(name) ?? []),
                ...(models.get(name)?.observed_by ?? []),
            ];
            cov = observers.some((o) => observer_emits_audit(dir, o));
        }
        event_covered.set(name, cov);
    }

    const findings: Finding[] = [];
    let mutations_total = 0;
    let covered = 0;

    for (const site of sites) {
        if (!scoped.has(site.model)) continue; // out of declared audit scope
        mutations_total++;

        let is_covered = false;
        if (site.kind === 'event' && event_covered.get(site.model)) {
            is_covered = true;
        } else {
            // Mechanism (c): inline audit write in the same function.
            const lines = readFileSync(site.file, 'utf8').split('\n');
            const spans = parse_function_spans(lines);
            const span = enclosing_span(spans, site.line0);
            const from = span ? span.start : 0;
            const to = span ? span.end : lines.length - 1;
            for (let i = from; i <= to; i++) {
                if (i === site.line0) continue; // the mutation itself
                if (INLINE_AUDIT_RE.test(lines[i]!)) {
                    is_covered = true;
                    break;
                }
            }
        }

        if (is_covered) {
            covered++;
            continue;
        }
        const why =
            site.kind === 'mass'
                ? 'mass mutation bypasses model events; no inline audit write in the same function'
                : 'model has no auditing trait, no registered audit-emitting observer, and no inline audit write';
        findings.push({
            failure_class: 'F8',
            rule: 'R-B1',
            file: relative(dir, site.file),
            line: site.line0 + 1,
            message: `Mutation on audit-scoped model ${site.model} lacks audit emission (${why}): ${site.snippet.slice(0, 120)}`,
            tier: 'gate',
        });
    }

    return { findings, mutations_total, covered, uncovered: findings.length };
}
