// Contrast guard for the canonical token file — re-runs the S0.1 checks
// (tokens/s0.1-contrast-verdict.md) against the CURRENT values in
// event4u-agent-tokens.json, so a future token edit that breaks WCAG AA
// fails CI instead of shipping. Floors: 4.5:1 text, 3:1 non-text UI.
//
// The accent-soft compound checks assert the recorded usage constraint:
// accent text on a soft chip must clear AA on bg and surface (the two
// surfaces the UI actually places soft chips on) — elevated surfaces are
// documented as out of bounds for that composition, so they are not gated.

import { loadTokens, flatten, contrast, parseRgba, parseHex, toHex } from './lib.mjs';

const doc = loadTokens();
let failures = 0;

function blendSoft(softValue, bgHex) {
    const { rgb, alpha } = parseRgba(softValue);
    const bg = parseHex(bgHex);
    return toHex(rgb.map((v, i) => v * alpha + bg[i] * (1 - alpha)));
}

function check(label, fg, bg, floor) {
    const r = Math.round(contrast(fg, bg) * 100) / 100;
    const ok = r >= floor;
    if (!ok) {
        failures += 1;
        console.error(`FAIL  ${label}: ${r} (need ${floor})`);
    } else {
        console.log(`ok    ${label}: ${r} (need ${floor})`);
    }
}

for (const theme of ['dark', 'light']) {
    const c = flatten(doc.color[theme]);
    const surfaces = {
        bg: c.bg,
        surface: c.surface,
        'surface-alt': c['surface-alt'],
        'surface-hover': c['surface-hover'],
        sidebar: c.sidebar,
    };

    console.log(`--- ${theme} ---`);

    for (const [name, s] of Object.entries(surfaces)) {
        check(`${theme}: accent as text on ${name}`, c.accent, s, 4.5);
        check(`${theme}: accent-hover as text on ${name}`, c['accent-hover'], s, 4.5);
        check(`${theme}: accent fill / ring vs ${name} (non-text)`, c.accent, s, 3);
        check(`${theme}: focus-ring vs ${name} (non-text)`, c['focus-ring'], s, 3);
        check(`${theme}: body text on ${name}`, c.text, s, 4.5);
        check(`${theme}: muted text on ${name}`, c['text-muted'], s, 4.5);
    }

    check(`${theme}: accent-fg on accent (button text)`, c['accent-fg'], c.accent, 4.5);
    check(`${theme}: accent-fg on accent-hover (hovered button text)`, c['accent-fg'], c['accent-hover'], 4.5);

    // Semantic colors — informational only, never gating: these are AC's
    // pre-existing values, frozen by the roadmap's "standalone AC is
    // unchanged apart from the accent" acceptance criterion. S0.1's AA
    // guarantee covers the accent family; the semantic text-role gaps
    // (e.g. light success on white at ~3.3) predate this pipeline and are
    // out of scope here. Reported so the debt stays visible.
    for (const sem of ['success', 'warning', 'danger', 'info']) {
        for (const [name, s] of [['bg', c.bg], ['surface', c.surface]]) {
            const r = Math.round(contrast(c[sem], s) * 100) / 100;
            const tag = r >= 4.5 ? 'ok   ' : 'note ';
            console.log(`${tag} ${theme}: ${sem} as text on ${name}: ${r} (informational — pre-existing value, not gated)`);
        }
    }

    // Recorded usage constraint: accent text on soft chips on bg/surface only.
    for (const name of ['bg', 'surface']) {
        check(
            `${theme}: accent text on accent-soft chip over ${name}`,
            c.accent,
            blendSoft(c['accent-soft'], surfaces[name]),
            4.5,
        );
    }
}

if (failures > 0) {
    console.error(`\n${failures} contrast failure(s) — the token change breaks the S0.1 AA guarantee.`);
    process.exit(1);
}
console.log('\nAll contrast checks pass.');
