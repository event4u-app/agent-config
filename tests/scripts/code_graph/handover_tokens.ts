/**
 * The design tokens of the map-views handover (inbox round 2026-10-bf), dark
 * and light, as its `<helmet><style>` blocks write them. Taken from the
 * Systems page, whose block is the superset, plus the five tokens only the
 * Code page (Main) declares. The violet --grid of the Projects page is scoped
 * to the hub graph and listed apart.
 */
export const HANDOVER_TOKENS: Readonly<Record<string, readonly [string, string]>> = {
    '--bg': ['#070b12', '#f3f5f9'],
    '--panel': ['#0d131d', '#ffffff'],
    '--rail': ['#0a1018', '#fafbfd'],
    '--raise': ['#131c2a', '#eef2f7'],
    '--line': ['#1c2738', '#dde3ec'],
    '--line2': ['#2a3445', '#c3ccd9'],
    '--text': ['#e8eef7', '#0d1522'],
    '--muted': ['#93a1b5', '#536074'],
    '--soft': ['#c3cedd', '#334155'],
    '--faint': ['#6f7d92', '#8592a5'],
    '--brand': ['#ff8c2a', '#f47a12'],
    '--brandText': ['#ff9d47', '#b4530a'],
    '--brandTint': ['rgba(255,140,42,0.16)', 'rgba(244,122,18,0.12)'],
    '--brandLine': ['rgba(255,140,42,0.55)', 'rgba(244,122,18,0.6)'],
    '--cyan': ['#3ec5ff', '#0ea5e9'],
    '--cyanText': ['#8adcff', '#0369a1'],
    '--cyanTint': ['rgba(62,197,255,0.13)', 'rgba(14,165,233,0.12)'],
    '--green': ['#3ddc84', '#16a34a'],
    '--greenText': ['#3ddc84', '#15803d'],
    '--greenTint': ['rgba(61,220,132,0.14)', 'rgba(22,163,74,0.12)'],
    '--amber': ['#ffc14d', '#f5b324'],
    '--amberText': ['#ffc14d', '#92580a'],
    '--amberTint': ['rgba(255,193,77,0.14)', 'rgba(245,179,36,0.16)'],
    '--red': ['#ff5d6c', '#e11d48'],
    '--redText': ['#ff8a95', '#be123c'],
    '--redTint': ['rgba(255,93,108,0.14)', 'rgba(225,29,72,0.1)'],
    '--violet': ['#c9a2ff', '#8b5cf6'],
    '--violetText': ['#d9bdff', '#6d28d9'],
    '--violetTint': ['rgba(201,162,255,0.16)', 'rgba(124,58,237,0.10)'],
    '--doc': ['#6b7280', '#9aa3b2'],
    '--onColor': ['#0d1522', '#0d1522'],
    '--logoBg': ['#0b1220', '#0d1522'],
    '--logoText': ['#f4f7fb', '#ffffff'],
    '--grid': ['rgba(62,197,255,0.055)', 'rgba(14,165,233,0.09)'],
    '--sbThumb': ['color-mix(in srgb,#93a1b5 45%,transparent)', 'color-mix(in srgb,#536074 45%,transparent)'],
    '--sbThumbHover': ['#ff8c2a', '#f47a12'],
    // Declared by the Code page (Main) only.
    '--node': ['#2a3445', '#cdd5e1'],
    '--nodeStroke': ['#3a4760', '#aab5c6'],
    '--edge': ['rgba(200,214,235,0.17)', 'rgba(30,41,59,0.17)'],
    '--d3': ['#a7c46b', '#86b25a'],
    '--blastBg': ['#120d08', '#fff8ef'],
    '--glow': ['0.9', '0.35'],
};

/** The Projects page's own --grid, drawn on the hub graph. */
export const HUB_GRID: readonly [string, string] = ['rgba(201,162,255,0.06)', 'rgba(139,92,246,0.08)'];

/** One spelling for a value: no spaces, lower case, numbers without trailing zeros. */
export function normToken(v: string): string {
    return v
        .replace(/\s+/g, '')
        .toLowerCase()
        .replace(/(#[0-9a-f]{3,8})|(\d*\.\d+|\d+)/g, (m: string, hex?: string) => hex ?? String(Number(m)));
}
