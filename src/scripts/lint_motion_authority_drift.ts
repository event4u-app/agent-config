/**
 * lint_motion_authority_drift — one file states motion timing, the rest are checked against it.
 *
 * `road-to-one-motion-authority` Phase 1. Six shipped carriers in this tree
 * state motion duration or easing and they disagreed: a hover band of
 * 150–200 ms against a decision tree's 100–160 ms, page transitions running to
 * 800 ms against a stated ceiling of 500 ms, and an elastic recipe supplied by
 * one file while another forbids elastic easing outright and a `backed`
 * detector enforces the prohibition. No reader could tell which value won.
 *
 * `src/skills/fe-design/references/design-patterns.md` § Motion is the sole
 * carrier. This gate does not restate its numbers — it PARSES them, so the
 * authority cannot drift away from its own enforcement. Five dependent files
 * are checked against what it says.
 *
 * WHY TWO PARSING STRATEGIES, NOT ONE.
 *
 * Two dependents are structured (`motion.csv`, `styles.csv`): every row carries
 * an explicit `Duration` / `Easing` field or a register description, so they are
 * parsed mechanically. Three are prose or CSV free text
 * (`design-rules-checklist.md`, `ux-guidelines.csv`, `app-interface.csv`), where
 * a sentence can describe a rule rather than state one. A parser guessing at
 * those over-fires, and a noisy gate gets disabled. So the prose carriers are
 * checked against an EXPLICIT ALLOWLIST of the statements that carry a number or
 * an easing token, each with a recorded verdict, and an unrecognised statement
 * is a finding rather than a guess. A future edit to a motion sentence has to
 * come back through this table.
 *
 * CEILING SEMANTICS, stated because they are a choice.
 *
 * A dependent's duration range fails when its UPPER bound exceeds the
 * authority's band for the interaction it names. Being faster than the band is
 * not a contradiction of a ceiling, and the authority's own hard statement is
 * "Above 500ms: almost never" — an upper limit, not a window.
 *
 * WHAT THIS GATE DOES NOT CHECK.
 *
 * The authority bands five named interactions. A dependent row naming an
 * interaction it does not band — scroll reveal, stagger list, parallax, loading
 * loop — is reported as `unbanded` and NOT failed, because failing it would mean
 * inventing a band the authority never stated. The unbanded count is printed so
 * the gap is visible rather than silent.
 *
 * It also does not check exit DURATION relative to enter duration. That ratio is
 * an open question the authority deliberately does not answer.
 *
 * Exit codes: 0 clean · 2 drift found · 1 usage or config error.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SELF_REL = path.join('src', 'scripts', 'lint_motion_authority_drift.ts');

const AUTHORITY_REL = path.join(
    'src', 'skills', 'fe-design', 'references', 'design-patterns.md',
);
const CHECKLIST_REL = path.join(
    'src', 'skills', 'design-intelligence', 'references', 'design-rules-checklist.md',
);
const DATA_DIR = path.join('src', 'skills', 'design-intelligence', 'data');
const UX_REL = path.join(DATA_DIR, 'ux-guidelines.csv');
const APP_REL = path.join(DATA_DIR, 'app-interface.csv');
const STYLES_REL = path.join(DATA_DIR, 'styles.csv');
const MOTION_REL = path.join(DATA_DIR, 'motion.csv');

export interface Finding {
    readonly target: string;
    readonly reason: string;
}

/* -------------------------------------------------------------------------- */
/* The authority                                                              */
/* -------------------------------------------------------------------------- */

export interface Band { readonly lo: number; readonly hi: number }

export interface Authority {
    /** Lower-cased interaction name → permitted band, in milliseconds. */
    readonly bands: ReadonlyMap<string, Band>;
    /** The hard "above Nms: almost never" figure. */
    readonly ceiling: number;
    /** The curve the authority names for entering elements. */
    readonly enterEasing: string;
    /** The curve it names for exiting elements. */
    readonly exitEasing: string;
}

/** Curve families the authority prohibits outright. Overshoot, by name. */
export const OVERSHOOT_FAMILIES = ['elastic', 'back', 'bounce'] as const;

const DASH = /[–—-]/;

function parseBandList(line: string): Map<string, Band> {
    const out = new Map<string, Band>();
    for (const clause of line.split('.')) {
        const m = /^\s*-?\s*\**([A-Za-z][A-Za-z/ -]*?)\**\s*:\s*(\d+)\s*(?:[–—-]\s*(\d+))?\s*ms\s*$/
            .exec(clause);
        if (m?.[1] === undefined || m[2] === undefined) continue;
        const lo = Number(m[2]);
        const hi = m[3] === undefined ? lo : Number(m[3]);
        out.set(m[1].trim().toLowerCase(), { lo, hi });
    }
    return out;
}

export function parseAuthority(text: string): Authority | string {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => /^## Motion\b/.test(l));
    if (start < 0) return 'design-patterns.md carries no `## Motion` section';
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
        if (/^## /.test(lines[i] ?? '')) { end = i; break; }
    }
    const section = lines.slice(start, end);

    let bands = new Map<string, Band>();
    let ceiling = Number.NaN;
    let enterEasing = '';
    let exitEasing = '';

    for (const l of section) {
        if (bands.size === 0 && /\d\s*ms\b/.test(l) && l.includes(':')) bands = parseBandList(l);
        const c = /[Aa]bove\s+(\d+)\s*ms\s*:\s*almost never/.exec(l);
        if (c?.[1] !== undefined) ceiling = Number(c[1]);
        const en = /Entering \(element appearing\)\?\s*\*\*([a-z-]+)\*\*/.exec(l);
        if (en?.[1] !== undefined) enterEasing = en[1];
        const ex = /Exiting \(element disappearing\)\?\s*\*\*([a-z-]+)\*\*/.exec(l);
        if (ex?.[1] !== undefined) exitEasing = ex[1];
    }

    if (bands.size === 0) return 'the § Motion band line could not be parsed';
    if (!Number.isFinite(ceiling)) return 'the § Motion "above Nms: almost never" ceiling could not be parsed';
    if (enterEasing === '' || exitEasing === '') return 'the § Motion enter/exit easing values could not be parsed';
    return { bands, ceiling, enterEasing, exitEasing };
}

/* -------------------------------------------------------------------------- */
/* CSV                                                                        */
/* -------------------------------------------------------------------------- */

export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"') {
                if (text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false;
            } else cell += ch;
            continue;
        }
        if (ch === '"') { quoted = true; continue; }
        if (ch === ',') { row.push(cell); cell = ''; continue; }
        if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
        if (ch === '\r') continue;
        cell += ch;
    }
    if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.length > 1 || (r[0] ?? '') !== '');
}

const col = (hdr: string[], row: string[], name: string): string => {
    const i = hdr.indexOf(name);
    return i < 0 ? '' : (row[i] ?? '');
};

/** A negated mention ("no bounce", "avoid elastic") states a prohibition, not a value. */
function negated(hay: string, at: number): boolean {
    const before = hay.slice(Math.max(0, at - 24), at).toLowerCase();
    return /\b(no|non|not|never|avoid|avoids|without|zero)\s*[-\s]?$/.test(before);
}

function overshootIn(text: string): string | null {
    for (const fam of OVERSHOOT_FAMILIES) {
        const re = new RegExp(`\\b${fam}(?:y|-back)?\\b`, 'gi');
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
            if (!negated(text, m.index)) return fam;
        }
    }
    // An output control point above 1 means the value passes its target and
    // returns — overshoot decidable from the curve itself, same test as the M1
    // detector in `design_slop_rules.ts`.
    const cb = /cubic-bezier\(?\s*[-\d.]+\s*,\s*(-?[\d.]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = cb.exec(text)) !== null) {
        const y1 = Number(m[1]);
        if (Number.isFinite(y1) && (y1 > 1 || y1 < 0) && !negated(text, m.index)) return 'cubic-bezier overshoot';
    }
    return null;
}

/* -------------------------------------------------------------------------- */
/* motion.csv                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Category (plus a keyword, where the authority bands a narrower thing than the
 * category) → the authority band name. A row that maps to nothing is unbanded.
 */
const MOTION_BAND_MAP: ReadonlyArray<{
    category: string; keyword?: string; band: string;
}> = [
    { category: 'Hover Micro-interaction', keyword: 'button', band: 'button/micro-feedback' },
    { category: 'Page Transition', band: 'page transition' },
];

export interface MotionResult { findings: Finding[]; scanned: number; unbanded: number }

export function checkMotionCsv(text: string, auth: Authority): MotionResult {
    const rows = parseCsv(text);
    const hdr = rows[0] ?? [];
    const findings: Finding[] = [];
    let unbanded = 0;
    let scanned = 0;

    for (const row of rows.slice(1)) {
        const no = (row[0] ?? '').trim();
        if (no === '') continue;
        scanned += 1;
        const target = `motion.csv row ${no}`;
        const easing = col(hdr, row, 'Easing');
        const snippet = col(hdr, row, 'GSAP Snippet');
        const override = col(hdr, row, 'Override Condition').trim();

        const bad = overshootIn(easing) ?? overshootIn(snippet);
        if (bad !== null && override === '') {
            findings.push({
                target,
                reason: `supplies ${/^[aeiou]/.test(bad) ? 'an' : 'a'} ${bad} curve; the authority forbids bounce and elastic easing in UI, and the row declares no override condition`,
            });
        }

        const category = col(hdr, row, 'Category').trim();
        const keywords = col(hdr, row, 'Keywords').toLowerCase();
        const mapped = MOTION_BAND_MAP.find(
            (m) => m.category === category
                && (m.keyword === undefined || keywords.includes(m.keyword)),
        );
        const dur = col(hdr, row, 'Duration');
        const range = new RegExp(`^\\s*(\\d+)\\s*(?:${DASH.source}\\s*(\\d+))?\\s*ms`).exec(dur);
        if (mapped === undefined) { unbanded += 1; continue; }
        if (range?.[1] === undefined) { unbanded += 1; continue; }
        const hi = range[2] === undefined ? Number(range[1]) : Number(range[2]);
        const band = auth.bands.get(mapped.band);
        if (band === undefined) {
            findings.push({ target, reason: `maps to authority band "${mapped.band}", which § Motion no longer states` });
            continue;
        }
        if (hi > band.hi) {
            findings.push({
                target,
                reason: `states ${dur.trim()} for "${mapped.band}", above the authority's ${String(band.lo)}–${String(band.hi)}ms`,
            });
        }
    }
    return { findings, scanned, unbanded };
}

/* -------------------------------------------------------------------------- */
/* styles.csv — a register catalog, checked for the bounce prohibition only    */
/* -------------------------------------------------------------------------- */

/**
 * Tokens by which a style row declares the playful register that IS the
 * catalog's M1 override condition. A row describing a deliberately bouncy visual
 * language is not drifting from the authority; it is the case the override
 * exists for.
 */
const PLAYFUL_TOKENS = [
    'playful', 'toy', 'bubbly', 'bouncy', 'squishy', 'jelly', 'tactile',
    'deformable', 'fun', 'whimsical', 'expressive', 'cartoon',
];

export function checkStylesCsv(text: string): { findings: Finding[]; scanned: number } {
    const rows = parseCsv(text);
    const hdr = rows[0] ?? [];
    const findings: Finding[] = [];
    let scanned = 0;
    for (const row of rows.slice(1)) {
        const no = (row[0] ?? '').trim();
        if (no === '') continue;
        scanned += 1;
        const register = `${col(hdr, row, 'Keywords')} ${col(hdr, row, 'Best For')}`.toLowerCase();
        if (PLAYFUL_TOKENS.some((t) => register.includes(t))) continue;
        for (const field of ['Effects & Animation', 'CSS/Technical Keywords', 'Design System Variables']) {
            const bad = overshootIn(col(hdr, row, field));
            if (bad !== null) {
                findings.push({
                    target: `styles.csv row ${no}`,
                    reason: `${field} supplies ${/^[aeiou]/.test(bad) ? 'an' : 'a'} ${bad} curve without declaring a playful register, which is the catalog's only override for the bounce prohibition`,
                });
                break;
            }
        }
    }
    return { findings, scanned };
}

/* -------------------------------------------------------------------------- */
/* The prose carriers — explicit allowlist                                    */
/* -------------------------------------------------------------------------- */

type Verdict = 'permitted' | 'drift';

interface Allowed {
    /** File, for the message. */ readonly file: string;
    /** Stable key: a checklist rule id, or `<row No>/<column>` for a CSV. */
    readonly key: string;
    /** The exact statement, whitespace-normalised. */ readonly text: string;
    readonly verdict: Verdict;
    /** Why it is permitted, or what it contradicts. */ readonly reason: string;
}

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

export const PROSE_ALLOWLIST: readonly Allowed[] = [
    {
        file: CHECKLIST_REL, key: 'table:7',
        text: '| 7 | Animation | MEDIUM | `ux` | Duration within the authority\'s per-interaction bands, Motion conveys meaning, Spatial continuity | Decorative-only animation, Animating width/height, No reduced-motion |',
        verdict: 'permitted', reason: 'points at the authority instead of restating a band',
    },
    {
        file: CHECKLIST_REL, key: 'duration-timing',
        text: '- `duration-timing` - Use the per-interaction bands in `design-patterns.md` § Motion; never above 500ms (MD)',
        verdict: 'permitted', reason: 'defers to the authority and repeats only its hard ceiling',
    },
    {
        file: CHECKLIST_REL, key: 'loading-states',
        text: '- `loading-states` - Show skeleton or progress indicator when loading exceeds 300ms',
        verdict: 'permitted', reason: 'a wait threshold, not an animation duration',
    },
    {
        file: CHECKLIST_REL, key: 'easing',
        text: '- `easing` - Use ease-out in both directions, entering and exiting; avoid linear for UI transitions',
        verdict: 'permitted', reason: 'matches the authority\'s single shared curve',
    },
    {
        file: CHECKLIST_REL, key: 'spring-physics',
        text: '- `spring-physics` - Prefer critically damped spring curves (no overshoot) over linear for natural feel (Apple HIG fluid animations)',
        verdict: 'permitted', reason: 'excludes overshoot, so it does not contradict the bounce prohibition',
    },
    {
        file: CHECKLIST_REL, key: 'stagger-sequence',
        text: '- `stagger-sequence` - Stagger list/grid item entrance by 30–50ms per item; avoid all-at-once or too-slow reveals (MD)',
        verdict: 'permitted', reason: 'a per-item delay, not a duration for an interaction the authority bands',
    },
    {
        file: UX_REL, key: '8/Do',
        text: 'Use the per-interaction bands in design-patterns.md § Motion',
        verdict: 'permitted', reason: 'defers to the authority',
    },
    {
        file: UX_REL, key: '8/Code Example Good',
        text: 'transition-colors duration-200',
        verdict: 'permitted', reason: 'a generic example naming no interaction the authority bands',
    },
    {
        file: UX_REL, key: '14/Do',
        text: 'Use ease-out in both directions entering and exiting',
        verdict: 'permitted', reason: 'matches the authority\'s single shared curve',
    },
    {
        file: UX_REL, key: '14/Code Example Good',
        text: 'ease-out', verdict: 'permitted', reason: 'the authority\'s curve',
    },
    {
        file: APP_REL, key: '23/Description',
        text: 'Micro-interactions follow the per-interaction bands in design-patterns.md § Motion, with native-like easing',
        verdict: 'permitted', reason: 'defers to the authority',
    },
    {
        file: APP_REL, key: '23/Do',
        text: 'Use ease-out for both enter and exit',
        verdict: 'permitted', reason: 'matches the authority\'s single shared curve',
    },
    {
        file: APP_REL, key: '23/Code Example Good',
        text: 'Animated.timing(..., { duration: 200, easing: Easing.out(Easing.quad) })',
        verdict: 'permitted', reason: 'an out-family curve; names no interaction the authority bands',
    },
];

const DUR_TOKEN = /\d+\s*[–—-]\s*\d+\s*ms|\b\d+\s*ms\b|duration[-:]\s*\d+/i;
const EASE_TOKEN = /ease-in-out|ease-in|ease-out|easeIn|easeOut|elastic|back\.out|bounce|cubic-bezier|Easing\./i;
/** A statement carries a motion value when it names a duration or a curve. */
export const carriesMotionValue = (s: string): boolean => DUR_TOKEN.test(s) || EASE_TOKEN.test(s);

/** Columns whose content is the carrier's own prohibition, never a binding value. */
const NEGATIVE_COLUMNS = new Set(["Don't", 'Code Example Bad']);

function checkStatement(
    file: string, key: string, raw: string, findings: Finding[],
): void {
    const text = norm(raw);
    if (!carriesMotionValue(text)) return;
    const hit = PROSE_ALLOWLIST.find((a) => a.file === file && a.key === key);
    const target = `${path.basename(file)} ${key}`;
    if (hit === undefined) {
        findings.push({
            target,
            reason: `states a motion value the allowlist does not cover: "${text.slice(0, 120)}" — review it against the authority and record a verdict in PROSE_ALLOWLIST`,
        });
        return;
    }
    if (hit.text !== text) {
        findings.push({
            target,
            reason: `drifted from its reviewed wording. Expected "${hit.text.slice(0, 90)}"; found "${text.slice(0, 90)}"`,
        });
        return;
    }
    if (hit.verdict === 'drift') findings.push({ target, reason: hit.reason });
}

export function checkChecklist(text: string): { findings: Finding[]; scanned: number } {
    const findings: Finding[] = [];
    const lines = text.split('\n');
    let inAnimation = false;
    let scanned = 0;
    for (const line of lines) {
        if (/^### \d+\. Animation\b/.test(line)) { inAnimation = true; continue; }
        if (inAnimation && /^### /.test(line)) inAnimation = false;
        const isTableRow = /^\|\s*\d+\s*\|\s*Animation\s*\|/.test(line);
        if (!inAnimation && !isTableRow) continue;
        const rule = /^- `([a-z0-9-]+)`/.exec(line);
        const key = rule?.[1] ?? (isTableRow ? `table:${(/^\|\s*(\d+)/.exec(line)?.[1] ?? '?')}` : null);
        if (key === null) continue;
        scanned += 1;
        checkStatement(CHECKLIST_REL, key, line, findings);
    }
    return { findings, scanned };
}

export function checkProseCsv(
    rel: string, text: string,
): { findings: Finding[]; scanned: number } {
    const rows = parseCsv(text);
    const hdr = rows[0] ?? [];
    const findings: Finding[] = [];
    let scanned = 0;
    for (const row of rows.slice(1)) {
        if (col(hdr, row, 'Category').trim() !== 'Animation') continue;
        const no = (row[0] ?? '').trim();
        scanned += 1;
        hdr.forEach((name, i) => {
            if (NEGATIVE_COLUMNS.has(name)) return;
            checkStatement(rel, `${no}/${name}`, row[i] ?? '', findings);
        });
    }
    return { findings, scanned };
}

/* -------------------------------------------------------------------------- */

const read = (root: string, rel: string): string | null => {
    const abs = path.join(root, rel);
    return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf-8') : null;
};

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();
    const rootFlag = argv.indexOf('--root');
    const root = rootFlag >= 0 ? (argv[rootFlag + 1] ?? REPO_ROOT) : REPO_ROOT;
    const quiet = argv.includes('--quiet');

    const authorityText = read(root, AUTHORITY_REL);
    if (authorityText === null) {
        process.stderr.write(`❌  lint_motion_authority_drift: authority missing at ${AUTHORITY_REL}\n`);
        return 1;
    }
    const auth = parseAuthority(authorityText);
    if (typeof auth === 'string') {
        process.stderr.write(`❌  lint_motion_authority_drift: ${auth}\n`);
        return 1;
    }

    const findings: Finding[] = [];
    let scanned = 0;
    let unbanded = 0;
    const ledger = new GateLedger('lint_motion_authority_drift');
    const dependents = [CHECKLIST_REL, UX_REL, APP_REL, STYLES_REL, MOTION_REL];
    ledger.plan(dependents);

    for (const rel of dependents) {
        const text = read(root, rel);
        if (text === null) {
            findings.push({ target: rel, reason: 'dependent carrier missing — the authority binds a file that is not there' });
            ledger.fail(rel, 'missing');
            continue;
        }
        let res: { findings: Finding[]; scanned: number; unbanded?: number };
        if (rel === MOTION_REL) res = checkMotionCsv(text, auth);
        else if (rel === STYLES_REL) res = checkStylesCsv(text);
        else if (rel === CHECKLIST_REL) res = checkChecklist(text);
        else res = checkProseCsv(rel, text);
        scanned += res.scanned;
        unbanded += res.unbanded ?? 0;
        findings.push(...res.findings);
        if (res.findings.length > 0) ledger.fail(rel, res.findings[0]?.reason ?? 'drift');
        else ledger.complete(rel);
    }
    ledger.report();

    try {
        reportScanned({
            gate: 'lint_motion_authority_drift',
            scanned,
            units: 'motion statement(s)',
            roots: dependents,
        });
    } catch (err) {
        process.stderr.write(`❌  ${(err as Error).message}\n`);
        return 1;
    }

    if (findings.length > 0) {
        process.stderr.write(
            `❌  lint_motion_authority_drift: ${String(findings.length)} statement(s) drift from ${AUTHORITY_REL} § Motion\n`,
        );
        for (const f of findings) process.stderr.write(`  · ${f.target}: ${f.reason}\n`);
        process.stderr.write(
            '\n  § Motion is the sole carrier of duration bands, easing choice and the\n'
            + '  bounce prohibition. Bring the dependent inside its bands, give the row an\n'
            + '  override condition, or change the authority — never both independently.\n',
        );
        return 2;
    }

    if (!quiet) {
        process.stdout.write(
            `✅  lint_motion_authority_drift: ${String(scanned)} motion statement(s) across `
            + `${String(dependents.length)} dependent carrier(s) agree with § Motion `
            + `(${String(unbanded)} row(s) name an interaction the authority does not band, and are not checked).\n`,
        );
    }
    return 0;
}

/* -------------------------------------------------------------------------- */

function selfTest(): number {
    const AUTH = [
        '## Motion — decision-tree and rationale',
        '',
        'This section is the **sole carrier** of motion duration bands.',
        '',
        '**2. Which easing?**',
        '- Entering (element appearing)? **ease-out** (starts fast, slows to rest). Why: x.',
        '- Exiting (element disappearing)? **ease-out** as well. Why: y.',
        '- **Never bounce or elastic easing in UI.** Why: z.',
        '',
        '**3. How long?**',
        '- Button/micro-feedback: 100–160ms. Modal: 200–350ms. Page transition: 300–500ms. Above 500ms: almost never.',
        '',
        '## Next',
        '',
    ].join('\n');

    const MOTION_HDR = 'No,Category,Intensity Tier,Keywords,Trigger,Duration,Easing,GSAP Snippet,Override Condition';
    const cleanMotion = [
        MOTION_HDR,
        '1,Hover Micro-interaction,Subtle,"hover, button",hover,100-160ms,power1.out,"gsap.to(el)",',
        '2,Page Transition,Subtle,"route change",route change,200-300ms,power1.inOut,"gsap.to(main)",',
        '3,Scroll Reveal,Standard,"scroll",scroll,400-600ms,power2.out,"gsap.from(el)",',
    ].join('\n') + '\n';

    const CLEAN_CHECKLIST = [
        '### 7. Animation (MEDIUM)',
        '',
        '- `loading-states` - Show skeleton or progress indicator when loading exceeds 300ms',
        '',
        '### 8. Next',
    ].join('\n');
    const CLEAN_UX = 'No,Category,Issue,Platform,Description,Do,Don\'t,Code Example Good,Code Example Bad,Severity\n'
        + '14,Animation,Easing,All,x,Use ease-out in both directions entering and exiting,Use linear for UI transitions,ease-out,linear,Low\n';
    const CLEAN_APP = 'No,Category,Issue,Keywords,Platform,Description,Do,Don\'t,Code Example Good,Code Example Bad,Severity\n'
        + '23,Animation,Duration & Easing,animation,iOS,Respect reduced motion,Use ease-out for both enter and exit,Use linear,"Animated.timing(..., { duration: 200, easing: Easing.out(Easing.quad) })",x,Medium\n';
    const CLEAN_STYLES = 'No,Style Category,Type,Keywords,Best For,Effects & Animation,CSS/Technical Keywords,Design System Variables\n'
        + '1,Minimalism,General,"clean, spacious","dashboards","Subtle hover, smooth transitions","display: grid","--radius: 0"\n';

    const fixture = (over: Record<string, string>): number => {
        const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'motion-auth-'));
        try {
            const files: Record<string, string> = {
                [AUTHORITY_REL]: AUTH,
                [CHECKLIST_REL]: CLEAN_CHECKLIST,
                [UX_REL]: CLEAN_UX,
                [APP_REL]: CLEAN_APP,
                [STYLES_REL]: CLEAN_STYLES,
                [MOTION_REL]: cleanMotion,
                ...over,
            };
            for (const [rel, body] of Object.entries(files)) {
                const abs = path.join(dir, rel);
                fs.mkdirSync(path.dirname(abs), { recursive: true });
                fs.writeFileSync(abs, body);
            }
            return runGateCli(REPO_ROOT, SELF_REL, ['--root', dir, '--quiet'], dir);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    };

    const cases: SelfTestCase[] = [
        { name: 'a tree agreeing with the authority passes', expect: 'accept', run: () => fixture({}) },
        {
            name: 'a duration above the authority band is refused',
            expect: 'reject',
            run: () => fixture({
                [MOTION_REL]: cleanMotion.replace('100-160ms', '150-200ms'),
            }),
        },
        {
            name: 'a page transition above the ceiling is refused',
            expect: 'reject',
            run: () => fixture({
                [MOTION_REL]: cleanMotion.replace('200-300ms,power1.inOut', '500-800ms,expo.inOut'),
            }),
        },
        {
            name: 'an elastic curve with no override condition is refused',
            expect: 'reject',
            run: () => fixture({
                [MOTION_REL]: cleanMotion.replace('power1.out', '"elastic.out(1,0.4)"'),
            }),
        },
        {
            name: 'the same elastic curve is accepted once the row declares an override',
            expect: 'accept',
            run: () => fixture({
                [MOTION_REL]: cleanMotion
                    .replace('power1.out', '"elastic.out(1,0.4)"')
                    .replace('"gsap.to(el)",', '"gsap.to(el)",M1 — declared playful register'),
            }),
        },
        {
            name: 'an unbanded category is not failed for its duration',
            expect: 'accept',
            run: () => fixture({ [MOTION_REL]: cleanMotion.replace('400-600ms', '400-700ms') }),
        },
        {
            name: 'a prose statement contradicting the shared curve is refused',
            expect: 'reject',
            run: () => fixture({
                [UX_REL]: CLEAN_UX.replace(
                    'Use ease-out in both directions entering and exiting',
                    'Use ease-out for entering ease-in for exiting',
                ),
            }),
        },
        {
            name: 'a new unreviewed motion statement in a prose carrier is refused',
            expect: 'reject',
            run: () => fixture({
                [CHECKLIST_REL]: CLEAN_CHECKLIST.replace(
                    '### 8. Next',
                    '- `new-rule` - Use 900ms for hero transitions\n\n### 8. Next',
                ),
            }),
        },
        {
            name: 'an overshoot curve in styles.csv without a playful register is refused',
            expect: 'reject',
            run: () => fixture({
                [STYLES_REL]: CLEAN_STYLES.replace('"display: grid"', '"animation: bounce (cubic-bezier(0.34, 1.56, 0.64, 1))"'),
            }),
        },
        {
            name: 'the same overshoot is accepted where the row declares a playful register',
            expect: 'accept',
            run: () => fixture({
                [STYLES_REL]: CLEAN_STYLES
                    .replace('"clean, spacious"', '"playful, bubbly"')
                    .replace('"display: grid"', '"animation: bounce (cubic-bezier(0.34, 1.56, 0.64, 1))"'),
            }),
        },
        {
            name: 'a negated mention ("no bounce") is not a violation',
            expect: 'accept',
            run: () => fixture({
                [STYLES_REL]: CLEAN_STYLES.replace('"Subtle hover, smooth transitions"', '"instant transitions (no bounce)"'),
            }),
        },
        {
            name: 'an authority whose § Motion is gone is a config error, not a pass',
            expect: 'reject',
            run: () => fixture({ [AUTHORITY_REL]: '# design patterns\n\nno motion section here\n' }),
        },
        {
            name: 'a missing dependent carrier is refused',
            expect: 'reject',
            run: () => {
                const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'motion-auth-'));
                try {
                    for (const [rel, body] of Object.entries({
                        [AUTHORITY_REL]: AUTH, [CHECKLIST_REL]: CLEAN_CHECKLIST,
                        [UX_REL]: CLEAN_UX, [APP_REL]: CLEAN_APP, [STYLES_REL]: CLEAN_STYLES,
                    })) {
                        const abs = path.join(dir, rel);
                        fs.mkdirSync(path.dirname(abs), { recursive: true });
                        fs.writeFileSync(abs, body);
                    }
                    return runGateCli(REPO_ROOT, SELF_REL, ['--root', dir, '--quiet'], dir);
                } finally {
                    fs.rmSync(dir, { recursive: true, force: true });
                }
            },
        },
    ];

    return runSelfTest({
        gate: 'lint_motion_authority_drift', cases, minCases: 12, minRejectCases: 6,
    });
}

if (process.argv[1] !== undefined) {
    const invoked = pathToFileURL(path.resolve(process.argv[1])).href;
    if (invoked === import.meta.url) process.exitCode = main();
}
