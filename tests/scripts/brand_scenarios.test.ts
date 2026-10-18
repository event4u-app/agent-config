// road-to-a-brand-the-tree-can-check 7.2 — scenario fixtures with deterministic
// legs. Each leg runs the real readers (`brand:status`, `check_voice_lexicon`,
// the design-tokens `validate` palette reading) over a scratch project and
// asserts one observable property. The "sounds like us" leg is not here: it
// stays a labelled rubric, because no deterministic reader can judge it (NG-1).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runBrandStatus } from '../../src/scripts/_cli/cmd_brand_status.js';
import { checkDraft, lexiconFromSlot, claimsFromSlot, scanClaims, scanLexicon } from '../../src/scripts/check_voice_lexicon.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TOKENS_TS = path.join(REPO_ROOT, 'src', 'skills', 'design-tokens', 'scripts', 'tokens.ts');
const LEXICON_TS = path.join(REPO_ROOT, 'src', 'scripts', 'check_voice_lexicon.ts');
const NOW = new Date('2026-10-19T12:00:00Z');
const SLOT = 'agents/context-spine/brand-voice.md';

const AVOID_TERM = 'quillify';
const TOKENS = JSON.stringify({
    color: {
        $type: 'color',
        brand: { $value: { colorSpace: 'srgb', components: [1, 0, 0], hex: '#ff0000' } },
        sampled: { $value: '#fe0101' },
    },
});

function slot(opts: { avoid?: string; claimExpires?: string } = {}): string {
    return [
        '---',
        'version: 2',
        'attributes:',
        '  - { is: warm, is_not: gushing, proof: "thanks once" }',
        '  - { is: precise, is_not: pedantic, proof: "units" }',
        '  - { is: direct, is_not: curt, proof: "answer first" }',
        'avoid:',
        `  - { term: ${opts.avoid ?? AVOID_TERM}, match: word, note: "say what it does" }`,
        'claims:',
        `  - { text: "zero downtime since 2024", evidence_ref: docs/uptime.md, expires: ${opts.claimExpires ?? '2027-01-01'} }`,
        'provenance:',
        '  sources: [{ ref: docs/voice.md, tier: authoritative }]',
        '  confidence: med',
        '  last_reviewed_at: 2026-10-01',
        '---',
        '# Voice',
        '',
    ].join('\n');
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-scenarios-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function project(name: string, files: Record<string, string>): string {
    const root = path.join(tmp, name);
    for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body, 'utf-8');
    }
    fs.mkdirSync(root, { recursive: true });
    return root;
}

function snapshot(root: string): Record<string, string> {
    const out: Record<string, string> = {};
    const walk = (dir: string): void => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walk(p);
            else out[path.relative(root, p)] = createHash('sha256').update(fs.readFileSync(p)).digest('hex');
        }
    };
    walk(root);
    return out;
}

interface Status {
    state: string;
    qualifiers: string[];
    tokens_file: string | null;
    sources: Array<{ path: string; kind: string; status: string; winner?: string }>;
    voice: { read: boolean };
    near_misses?: string[];
}

function status(root: string): { json: Status; text: string; all: string } {
    const json = runBrandStatus({ cwd: root, json: true, now: NOW }).out.join('\n');
    const text = runBrandStatus({ cwd: root, json: false, now: NOW }).out.join('\n');
    return { json: JSON.parse(json) as Status, text, all: `${json}\n${text}` };
}

function run(bin: string, script: string, args: string[], input?: string): { status: number | null; stdout: string } {
    const r = spawnSync(bin, [script, ...args], { encoding: 'utf8', cwd: REPO_ROOT, input });
    return { status: r.status, stdout: r.stdout };
}

describe('brand scenarios — the resolver', () => {
    it('existing brand: every reader leaves the project byte for byte unchanged and adds no file', () => {
        const root = project('branded', { 'tokens.json': TOKENS, [SLOT]: slot(), 'DESIGN.md': '# DESIGN.md\n', 'src/a.css': '.a { color: #ff0000; }\n' });
        const before = snapshot(root);
        expect(status(root).json.state).toBe('branded');
        run(TSX, TOKENS_TS, ['validate', '--dir', path.join(root, 'src'), '--json', '--tokens', path.join(root, 'tokens.json')]);
        run(TSX, LEXICON_TS, ['--draft', '-', '--slot', path.join(root, SLOT)], 'Plain text.\n');
        expect(snapshot(root)).toEqual(before);
    });

    it('greenfield: no source is bare, exits 0, and names no file', () => {
        const root = project('greenfield', {});
        const s = status(root);
        expect(s.json.state).toBe('bare');
        expect(s.json.sources).toEqual([]);
        expect(runBrandStatus({ cwd: root, json: false, now: NOW }).code).toBe(0);
    });

    it('dotted near-miss: a .tokens.json is flagged and never becomes the brand', () => {
        const root = project('dotted', { '.tokens.json': TOKENS });
        const s = status(root);
        expect(s.json.tokens_file).toBeNull();
        expect(s.json.state).toBe('bare');
        expect(s.all).toContain('.tokens.json');
    });

    it('shadowed and duplicate: a different second file is shadowed with its winner, an identical one a duplicate', () => {
        const shadowed = status(project('shadowed', { 'tokens.json': TOKENS, 'assets/tokens.json': JSON.stringify({ c: { $value: '#000' } }) }));
        expect(shadowed.json.sources.map((x) => x.status)).toEqual(['valid', 'shadowed']);
        expect(shadowed.json.sources[1]?.winner).toBe('tokens.json');
        expect(shadowed.json.qualifiers).toContain('shadowed');
        const duplicate = status(project('duplicate', { 'tokens.json': TOKENS, 'assets/tokens.json': TOKENS }));
        expect(duplicate.json.sources.map((x) => x.status)).toEqual(['valid', 'duplicate']);
        expect(duplicate.json.qualifiers).not.toContain('shadowed');
    });

    it('tokens without voice and voice without tokens are both mixed; both together are branded', () => {
        expect(status(project('tokens-only', { 'tokens.json': TOKENS })).json.state).toBe('mixed');
        expect(status(project('voice-only', { [SLOT]: slot() })).json.state).toBe('mixed');
        expect(status(project('both', { 'tokens.json': TOKENS, [SLOT]: slot() })).json.state).toBe('branded');
    });

    it('exploration without lock: asking the resolver persists nothing — no registry, no cache, no lock file', () => {
        const root = project('explore', { 'tokens.json': TOKENS });
        const before = Object.keys(snapshot(root));
        status(root);
        status(root);
        expect(Object.keys(snapshot(root))).toEqual(before);
    });

    it('profile text excluded: a ghostwriter profile is never a brand source and none of its text is reported', () => {
        const profile = '---\nversion: 1\nfictional: true\ntaboos:\n  - "velvetine"\n---\nVoice of a fictional author.\n';
        const root = project('profile', { 'agents/reference/ghostwriter/fictional.md': profile });
        const s = status(root);
        expect(s.json.state).toBe('bare');
        expect(s.json.sources).toEqual([]);
        expect(s.all).not.toContain('velvetine');
        expect(s.all).not.toContain('fictional author');
    });

    it('project switch: a stale slot in the previous project leaks no voice into the next', () => {
        const a = project('a', { [SLOT]: slot() });
        const b = project('b', { 'tokens.json': TOKENS });
        expect(status(a).json.voice.read).toBe(true);
        const sb = status(b);
        expect(sb.json.voice.read).toBe(false);
        expect(sb.all).not.toContain(AVOID_TERM);
        const r = run(TSX, LEXICON_TS, ['--draft', '-'], `We ${AVOID_TERM} everything.\n`);
        expect(r.stdout).toMatch(/lexicon: SKIPPED/);
        expect(r.stdout).not.toMatch(new RegExp(`avoid "${AVOID_TERM}"`));
    });
});

describe('brand scenarios — the palette', () => {
    it('similar sampled colours are never merged: each literal tags its own token', () => {
        const root = project('palette', { 'tokens.json': TOKENS, 'src/a.css': '.a { color: #ff0000; }\n.b { color: #fe0101; }\n' });
        const r = run(TSX, TOKENS_TS, ['validate', '--dir', path.join(root, 'src'), '--json', '--tokens', path.join(root, 'tokens.json')]);
        const found = JSON.parse(r.stdout) as Array<{ line: number; palette?: string }>;
        expect(found.map((f) => [f.line, f.palette])).toEqual([
            [1, 'on-palette (color.brand)'],
            [2, 'on-palette (color.sampled)'],
        ]);
    });
});

describe('brand scenarios — the draft', () => {
    const terms = lexiconFromSlot(slot({ avoid: 'Synergie' }));

    it('lexicon recall: every planted avoid term is found, and none of its quoted, cited or fenced twins is', () => {
        const planted = [
            { term: 'synergy', match: 'word' as const },
            { term: 'leverag', match: 'substring' as const },
            { term: 'game-changer', match: 'word' as const },
            { term: 'world class', match: 'word' as const },
            { term: 'Einzigartig', match: 'word' as const },
        ];
        const lexicon = planted.map((p) => ({ ...p, source: 'brand' as const }));
        const running = ['Our synergy works.', 'We are leveraging it.', 'A real Game-Changer.', 'It is world class.', 'Wirklich einzigartig.'];
        const twins = ['They said "synergy".', '> We are leveraging it.', '`game-changer`', 'See https://x.test/world-class', '„Einzigartig“'];
        const draft = [...running, ...twins, '```', 'synergy inside a fence', '```', ''].join('\n');
        const found = scanLexicon(draft, lexicon);
        expect(found.map((f) => f.line)).toEqual([1, 2, 3, 4, 5]);
        expect(new Set(found.map((f) => f.text.toLowerCase()))).toHaveProperty('size', planted.length);
    });

    it('unbacked superlative: a located finding that says it needs proof', () => {
        const found = scanClaims('Intro.\nWe are the industry-leading importer.\n', claimsFromSlot(slot()), NOW);
        expect(found).toEqual([expect.objectContaining({ kind: 'unbacked-claim', line: 2, claim_class: 'superlative' })]);
        expect(found[0]?.note).toMatch(/needs proof/);
    });

    it('expired claim: a claims[] entry past its day no longer backs the sentence', () => {
        const draft = 'Zero downtime since 2024, guaranteed.\n';
        expect(scanClaims(draft, claimsFromSlot(slot()), NOW)).toEqual([]);
        const expired = scanClaims(draft, claimsFromSlot(slot({ claimExpires: '2026-01-01' })), NOW);
        expect(expired[0]?.note).toMatch(/expired 2026-01-01/);
    });

    it('quoted banned term is exempt; the same term in running text is found', () => {
        const draft = ['They called it "Synergie".', '> Synergie is their word.', 'Our Synergie is real.', ''].join('\n');
        expect(scanLexicon(draft, terms).map((f) => f.line)).toEqual([3]);
    });

    it('German inflection is a documented miss of literal matching (E5)', () => {
        expect(scanLexicon('Wir nutzen Synergien.\n', terms)).toEqual([]);
        expect(scanLexicon('Wir nutzen Synergie.\n', terms)).toHaveLength(1);
    });

    it('brand findings never fail the draft', () => {
        const brandOnly = checkDraft('The industry-leading Synergie.\n', { terms, claims: [], tellExemptions: [], now: NOW });
        expect(brandOnly.findings.length).toBeGreaterThan(0);
        expect(brandOnly.findings.every((f) => f.severity !== 'error')).toBe(true);
    });
});

describe('brand scenarios — zero brand bytes off-brand', () => {
    // The dynamic leg — every bound concern run against a fully branded
    // fixture — is 0.6's `tests/scripts/hooks/no_brand_bytes.test.ts`. This leg
    // pins the static half: no hook concern reaches the readers this roadmap
    // added, so a non-brand task cannot pick their output up through a hook.
    it('non-brand task: no hook concern binds brand:status, the lexicon checker or the voice slot', () => {
        const manifest = fs.readFileSync(path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'), 'utf8');
        for (const reader of ['brand_status', 'brand:status', 'check_voice_lexicon', 'brand-voice']) {
            expect(manifest).not.toContain(reader);
        }
    });
});
