#!/usr/bin/env node
// tokens/build-as.mjs — generates the shadcn `:root` token block that
// agent-switch's GUI consumes, from the canonical event4u-agent-tokens.json.
//
// Default mode: writes tokens/generated/as-index-css-block.css.
// `--check` mode: compares the generated content byte-for-byte against the
// committed file and exits 1 on drift, without writing.
//
// Both modes also run a superset verification against agent-switch's real
// gui/src/index.css (read-only reference — this script never writes there):
// every `--name` that AS's current index.css defines in its two `:root`
// blocks must also be defined in the emitted block, or the run fails with
// the missing names listed. This is what proves a paste-over never leaves an
// AS-consumed variable undefined.
//
// Never hand-edit tokens/generated/as-index-css-block.css — regenerate here.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { REPO_ROOT, loadTokens, flatten, hexToHslChannels, blendOver, checkAgainst } from './lib.mjs';

const OUT_DIR = path.join(REPO_ROOT, 'tokens', 'generated');
const OUT_FILE = path.join(OUT_DIR, 'as-index-css-block.css');
const OUT_LABEL = 'tokens/generated/as-index-css-block.css';

// agent-switch is a sibling repo, not a subtree of this package — locate it
// via env override first (CI / alternate layouts), else the conventional
// sibling path on this machine. Missing repo is a WARN, not a failure: a
// clone of agent-config alone (no agent-switch checked out) must still be
// able to generate the block.
const AS_REPO = process.env.AGENT_SWITCH_REPO || path.join(os.homedir(), 'projects', 'private', 'agent-switch');
const AS_INDEX_CSS = path.join(AS_REPO, 'gui', 'src', 'index.css');

const CHECK_MODE = process.argv.includes('--check');

// Canonical → shadcn name map, same names both themes. Order matches AS's
// current index.css so a paste-over diff reads cleanly. `null` source marks
// an entry resolved specially in `resolveValue()` below (theme-conditional
// source, or a blend-over-surface composite).
const GROUPS = [
    [['--background', 'bg'], ['--foreground', 'text']],
    [['--card', 'surface'], ['--card-foreground', 'text']],
    [['--popover', 'surface'], ['--popover-foreground', 'text']],
    [['--primary', 'accent'], ['--primary-foreground', 'accent-fg']],
    [['--secondary', 'surface-hover'], ['--secondary-foreground', 'text']],
    [['--muted', 'surface-alt'], ['--muted-foreground', 'text-muted']],
    [['--accent', 'surface-hover'], ['--accent-foreground', 'text']],
    [['--destructive', 'danger'], ['--destructive-foreground', null]],
    [['--success', 'success']],
    [['--warning', 'warning']],
    [['--sidebar', 'sidebar']],
    [['--border', null], ['--input', null], ['--ring', 'focus-ring']],
];

/** Resolve a GROUPS entry to { hex, label } for a given theme's flat color map. */
function resolveValue(cssVar, sourceName, theme, flat) {
    if (cssVar === '--destructive-foreground') {
        const src = theme === 'dark' ? 'text-inverse' : 'accent-fg';
        return { hex: flat[src], label: src };
    }
    if (cssVar === '--border') {
        return { hex: blendOver(flat['border'], flat['surface']), label: 'border over surface' };
    }
    if (cssVar === '--input') {
        return { hex: blendOver(flat['border-strong'], flat['surface']), label: 'border-strong over surface' };
    }
    return { hex: flat[sourceName], label: sourceName };
}

/** Render one theme's variable lines (no selector, no braces, no color-scheme). */
function renderThemeVars(theme, flat, radiusMd) {
    const lines = [];
    if (theme === 'dark') {
        lines.push(`  --radius: ${radiusMd};`, '');
    }
    for (const group of GROUPS) {
        for (const [cssVar, sourceName] of group) {
            const { hex, label } = resolveValue(cssVar, sourceName, theme, flat);
            const channels = hexToHslChannels(hex);
            lines.push(`  ${cssVar}: ${channels}; /* ${label} ${hex} */`);
        }
        lines.push('');
    }
    return lines;
}

function renderFile(tokens) {
    const version = tokens._version;
    const darkFlat = flatten(tokens.color.dark);
    const lightFlat = flatten(tokens.color.light);
    const radiusMd = flatten(tokens.radius).md;

    const header = [
        '/* GENERATED FILE — do not hand-edit.',
        ` * Generated from event4u-agent-tokens.json (_version ${version}) by`,
        ' * tokens/build-as.mjs in agent-config.',
        ' *',
        ' * Paste this content over the two `:root` blocks in agent-switch\'s',
        ' * gui/src/index.css — see tokens/README-as-wiring.md for the full wiring',
        ' * contract. Never hand-edit gui/src/index.css\'s `:root` blocks directly;',
        ' * regenerate here instead. */',
        '',
    ];

    const darkBlock = [
        ':root {',
        ...renderThemeVars('dark', darkFlat, radiusMd),
        '  color-scheme: dark;',
        '}',
        '',
    ];

    const lightBlock = [
        ':root[data-theme="light"] {',
        ...renderThemeVars('light', lightFlat, radiusMd),
        '  color-scheme: light;',
        '}',
        '',
    ];

    return [...header, ...darkBlock, ...lightBlock].join('\n');
}

/** Extract every `--name` defined inside any `:root` / `:root[...]` block. */
function extractRootBlockVarNames(css) {
    const names = new Set();
    const blockRe = /:root(?:\[[^\]]*\])?\s*\{([^}]*)\}/g;
    let blockMatch;
    while ((blockMatch = blockRe.exec(css))) {
        const varRe = /--([a-zA-Z0-9-]+)\s*:/g;
        let varMatch;
        while ((varMatch = varRe.exec(blockMatch[1]))) {
            names.add(`--${varMatch[1]}`);
        }
    }
    return names;
}

/**
 * Verify the emitted block is a superset of every `--name` AS's real
 * gui/src/index.css currently defines. Prints a report either way.
 * Returns true (pass, including "AS repo not found") or false (real drift).
 */
function verifySuperset(emittedCss) {
    const emittedNames = extractRootBlockVarNames(emittedCss);

    if (!fs.existsSync(AS_INDEX_CSS)) {
        console.warn(
            `WARN: superset check skipped — agent-switch index.css not found at ${AS_INDEX_CSS}\n` +
            '  (set AGENT_SWITCH_REPO to override the sibling-repo path).',
        );
        return true;
    }

    const asCss = fs.readFileSync(AS_INDEX_CSS, 'utf8');
    const asNames = extractRootBlockVarNames(asCss);
    const missing = [...asNames].filter((name) => !emittedNames.has(name)).sort();

    if (missing.length > 0) {
        console.error(
            `FAIL: superset check — emitted block is missing ${missing.length} variable(s) ` +
            `that AS's current index.css defines:\n  ${missing.join(', ')}`,
        );
        return false;
    }

    console.log(
        `OK: superset check — emitted block defines all ${asNames.size} variable(s) ` +
        `AS's current gui/src/index.css consumes (checked against ${path.relative(os.homedir(), AS_INDEX_CSS)}).`,
    );
    return true;
}

function main() {
    const tokens = loadTokens();
    const content = renderFile(tokens);

    const supersetOk = verifySuperset(content);
    if (!supersetOk) {
        process.exitCode = 1;
        return;
    }

    if (CHECK_MODE) {
        process.exitCode = checkAgainst(OUT_FILE, content, OUT_LABEL);
        return;
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, content, 'utf8');
    console.log(`Wrote ${OUT_LABEL}`);
}

main();
