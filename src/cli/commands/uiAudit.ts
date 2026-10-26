/**
 * `agent-config ui:audit <path>` — inventory a UI tree into an artefact.
 *
 * Step E2.1 of `road-to-frontend-power`. Before this command, `state.ui_audit`
 * existed only inside the work-engine dispatcher, which is why
 * `src/rules/ui-audit-gate.md` shipped `enforced_by: none`: a chat session had
 * nothing to point at, and "I ran the audit" is self-report. This writes the
 * artefact a gate can read.
 *
 * CLASS A per `docs/decisions/ADR-124` and `docs/contracts/no-runtime-boundary.md`:
 * it terminates, and its whole state is one rebuildable JSON file under
 * `agents/runtime/state/`. Deleting the artefact changes only speed — the next
 * invocation reproduces it. No process survives the command.
 *
 * The output shape is the one the work engine already expects for
 * `state.ui_audit` (`components_found`, `greenfield`, `audit_path`), so the
 * dispatcher and a chat session read the same object rather than two dialects.
 * `COVERAGE_BUCKETS` is imported from the engine rather than re-listed here:
 * `fe-design` step 3 already had a copied vocabulary, and a second copy is how
 * the two drift.
 *
 * Deliberately NOT a design opinion. This command reports what exists. Whether
 * what exists is good is `design-review`'s job, and mixing the two would make
 * the artefact's meaning depend on taste.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { buildControlRoles, type BoxMetrics, type ControlRole, type RoleEntry } from '../../scripts/_lib/control_roles.js';
import { isUiPath, isUiTreePath } from '../../scripts/_lib/ui_surface.js';

/**
 * The engine's coverage vocabulary, declared here rather than re-exported.
 *
 * A re-export from `agent-src/templates/scripts/work_engine/...` was tried
 * first and reverted: it creates a RUNTIME edge from the shipped CLI into the
 * work-engine TEMPLATE tree, which is projected to consumers rather than
 * compiled into `dist/cli`. The published bundle then fails to resolve it at
 * import time — caught by `agent-config roadmap:progress` throwing
 * ERR_MODULE_NOT_FOUND on a clean tree.
 *
 * The one-vocabulary guarantee survives without the edge: `uiAudit.test.ts`
 * reads the engine's own `apply.ts` and asserts this array equals it, so drift
 * is a red test rather than two copies quietly diverging. A test-time read into
 * the template tree is fine — the tests already read it; a runtime import is
 * not.
 */
export const COVERAGE_BUCKETS: readonly string[] = ['honoured', 'translated', 'flagged'];

export const ARTEFACT_REL = path.join('agents', 'runtime', 'state', 'ui-audit.json');

/**
 * The audit `kind` vocabulary — ONE definition, and the source the skill is
 * tested against rather than a second hand-written list.
 *
 * Canonicalised 2026-08-26 (road-to-component-granularity-vocabulary 0.1). The
 * skill declared `page | partial | component | layout` and the code emitted
 * `component | view | style | page`; only two values were common, so an audit
 * artefact written by the code was being read against a contract it did not
 * satisfy. AI council 2/2: the emitted schema is authoritative for
 * compatibility, one seat adding the refinement that the enum should live in a
 * single module the producer, the consumer and the doc-conformance test all
 * depend on — which is what this constant is.
 *
 * `partial` and `layout` are NOT adopted. Both sound like they mean something,
 * and neither has an operational definition anyone could test: measured against
 * a real tree, there is no line. Adding them would replace two undocumented
 * values with two speculative ones.
 *
 * `view` IS retained, against both council seats' recommendation, because the
 * premise they were given is false. The roadmap records `view` as "0 in any JS
 * tree" and both seats read that as zero-yield. Measured on this repository
 * 2026-08-26: **`view` = 2**, on
 * `tests/eval/frontend-corpus/cases/blade-view/…` and
 * `…/livewire-flux/…`. It is the BLADE branch. "Zero in a JS tree" is true of it
 * the way "zero cats in a dog show" is true — the instrument was pointed at the
 * wrong corpus. Removing it would have deleted this suite's only Laravel
 * classification.
 */
export const AUDIT_KINDS = ['component', 'view', 'style', 'page'] as const;

export type AuditKind = (typeof AUDIT_KINDS)[number];

export interface ComponentEntry {
    path: string;
    kind: AuditKind;
    exports: string[];
}
export interface DesignSystemMarker {
    marker: string;
    path: string;
}
export interface StaleEntry {
    document: string;
    token: string;
    reason: string;
}

export interface UiAuditArtefact {
    schema: 1;
    generated_at: string;
    root: string;
    components_found: ComponentEntry[];
    tokens: string[];
    primitives: string[];
    design_system_markers: DesignSystemMarker[];
    greenfield: boolean;
    audit_path: 'greenfield' | 'high_confidence' | 'ambiguous';
    context_stale: StaleEntry[];
    /**
     * Why `audit_path` came out the way it did. Present because running the
     * command on the corpus showed the previous single heuristic (>=3 tokens or
     * a system marker) calling `no-design-md-coherent-incumbent` ambiguous —
     * that case declares no CSS custom properties at all and is coherent by
     * naming and by a single type family. A1.3 consumes `coherent`, so a silent
     * false negative here becomes a wrong `change_intent` downstream.
     */
    coherence_signals: string[];
    /**
     * Which implementation IS each interactive control in this project, how often
     * it is used, where it is not, and the box metrics a new one copies. Additive
     * (road-to-a-control-that-matches-its-neighbours 2.1/2.2); `schema` stays 1.
     */
    control_roles: Partial<Record<ControlRole, RoleEntry>>;
    /**
     * What the artefact was computed from. A consumer that sees a different HEAD
     * or a different digest over the same UI files recomputes before use (2.3).
     */
    stamp: { head: string | null; inputs_digest: string; files: number };
    verification: 'verified' | 'degraded';
    degradation_reason?: string;
}

/**
 * Files that mark an adopted design system, and the marker each implies.
 *
 * The `shadcn` row is a FALLBACK, not the detector. shadcn's own
 * `components.json` declares where its primitives live under `aliases.ui`, and a
 * project that points that alias anywhere other than `components/ui/` was
 * reported as having no design system at all. Read the declaration first — see
 * `shadcnUiDirs` — and keep this pattern for the case where `components.json`
 * is absent or unreadable.
 */
const SYSTEM_MARKERS: ReadonlyArray<readonly [RegExp, string]> = [
    [/components\/ui\/[a-z-]+\.tsx?$/i, 'shadcn'],
    [/\btailwind\.config\.[cm]?[jt]s$/i, 'tailwind'],
    [/\bDESIGN\.md$/, 'design-md'],
    [/\bPRODUCT\.md$/, 'product-md'],
    [/\btokens\.json$/, 'dtcg-tokens'],
    [/\btokens\.css$/, 'css-tokens'],
];

const TOKEN_DECL = /(--[a-z0-9][a-z0-9-]*)\s*:/gi;
const FONT_FAMILY_DECL = /font-family\s*:\s*([^;}"'\n]*(?:"[^"]*"|'[^']*')?[^;}\n]*)/gi;
const JSX_EXPORT = /export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/g;

function walk(root: string, out: string[] = [], depth = 0): string[] {
    if (depth > 12) return out;
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
        const p = path.join(root, e.name);
        if (e.isDirectory()) walk(p, out, depth + 1);
        else out.push(p);
    }
    return out;
}

/**
 * True when a module's body is re-exports and nothing else — a barrel.
 *
 * `index.[jt]sx?` is one of the page markers, and a barrel is the commonest
 * thing to call `index`. Reproduced 2026-08-26: `src/ui/components/index.tsx`
 * containing two `export { X } from './X'` lines classified as `page`, which is
 * wrong in a way that matters — `page` is what the `audit_path` branch and every
 * downstream consumer read as "a screen".
 *
 * Deliberately conservative. Comments and blank lines are ignored; ANY other
 * statement — a declaration, a side effect, an `export default` — makes it not a
 * barrel, so a hybrid `index.tsx` that both re-exports and renders keeps its
 * page classification. A false negative here costs a page label; a false
 * positive would silently reclassify real screens.
 */
export function isBarrel(text: string): boolean {
    const body = text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l !== '' && !l.startsWith('//'));
    if (body.length === 0) return false;
    return body.every((l) => /^export\s+(?:\*|\{)[^;]*from\s+['"][^'"]+['"];?$/.test(l));
}

function classify(rel: string, text = ''): AuditKind {
    if (/\.(css|scss|sass|less)$/i.test(rel)) return 'style';
    // `view` is the BLADE branch, not a dead one. It reads 0 in a JS tree by
    // construction and 2 in this repository's own Laravel fixtures — the two
    // statements are not in tension, and reading the first as "unused" is the
    // misreading `road-to-component-granularity-vocabulary` 0.6 was written
    // against.
    if (/\.blade\.php$/.test(rel) || /resources\/views\//.test(rel)) return 'view';
    if (/(^|\/)(pages|app)\//i.test(rel)) return 'page';
    // An `index.*` that only re-exports is a barrel, not a screen.
    if (/(^|\/)(page|index)\.[jt]sx?$/i.test(rel)) {
        return /(^|\/)index\.[jt]sx?$/i.test(rel) && isBarrel(text) ? 'component' : 'page';
    }
    return 'component';
}

/**
 * Pure core. Takes (relative path, text) pairs so every branch is testable
 * without a tree on disk — the same reason `ui_authority` takes a record.
 */
/**
 * The directories shadcn's own `components.json` declares as its UI root, as
 * repo-relative prefixes with a trailing slash. Empty when the file is absent,
 * unparseable, or declares no `aliases.ui`.
 *
 * `aliases.ui` is written as a path alias (`@/components/ui`, `~/lib/ui`, or a
 * bare `src/ui`). The leading alias token is stripped rather than resolved: this
 * is a marker detector, not a module resolver, and resolving `@` would mean
 * reading `tsconfig.json` paths for a signal that only has to be right about
 * WHICH DIRECTORY, never about which module.
 */
export function shadcnUiDirs(
    files: ReadonlyArray<readonly [string, string]>,
): string[] {
    const out: string[] = [];
    for (const [rel, text] of files) {
        if (path.basename(rel) !== 'components.json') continue;
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            continue;
        }
        if (typeof parsed !== 'object' || parsed === null) continue;
        const aliases = (parsed as Record<string, unknown>)['aliases'];
        if (typeof aliases !== 'object' || aliases === null) continue;
        const ui = (aliases as Record<string, unknown>)['ui'];
        if (typeof ui !== 'string' || ui.trim() === '') continue;
        const stripped = ui.trim().replace(/^[@~]\//, '').replace(/^\.\//, '').replace(/\/+$/, '');
        if (stripped !== '') out.push(`${stripped}/`);
    }
    return [...new Set(out)];
}

export function buildArtefact(
    root: string,
    files: ReadonlyArray<readonly [string, string]>,
    now = new Date().toISOString(),
): UiAuditArtefact {
    const uiFiles = files.filter(([rel]) => isUiPath(rel) || isUiTreePath(rel));
    const components: ComponentEntry[] = [];
    const tokens = new Set<string>();
    const primitives = new Set<string>();
    const markers: DesignSystemMarker[] = [];
    const families = new Set<string>();

    // Declared shadcn UI roots win over the hardcoded `components/ui/` pattern.
    // A project whose `aliases.ui` points elsewhere used to report NO design
    // system, which is the opposite of the truth.
    const declaredUiDirs = shadcnUiDirs(files);
    for (const [rel] of files) {
        if (
            declaredUiDirs.length > 0 &&
            /\.tsx?$/i.test(rel) &&
            declaredUiDirs.some((d) => rel.startsWith(d)) &&
            !markers.some((m) => m.marker === 'shadcn')
        ) {
            markers.push({ marker: 'shadcn', path: rel });
        }
        for (const [re, marker] of SYSTEM_MARKERS) {
            if (re.test(rel) && !markers.some((m) => m.marker === marker)) markers.push({ marker, path: rel });
        }
    }
    for (const [rel, text] of uiFiles) {
        for (const m of text.matchAll(TOKEN_DECL)) tokens.add(m[1]!.toLowerCase());
        for (const m of text.matchAll(FONT_FAMILY_DECL)) {
            const first = m[1]!.split(',')[0]?.trim().replace(/^["']|["']$/g, '').toLowerCase();
            if (first && !first.startsWith('var(')) families.add(first);
        }
        const exports: string[] = [];
        for (const m of text.matchAll(JSX_EXPORT)) {
            exports.push(m[1]!);
            primitives.add(m[1]!);
        }
        components.push({ path: rel, kind: classify(rel, text), exports });
    }

    // Greenfield is the ABSENCE of a UI surface, not the absence of a
    // DESIGN.md. A1.3 depends on this distinction: a coherent incumbent with no
    // DESIGN.md is emphatically not greenfield.
    const greenfield = components.length === 0;

    // Coherence is evidence of a consistent visual vocabulary, and it has more
    // than one shape. Three independent signals, any of which is sufficient:
    const signals: string[] = [];
    if (tokens.size >= 3) signals.push(`${tokens.size} declared tokens`);
    if (markers.length > 0) signals.push(`design-system marker: ${markers.map((m) => m.marker).join(', ')}`);
    // A single dominant first-choice family is the signal the token heuristic
    // misses entirely: a hand-written stylesheet can be perfectly coherent with
    // literal values and BEM naming and declare no custom property at all.
    if (families.size === 1) signals.push(`single type family: ${[...families][0]}`);
    const coherent = signals.length > 0;

    return {
        schema: 1,
        generated_at: now,
        root,
        components_found: components,
        tokens: [...tokens].sort(),
        primitives: [...primitives].sort(),
        design_system_markers: markers,
        greenfield,
        audit_path: greenfield ? 'greenfield' : coherent ? 'high_confidence' : 'ambiguous',
        coherence_signals: signals,
        control_roles: buildControlRoles(
            uiFiles,
            markers.map((m) => m.path),
        ),
        stamp: { head: null, inputs_digest: inputsDigest(uiFiles), files: uiFiles.length },
        context_stale: staleness(files, tokens),
        verification: 'verified',
    };
}

/** Order-independent digest over the UI files an artefact was computed from. */
export function inputsDigest(files: ReadonlyArray<readonly [string, string]>): string {
    const h = createHash('sha256');
    for (const [rel, text] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
        h.update(rel).update('\0').update(text).update('\0');
    }
    return h.digest('hex').slice(0, 16);
}

function gitHead(cwd: string): string | null {
    try {
        return execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch {
        return null;
    }
}

/**
 * E2.3 — Tier-1 staleness, on data the command has ALREADY opened.
 *
 * The step's constraint is that the file-open count must not rise, which is why
 * this takes the same `files` array rather than re-reading DESIGN.md. A token
 * named in DESIGN.md or PRODUCT.md that no UI file declares is reported; it is
 * never repaired here, because repairing a context document without being asked
 * is a scope expansion, not a service.
 */
export function staleness(
    files: ReadonlyArray<readonly [string, string]>,
    declared: ReadonlySet<string>,
): StaleEntry[] {
    const out: StaleEntry[] = [];
    for (const [rel, text] of files) {
        if (!/\b(DESIGN|PRODUCT)\.md$/.test(rel)) continue;
        for (const m of text.matchAll(/`(--[a-z0-9][a-z0-9-]*)`/gi)) {
            const token = m[1]!.toLowerCase();
            if (!declared.has(token)) {
                out.push({ document: rel, token, reason: 'named in the document, declared by no UI file' });
            }
        }
    }
    return out;
}

export interface UiAuditOptions {
    target?: string | undefined;
    json?: boolean | undefined;
    projectRoot?: string | undefined;
}

function readPairs(projectRoot: string, target: string): { pairs: Array<readonly [string, string]>; unreadable: number } {
    const stat = fs.statSync(target);
    const absFiles = stat.isDirectory() ? walk(target) : [target];
    const pairs: Array<readonly [string, string]> = [];
    let unreadable = 0;
    for (const abs of absFiles) {
        try {
            if (fs.statSync(abs).size > 2_000_000) continue;
            pairs.push([path.relative(projectRoot, abs).split(path.sep).join('/'), fs.readFileSync(abs, 'utf8')]);
        } catch {
            unreadable++;
        }
    }
    return { pairs, unreadable };
}

/**
 * Box metrics MEASURED by `ui:render --interact`, newest manifest first, keyed by
 * control role. A rendered box outranks one parsed from class names: the class
 * parser cannot see CSS modules, Blade attribute bags or a theme override.
 */
export function renderedBoxMetrics(projectRoot: string): Partial<Record<ControlRole, BoxMetrics & { source: 'render' }>> {
    const dir = path.join(projectRoot, 'agents', 'runtime', 'state', 'render');
    const out: Partial<Record<ControlRole, BoxMetrics & { source: 'render' }>> = {};
    let manifests: Array<{ at: string; interactions: Array<{ role: ControlRole | null; box: Record<string, number> | null }> }> = [];
    try {
        for (const slug of fs.readdirSync(dir)) {
            try {
                const m = JSON.parse(fs.readFileSync(path.join(dir, slug, 'manifest.json'), 'utf8'));
                if (Array.isArray(m.interactions)) manifests.push({ at: String(m.generated_at), interactions: m.interactions });
            } catch {
                // a capture without a readable manifest contributes nothing
            }
        }
    } catch {
        return out;
    }
    manifests = manifests.sort((x, y) => y.at.localeCompare(x.at));
    for (const m of manifests) {
        for (const r of m.interactions) {
            if (r.role === null || r.box === null || out[r.role]) continue;
            const b = r.box;
            out[r.role] = {
                height_px: b['height_px'] ?? null,
                padding_x_px: b['padding_x_px'] ?? null,
                padding_y_px: b['padding_y_px'] ?? null,
                radius_px: b['radius_px'] ?? null,
                font_size_px: b['font_size_px'] ?? null,
                border_px: b['border_px'] ?? null,
                source: 'render',
            } as BoxMetrics & { source: 'render' };
        }
    }
    return out;
}

/** Compute the artefact for `target` under `projectRoot`, stamped with git HEAD. */
export function computeUiAudit(projectRoot: string, target: string): UiAuditArtefact {
    const { pairs, unreadable } = readPairs(projectRoot, target);
    let artefact = buildArtefact(path.relative(projectRoot, target).split(path.sep).join('/') || '.', pairs);
    artefact = { ...artefact, stamp: { ...artefact.stamp, head: gitHead(projectRoot) } };
    const rendered = renderedBoxMetrics(projectRoot);
    for (const [role, box] of Object.entries(rendered) as Array<[ControlRole, BoxMetrics]>) {
        const entry = artefact.control_roles[role];
        if (entry) {
            entry.box_metrics = box;
            delete entry.box_metrics_reason;
        }
    }
    if (unreadable > 0) {
        artefact = {
            ...artefact,
            verification: 'degraded',
            degradation_reason: `${unreadable} file(s) could not be read`,
        };
    }
    return artefact;
}

/**
 * True when `artefact` no longer describes the tree: HEAD moved, or the UI files
 * it was computed from changed (a working-tree edit moves no HEAD). An artefact
 * without a stamp predates 2.3 and is stale by definition.
 */
export function isUiAuditStale(projectRoot: string, artefact: Partial<UiAuditArtefact>): boolean {
    const stamp = artefact.stamp;
    if (!stamp) return true;
    if (stamp.head !== gitHead(projectRoot)) return true;
    const target = path.resolve(projectRoot, artefact.root ?? '.');
    if (!fs.existsSync(target)) return true;
    const { pairs } = readPairs(projectRoot, target);
    const ui = pairs.filter(([rel]) => isUiPath(rel) || isUiTreePath(rel));
    return inputsDigest(ui) !== stamp.inputs_digest;
}

/**
 * The control-role lookup every apply path makes (2.4): read the artefact,
 * recompute and rewrite it first when it is missing or stale.
 */
export function lookupControlRoles(projectRoot: string, target = '.'): UiAuditArtefact['control_roles'] {
    const outPath = path.join(projectRoot, ARTEFACT_REL);
    let artefact: Partial<UiAuditArtefact> | null = null;
    try {
        artefact = JSON.parse(fs.readFileSync(outPath, 'utf8')) as Partial<UiAuditArtefact>;
    } catch {
        artefact = null;
    }
    if (artefact === null || isUiAuditStale(projectRoot, artefact) || artefact.control_roles === undefined) {
        const fresh = computeUiAudit(projectRoot, path.resolve(projectRoot, target));
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, `${JSON.stringify(fresh, null, 2)}\n`);
        return fresh.control_roles;
    }
    return artefact.control_roles;
}

export function runUiAudit(opts: UiAuditOptions = {}): number {
    const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
    const target = path.resolve(projectRoot, opts.target ?? '.');
    if (!fs.existsSync(target)) {
        process.stderr.write(`[ui:audit] path not found: ${target}\n`);
        return 1;
    }
    const artefact = computeUiAudit(projectRoot, target);

    const outPath = path.join(projectRoot, ARTEFACT_REL);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(artefact, null, 2)}\n`);

    if (opts.json) process.stdout.write(`${JSON.stringify(artefact, null, 2)}\n`);
    else {
        process.stdout.write(
            `✅  ui:audit — ${artefact.components_found.length} component(s), ${artefact.tokens.length} token(s), ` +
                `${artefact.design_system_markers.length} system marker(s), ` +
                `${Object.keys(artefact.control_roles).length} control role(s); path=${artefact.audit_path}\n` +
                `    ${ARTEFACT_REL}\n` +
                (artefact.context_stale.length
                    ? `    ⚠️  ${artefact.context_stale.length} CONTEXT_STALE line(s) — reported, not repaired\n`
                    : '') +
                (artefact.verification !== 'verified' ? `    ⚠️  ${artefact.degradation_reason}\n` : ''),
        );
    }
    return 0;
}
