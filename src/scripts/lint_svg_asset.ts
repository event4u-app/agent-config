#!/usr/bin/env node
/**
 * lint_svg_asset — the command-line surface over the SVG rule set.
 *
 * The rules live in `_lib/svg_rules.ts`, because the design pass imports them
 * into the hook bundle and must not drag a CLI in with them (see that file's
 * header for the measurement). Everything this module adds is the part only a
 * command needs: argument parsing, the directory walk, the project config, the
 * scanned-nothing refusal, and the step 1.2 preservation readout.
 *
 * Inline-ignore (same shape as `lint_design_quality`, works in XML comments):
 *   svg-asset-disable <rule-id> [-- reason]            (file scope)
 *   svg-asset-disable-next-line <rule-id> [-- reason]
 *   svg-asset-disable-line <rule-id> [-- reason]
 *
 * Per-project config (`.svg-asset.json` in the project root):
 *   { "ignoreRules": ["svg-a11y-generic-id"], "ignoreFiles": ["vendor/**"] }
 *
 * Usage:
 *   lint_svg_asset --dir <path> [--delivery inline|img|css-bg|document]
 *   lint_svg_asset --file <a.svg> [--file <b.svg>] [--delivery …]
 *   lint_svg_asset --file <after.svg> --baseline <before.svg> --allow id,id
 *
 * Exit codes: 0 = clean, 2 = findings, 1 = internal error (including the
 * scanned-nothing refusal — a gate that scanned no file is not a clean gate).
 */
import fs from 'node:fs';
import path from 'node:path';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import {
    DELIVERY_MODES,
    parseElements,
    scanHostHtml,
    scanSvg,
    type DeliveryMode,
    type Finding,
    type ProjectConfig,
    type SvgElement,
} from './_lib/svg_rules.js';

export * from './_lib/svg_rules.js';

// Step 1.2 — preservation readout for a surgical edit
// ---------------------------------------------------------------------------

export interface PreservationChange {
    id: string;
    element: string;
    attribute: string;
    before: string;
    after: string;
}

/**
 * Canonicalised attribute map — number formatting, attribute order and
 * whitespace normalised away, so a re-serialisation that changed nothing reads
 * as nothing changed.
 */
export function canonicalAttrs(attrs: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const key of Object.keys(attrs).sort()) {
        const v = (attrs[key] ?? '')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/-?\d+\.?\d*(?:[eE][-+]?\d+)?/g, (n) => {
                const num = Number(n);
                return Number.isFinite(num) ? String(Number(num.toFixed(4))) : n;
            });
        out[key] = v;
    }
    return out;
}

/**
 * Every element outside the allowed set that changed between two revisions.
 *
 * NO PIXEL DIFF decides this. Anti-aliasing and font metrics would make a
 * pixel comparison a per-machine verdict, and the discipline this witnesses —
 * `design-fidelity-mechanics.md` § surgical edits — is about which elements
 * the edit was allowed to touch, which is an attribute fact.
 */
export function preservationReadout(
    beforeContent: string,
    afterContent: string,
    allowedIds: readonly string[],
): PreservationChange[] {
    const allow = new Set(allowedIds.map((s) => s.trim()).filter(Boolean));

    /**
     * A stable key per element, and the id chain above it.
     *
     * An element WITHOUT an id is keyed by its nearest id-bearing ancestor plus
     * its tag and its ordinal INSIDE that ancestor — never by a document-wide
     * index. A document-wide index shifts for every element after an allowed
     * deletion, so removing one child of the allowed group reported every
     * un-idded element after it as changed. Measured on the `grouped-transforms`
     * triple: the correct edit reported `rect#7 (element)` and the readout could
     * not tell a clean surgical edit from a dirty one.
     */
    const index = (content: string): Map<string, { el: SvgElement; chain: string[] }> => {
        const map = new Map<string, { el: SvgElement; chain: string[] }>();
        const stack: Array<{ name: string; id: string | null }> = [];
        const ordinals = new Map<string, number>();
        for (const el of parseElements(content)) {
            if (el.closing) {
                if (stack[stack.length - 1]?.name === el.name) stack.pop();
                continue;
            }
            const chain = stack.map((f) => f.id).filter((x): x is string => x !== null);
            const ownerId = [...stack].reverse().find((f) => f.id !== null)?.id ?? '';
            const own = el.attrs['id'] ?? null;
            let key: string;
            if (own) {
                key = own;
            } else {
                const bucket = `${ownerId}/${el.name}`;
                const n = (ordinals.get(bucket) ?? 0) + 1;
                ordinals.set(bucket, n);
                key = `${bucket}#${n}`;
            }
            map.set(key, { el, chain: own ? [...chain, own] : chain });
            if (!el.selfClosing) stack.push({ name: el.name, id: own });
        }
        return map;
    };

    const before = index(beforeContent);
    const after = index(afterContent);
    const changes: PreservationChange[] = [];
    /** An element inside an allowed subtree is itself allowed. */
    const permitted = (entry: { chain: string[] } | undefined): boolean =>
        Boolean(entry && entry.chain.some((id) => allow.has(id)));

    for (const [key, beforeEntry] of before) {
        if (permitted(beforeEntry)) continue;
        const afterEntry = after.get(key);
        if (!afterEntry) {
            changes.push({
                id: key,
                element: beforeEntry.el.name,
                attribute: '(element)',
                before: 'present',
                after: 'removed',
            });
            continue;
        }
        const a = canonicalAttrs(beforeEntry.el.attrs);
        const b = canonicalAttrs(afterEntry.el.attrs);
        for (const attr of new Set([...Object.keys(a), ...Object.keys(b)])) {
            if ((a[attr] ?? '') === (b[attr] ?? '')) continue;
            changes.push({
                id: key,
                element: beforeEntry.el.name,
                attribute: attr,
                before: a[attr] ?? '(absent)',
                after: b[attr] ?? '(absent)',
            });
        }
    }
    for (const [key, afterEntry] of after) {
        if (permitted(afterEntry) || before.has(key)) continue;
        changes.push({
            id: key,
            element: afterEntry.el.name,
            attribute: '(element)',
            before: 'absent',
            after: 'added',
        });
    }
    return changes;
}

export function loadConfig(dir: string): ProjectConfig {
    const configPath = path.join(dir, '.svg-asset.json');
    if (!fs.existsSync(configPath)) return {};
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as ProjectConfig;
    } catch {
        return {};
    }
}

function* walkDir(dir: string, ext: RegExp): Generator<string> {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        if (entry.isDirectory()) yield* walkDir(full, ext);
        else if (ext.test(entry.name)) yield full;
    }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function readFlag(args: string[], name: string): string | undefined {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
}

function readAll(args: string[], name: string): string[] {
    const out: string[] = [];
    for (let i = 0; i < args.length; i++) if (args[i] === name && args[i + 1]) out.push(args[i + 1] as string);
    return out;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const args = [...argv];
    const jsonMode = args.includes('--json');
    const quiet = args.includes('--quiet');
    const deliveryRaw = readFlag(args, '--delivery');
    if (deliveryRaw && !DELIVERY_MODES.includes(deliveryRaw as DeliveryMode)) {
        process.stderr.write(
            `[lint_svg_asset] unknown --delivery "${deliveryRaw}"; expected one of ${DELIVERY_MODES.join(', ')}\n`,
        );
        return 1;
    }
    const delivery = deliveryRaw as DeliveryMode | undefined;

    // --- step 1.2: preservation readout -------------------------------------
    const baseline = readFlag(args, '--baseline');
    if (baseline) {
        const files = readAll(args, '--file');
        const after = files[0];
        if (!after) {
            process.stderr.write('[lint_svg_asset] --baseline needs a --file <after.svg> to compare against\n');
            return 1;
        }
        if (!fs.existsSync(baseline) || !fs.existsSync(after)) {
            process.stderr.write('[lint_svg_asset] --baseline or --file path not found\n');
            return 1;
        }
        const allow = (readFlag(args, '--allow') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        const changes = preservationReadout(
            fs.readFileSync(baseline, 'utf-8'),
            fs.readFileSync(after, 'utf-8'),
            allow,
        );
        if (jsonMode) {
            process.stdout.write(`${JSON.stringify(changes, null, 2)}\n`);
            return changes.length ? 2 : 0;
        }
        if (!changes.length) {
            if (!quiet) {
                process.stdout.write(
                    `✅  lint_svg_asset --baseline: nothing changed outside ${allow.length} allowed id(s).\n`,
                );
            }
            return 0;
        }
        for (const c of changes) {
            process.stdout.write(
                `❌ ${after} [svg-preserve-changed-outside-allowed] <${c.element} id="${c.id}"> ` +
                    `${c.attribute}: "${c.before}" → "${c.after}"\n`,
            );
        }
        process.stdout.write(
            `\nlint_svg_asset: ${changes.length} element change(s) outside the allowed set. ` +
                'A surgical edit touches only what it declared.\n',
        );
        return 2;
    }

    // --- scanning -----------------------------------------------------------
    const explicit = readAll(args, '--file');
    const dirArg = readFlag(args, '--dir');
    const targets: string[] = [];
    let roots: string[] = [];

    if (explicit.length) {
        targets.push(...explicit.map((f) => path.resolve(f)));
        roots = targets;
    } else {
        const scanDir = dirArg ? path.resolve(dirArg) : path.resolve(process.cwd(), 'src');
        roots = [scanDir];
        if (!fs.existsSync(scanDir)) {
            if (!quiet) process.stderr.write(`[lint_svg_asset] scan directory not found: ${scanDir}\n`);
            process.stderr.write(
                'This linter is opt-in. Run with --dir <path> or --file <a.svg> pointing at your assets.\n',
            );
            return 0;
        }
        for (const f of walkDir(scanDir, /\.(svg|html|htm)$/i)) targets.push(f);
    }

    const config = loadConfig(process.cwd());
    const ignoreRules = new Set((config.ignoreRules ?? []).map((r) => r.toLowerCase()));
    const ignoreGlobs = config.ignoreFiles ?? [];
    const scanned = targets.filter((f) => !ignoreGlobs.some((g) => f.includes(g.replace('**', ''))));

    try {
        assertScanned({ gate: 'lint_svg_asset', scanned: scanned.length, units: 'SVG/HTML file(s)', roots });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    const all: Finding[] = [];
    for (const abs of scanned) {
        const rel = path.relative(process.cwd(), abs);
        try {
            const content = fs.readFileSync(abs, 'utf-8');
            const findings = /\.svg$/i.test(abs)
                ? scanSvg(content, rel, { delivery })
                : scanHostHtml(content, rel, { delivery });
            all.push(...findings.filter((f) => !ignoreRules.has(f.rule.toLowerCase())));
        } catch (err) {
            if (!quiet) process.stderr.write(`[lint_svg_asset] error: ${abs}: ${err}\n`);
        }
    }

    if (jsonMode) {
        process.stdout.write(`${JSON.stringify(all, null, 2)}\n`);
        return all.length > 0 ? 2 : 0;
    }
    if (!all.length) {
        if (!quiet) {
            process.stdout.write(
                `✅  lint_svg_asset: clean — ${scanned.length} file(s) checked, no violations.\n`,
            );
        }
        return 0;
    }
    const errors = all.filter((f) => f.severity === 'error');
    const warnings = all.filter((f) => f.severity === 'warning');
    const inert = all.filter((f) => f.severity === 'inert');
    for (const f of all) {
        const icon = f.severity === 'error' ? '❌' : f.severity === 'warning' ? '⚠️ ' : 'ℹ️ ';
        process.stdout.write(`${icon} ${f.file}:${f.line} [${f.rule}] ${f.snippet}\n`);
    }
    process.stdout.write(
        `\nlint_svg_asset: ${errors.length} error(s), ${warnings.length} warning(s), ${inert.length} inert. ` +
            'Use svg-asset-disable-next-line <rule> -- reason or .svg-asset.json to suppress. ' +
            'Advisory: an "inert" row is not a clean row — the same file inlined tomorrow is an error.\n',
    );
    return 2;
}

/* c8 ignore start — entrypoint guard, exercised by the CLI not by the tests */
const invokedDirectly =
    typeof process !== 'undefined' &&
    Array.isArray(process.argv) &&
    /lint_svg_asset\.(ts|js)$/.test(process.argv[1] ?? '');
if (invokedDirectly) process.exit(main());
/* c8 ignore stop */
