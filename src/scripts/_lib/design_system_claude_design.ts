/**
 * The `claude-design` import lane, snapshot input (road-to-a-canvas-the-code-owns
 * step 3.2).
 *
 * Reads a directory the USER exported from the host's design canvas and maps it
 * into the same `design-system.json` shape the other three lanes produce. The
 * local-bundle input the host's own `/design-sync` writes is a separate half
 * (step 3.2b) and waits on an observed listing of that layout; nothing here
 * guesses it.
 *
 * What a snapshot directory may hold, and where each part goes:
 *
 *   source.json         provenance (`{"source": {kind, ref, captured_at}}`) and an
 *                       optional `maturity`; without it the caller must supply one
 *   *.tokens.json       W3C DTCG tokens, mapped by the `dtcg` lane unchanged
 *   *.css               the custom-property closure: every `--x: value` declared,
 *                       every `var(--x)` resolved through it, every reference with
 *                       no declaration listed in `_meta.unresolved_custom_properties`
 *   *.d.ts              component contracts — an exported capitalised component
 *                       and the keys of its `<Name>Props` type
 *   *.md                guidelines, kept verbatim under `_meta.guidelines`
 *   anything else       listed in `_meta.unmapped`, never dropped
 *
 * **A snapshot is data (step 3.4).** The lane only ever reads bytes as text: it
 * imports no snapshot file, evaluates nothing, follows no symlink and fetches no
 * `@import`. A visual look at snapshot markup goes through the isolated asset
 * renderer, never through this module.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    type ComponentObservation,
    type DesignSystem,
    type ImportOutcome,
    type ProvenanceOverride,
    type SourceBlock,
    importDesignSystem,
} from './design_system_import.js';

/** Files above this size are listed, not read — a snapshot is not a dump. */
const MAX_FILE_BYTES = 1_048_576;
const MAX_DEPTH = 8;

const COLOR_VALUE = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(.*\))$/i;

interface Walked {
    rel: string;
    abs: string;
}

/** Every regular file under `root`, relative and sorted; symlinks are reported, not followed. */
function walk(root: string): { files: Walked[]; skipped: string[] } {
    const files: Walked[] = [];
    const skipped: string[] = [];
    const visit = (dir: string, depth: number): void => {
        for (const name of fs.readdirSync(dir).sort()) {
            const abs = path.join(dir, name);
            const rel = path.relative(root, abs).split(path.sep).join('/');
            const st = fs.lstatSync(abs);
            if (st.isSymbolicLink()) skipped.push(`${rel} (symlink, not followed)`);
            else if (st.isDirectory()) {
                if (depth >= MAX_DEPTH) skipped.push(`${rel}/ (deeper than ${MAX_DEPTH})`);
                else visit(abs, depth + 1);
            } else if (st.isFile()) {
                if (st.size > MAX_FILE_BYTES) skipped.push(`${rel} (over ${MAX_FILE_BYTES} bytes, not read)`);
                else files.push({ rel, abs });
            }
        }
    };
    visit(root, 0);
    return { files, skipped };
}

interface CssClosure {
    light: Map<string, string>;
    dark: Map<string, string>;
    references: Set<string>;
}

/** Collect custom-property declarations, split by the dark-theme context they sit in. */
export function readCustomProperties(css: string, into: CssClosure): void {
    const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const stack: boolean[] = [];
    let selector = '';
    let i = 0;
    while (i < text.length) {
        const ch = text[i] as string;
        if (ch === '{') {
            const parentDark = stack.length > 0 && stack[stack.length - 1] === true;
            stack.push(parentDark || /dark/i.test(selector));
            selector = '';
        } else if (ch === '}') {
            stack.pop();
            selector = '';
        } else if (ch === ';') {
            selector = '';
        } else {
            selector += ch;
            const m = /^\s*(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]*)$/.exec(selector);
            const next = text[i + 1];
            if (m !== null && (next === ';' || next === '}')) {
                const dark = stack.length > 0 && stack[stack.length - 1] === true;
                (dark ? into.dark : into.light).set(m[1] as string, (m[2] as string).trim());
            }
        }
        i += 1;
    }
    for (const m of text.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) into.references.add(m[1] as string);
}

/** Resolve `var()` chains; a cycle or a missing declaration is reported, never invented. */
function resolveVar(
    value: string,
    defs: Map<string, string>,
    seen: Set<string>,
): { value: string; cyclic: boolean; missing: boolean } {
    const m = /^var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*(.*))?\)$/.exec(value.trim());
    if (m === null) return { value, cyclic: false, missing: false };
    const ref = m[1] as string;
    if (seen.has(ref)) return { value, cyclic: true, missing: false };
    const target = defs.get(ref);
    if (target === undefined) {
        return m[2] !== undefined ? { value: m[2].trim(), cyclic: false, missing: true } : { value, cyclic: false, missing: true };
    }
    return resolveVar(target, defs, new Set([...seen, ref]));
}

type Bucket = 'color' | 'radius' | 'shadow' | 'spacing' | 'font' | 'duration' | 'easing';

function bucketOf(name: string, value: string): { bucket: Bucket; role: string } | null {
    const bare = name.replace(/^--/, '');
    const rules: Array<[RegExp, Bucket]> = [
        [/^(color|colour)-/, 'color'],
        [/^radius-|^rounded-/, 'radius'],
        [/^shadow-|^elevation-/, 'shadow'],
        [/^(space|spacing)-/, 'spacing'],
        [/^font-(family-)?/, 'font'],
        [/^duration-/, 'duration'],
        [/^(ease|easing)-/, 'easing'],
    ];
    for (const [re, bucket] of rules) {
        if (re.test(bare)) return { bucket, role: bare.replace(re, '') || bare };
    }
    if (COLOR_VALUE.test(value)) return { bucket: 'color', role: bare };
    return null;
}

/** Component contracts from a `.d.ts`: capitalised exports and their `<Name>Props` keys. */
export function readComponentContracts(dts: string): ComponentObservation[] {
    const names = new Set<string>();
    for (const m of dts.matchAll(/export\s+(?:declare\s+)?(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/g)) {
        names.add(m[1] as string);
    }
    const out: ComponentObservation[] = [];
    for (const name of [...names].sort()) {
        const body = new RegExp(`(?:interface|type)\\s+${name}Props\\b[^{]*\\{([\\s\\S]*?)\\n\\}`).exec(dts);
        const props =
            body === null
                ? []
                : [...(body[1] as string).matchAll(/^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/gm)].map((p) => p[1] as string);
        out.push({ name, observed: { props: [...new Set(props)].sort() } });
    }
    return out;
}

function readSourceJson(raw: string): { source?: SourceBlock; maturity?: string } {
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const s = parsed['source'] as Record<string, unknown> | undefined;
        const out: { source?: SourceBlock; maturity?: string } = {};
        if (s && typeof s['ref'] === 'string' && typeof s['kind'] === 'string' && ['url', 'repo', 'dir'].includes(s['kind'])) {
            out.source = {
                kind: s['kind'] as SourceBlock['kind'],
                ref: s['ref'],
                captured_at: typeof s['captured_at'] === 'string' ? s['captured_at'] : 'unknown',
                _meta: { provenance_origin: 'input' },
            };
        }
        if (typeof parsed['maturity'] === 'string') out.maturity = parsed['maturity'];
        return out;
    } catch {
        return {};
    }
}

/** Import a user-exported canvas snapshot directory. Offline; reads text only. */
export function importClaudeDesignSnapshot(dir: string, provenance?: ProvenanceOverride): ImportOutcome {
    let st: fs.Stats;
    try {
        st = fs.statSync(dir);
    } catch {
        return { ok: false, lane: 'claude-design', reason: `claude-design lane rejected — ${dir} does not exist` };
    }
    if (!st.isDirectory()) {
        return { ok: false, lane: 'claude-design', reason: 'claude-design lane rejected — the snapshot input is a directory, not a file' };
    }
    const { files, skipped } = walk(dir);
    const notes: string[] = [];
    const unmapped: string[] = [...skipped];
    const closure: CssClosure = { light: new Map(), dark: new Map(), references: new Set() };
    const components: ComponentObservation[] = [];
    const componentPaths: Record<string, string> = {};
    const guidelines: Array<{ path: string; text: string }> = [];
    let sourceFile: { source?: SourceBlock; maturity?: string } = {};
    let tokens: DesignSystem | null = null;

    for (const f of files) {
        const text = fs.readFileSync(f.abs, 'utf-8');
        if (f.rel === 'source.json') sourceFile = readSourceJson(text);
        else if (f.rel.endsWith('.tokens.json') || path.basename(f.rel) === 'tokens.json') {
            let parsed: unknown = null;
            try {
                parsed = JSON.parse(text);
            } catch {
                unmapped.push(`${f.rel} (not valid JSON)`);
                continue;
            }
            const stub: ProvenanceOverride = { kind: 'dir', ref: dir };
            const r = importDesignSystem(parsed, stub, 'dtcg');
            if (r.ok) tokens = r.design_system;
            else unmapped.push(`${f.rel} (${r.reason})`);
        } else if (f.rel.endsWith('.css')) readCustomProperties(text, closure);
        else if (f.rel.endsWith('.d.ts')) {
            for (const c of readComponentContracts(text)) {
                if (componentPaths[c.name] !== undefined) continue;
                components.push(c);
                componentPaths[c.name] = f.rel;
            }
        } else if (f.rel.endsWith('.md')) guidelines.push({ path: f.rel, text });
        else unmapped.push(f.rel);
    }

    const source: SourceBlock | undefined =
        sourceFile.source ??
        (provenance === undefined
            ? undefined
            : {
                  kind: provenance.kind,
                  ref: provenance.ref,
                  captured_at: provenance.captured_at ?? 'unknown',
                  _meta: { provenance_origin: 'caller' },
              });
    if (source === undefined) {
        return {
            ok: false,
            lane: 'claude-design',
            reason:
                'claude-design lane rejected — no provenance. Add a source.json with {"source": {kind, ref, captured_at}} to the snapshot, or pass --source-kind and --source-ref',
        };
    }

    const out: DesignSystem = { ...(tokens ?? {}), source };
    const meta: Record<string, unknown> = { ...((tokens?._meta as Record<string, unknown> | undefined) ?? {}) };
    if (meta['unmapped'] !== undefined) {
        meta['unmapped_tokens'] = meta['unmapped'];
        delete meta['unmapped'];
    }
    const aliasOf: Record<string, string> = { ...((meta['alias_of'] as Record<string, string> | undefined) ?? {}) };
    const cycles: string[] = [];
    const unresolved = new Set<string>();
    const unmappedProps: Record<string, string> = {};
    const allDefs = new Map([...closure.light, ...closure.dark]);
    for (const ref of closure.references) if (!allDefs.has(ref)) unresolved.add(ref);

    for (const [theme, defs] of [['light', closure.light], ['dark', closure.dark]] as const) {
        const scope = theme === 'dark' ? new Map([...closure.light, ...closure.dark]) : closure.light;
        for (const [name, rawValue] of [...defs].sort(([a], [b]) => a.localeCompare(b))) {
            const r = resolveVar(rawValue, scope, new Set([name]));
            const ref = /^var\(\s*(--[A-Za-z0-9_-]+)/.exec(rawValue.trim());
            if (ref !== null) aliasOf[`css:${name}`] = ref[1] as string;
            if (r.cyclic) cycles.push(`css:${name}`);
            const b = bucketOf(name, r.value);
            if (b === null || r.cyclic || (r.missing && r.value === rawValue)) {
                unmappedProps[name] = rawValue;
                continue;
            }
            const v = r.value;
            if (b.bucket === 'color') {
                out.colors = out.colors ?? {};
                const target = (out.colors[theme] = out.colors[theme] ?? {});
                target[b.role] = v;
            } else if (theme === 'dark') unmappedProps[name] = rawValue;
            else if (b.bucket === 'radius') (out.radius = out.radius ?? {})[b.role] = v;
            else if (b.bucket === 'shadow') (out.shadow = out.shadow ?? {})[b.role] = v;
            else if (b.bucket === 'spacing') (out.spacing = out.spacing ?? { scale: [] }).scale?.push(v);
            else if (b.bucket === 'font') {
                const typography = (out.typography = out.typography ?? {});
                const name0 = (v.split(',')[0] ?? v).trim().replace(/^["']|["']$/g, '');
                (typography.families = typography.families ?? []).push({ role: b.role, name: name0, bundled_local: false });
            } else {
                const motion = (out.motion = out.motion ?? {});
                if (b.bucket === 'duration') (motion.durations = motion.durations ?? {})[b.role] = v;
                else (motion.easings = motion.easings ?? {})[b.role] = v;
            }
        }
    }

    if (components.length > 0) {
        out.components = [...(tokens?.components ?? []), ...components];
        meta['component_paths'] = componentPaths;
    }
    if (Object.keys(aliasOf).length > 0) meta['alias_of'] = aliasOf;
    if (cycles.length > 0) meta['alias_cycles'] = [...new Set([...((meta['alias_cycles'] as string[]) ?? []), ...cycles])].sort();
    if (unresolved.size > 0) {
        meta['unresolved_custom_properties'] = [...unresolved].sort();
        notes.push(
            `${unresolved.size} var() reference(s) name a custom property the snapshot's stylesheets never declare — listed under _meta.unresolved_custom_properties, which fails token fidelity until each is declared or dispositioned`,
        );
    }
    if (Object.keys(unmappedProps).length > 0) meta['unmapped_custom_properties'] = unmappedProps;
    if (guidelines.length > 0) meta['guidelines'] = guidelines;
    if (unmapped.length > 0) {
        meta['unmapped'] = unmapped.sort();
        notes.push(`${unmapped.length} snapshot file(s) are not a token, contract or guideline file — listed under _meta.unmapped, not read as anything`);
    }
    if (sourceFile.maturity !== undefined) meta['maturity'] = sourceFile.maturity;
    if (Object.keys(meta).length > 0) out._meta = meta;
    return { ok: true, lane: 'claude-design', design_system: out, notes };
}
