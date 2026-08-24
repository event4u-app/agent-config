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

import * as fs from 'node:fs';
import * as path from 'node:path';

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

export interface ComponentEntry {
    path: string;
    kind: 'component' | 'view' | 'style' | 'page';
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
    verification: 'verified' | 'degraded';
    degradation_reason?: string;
}

/** Files that mark an adopted design system, and the marker each implies. */
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

function classify(rel: string): ComponentEntry['kind'] {
    if (/\.(css|scss|sass|less)$/i.test(rel)) return 'style';
    if (/(^|\/)(pages|app)\//i.test(rel) || /(^|\/)(page|index)\.[jt]sx?$/i.test(rel)) return 'page';
    if (/\.blade\.php$/.test(rel) || /resources\/views\//.test(rel)) return 'view';
    return 'component';
}

/**
 * Pure core. Takes (relative path, text) pairs so every branch is testable
 * without a tree on disk — the same reason `ui_authority` takes a record.
 */
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

    for (const [rel] of files) {
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
        components.push({ path: rel, kind: classify(rel), exports });
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
        context_stale: staleness(files, tokens),
        verification: 'verified',
    };
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

export function runUiAudit(opts: UiAuditOptions = {}): number {
    const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
    const target = path.resolve(projectRoot, opts.target ?? '.');
    if (!fs.existsSync(target)) {
        process.stderr.write(`[ui:audit] path not found: ${target}\n`);
        return 1;
    }

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

    let artefact = buildArtefact(path.relative(projectRoot, target).split(path.sep).join('/') || '.', pairs);
    if (unreadable > 0) {
        artefact = {
            ...artefact,
            verification: 'degraded',
            degradation_reason: `${unreadable} file(s) could not be read`,
        };
    }

    const outPath = path.join(projectRoot, ARTEFACT_REL);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(artefact, null, 2)}\n`);

    if (opts.json) process.stdout.write(`${JSON.stringify(artefact, null, 2)}\n`);
    else {
        process.stdout.write(
            `✅  ui:audit — ${artefact.components_found.length} component(s), ${artefact.tokens.length} token(s), ` +
                `${artefact.design_system_markers.length} system marker(s); path=${artefact.audit_path}\n` +
                `    ${ARTEFACT_REL}\n` +
                (artefact.context_stale.length
                    ? `    ⚠️  ${artefact.context_stale.length} CONTEXT_STALE line(s) — reported, not repaired\n`
                    : '') +
                (artefact.verification !== 'verified' ? `    ⚠️  ${artefact.degradation_reason}\n` : ''),
        );
    }
    return 0;
}
