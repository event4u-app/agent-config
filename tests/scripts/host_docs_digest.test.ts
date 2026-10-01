// Phase 1.3 — the docs-drift watcher, end to end.
//
// WHAT THIS TEST IS ACTUALLY FOR. The watcher's value is not that it computes a
// sha256; it is that a changed vendor page REACHES `lint_hook_manifest` and reds
// it on a host that carries a blocking binding. That is a three-step chain —
// digest differs → `expires` moves → the expiry gate refuses — and every step
// but the last lives in a different file from the gate. A test that stopped at
// "the digest changed" would be watching the cheap half.
//
// So the assertions below run the REAL gate over the text the REAL writer
// produced, with no fixture of the intermediate state. The only thing injected
// is the fetched body, because that is the one input a test may not reach.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    applyFindings,
    classify,
    dayBefore,
    digestOf,
    watchable,
} from '../../src/scripts/check_host_docs_digest.js';
import { parseHostLowering } from '../../src/scripts/hooks/host_lowering.js';
import { _check_host_lowering } from '../../src/scripts/lint_hook_manifest.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const COMMITTED = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'host_lowering.yaml');
const TODAY = '2026-10-01';

const SOURCE = fs.readFileSync(COMMITTED, 'utf8');

let tmp: string;

/** Run the real expiry gate over a table given as text. */
function gate(text: string): { errors: string[]; warnings: string[] } {
    const file = path.join(tmp, 'table.yaml');
    fs.writeFileSync(file, text);
    const errors: string[] = [];
    const warnings: string[] = [];
    _check_host_lowering(file, errors, warnings, TODAY);
    return { errors, warnings };
}

/** The digest the committed table records for a host. */
function recorded(host: string): string | null {
    return parseHostLowering(SOURCE).get(host)?.get('any')?.verified?.docs_digest ?? null;
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'host-digest-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('docs digest — the committed state', () => {
    it('records a digest for every row that cites a page', () => {
        for (const r of watchable(parseHostLowering(SOURCE))) {
            if (r.url === null) continue;
            expect(r.digest, `${r.host} cites ${r.url} with no digest`).toMatch(/^[0-9a-f]{64}$/);
        }
    });

    it('records no digest for the row that cites no page', () => {
        // `cowork` has no public hooks page. A digest there would be invented.
        const cowork = watchable(parseHostLowering(SOURCE)).find((r) => r.host === 'cowork');
        expect(cowork?.url).toBeNull();
        expect(cowork?.digest).toBeNull();
    });
});

describe('docs digest — drift reaches the gate', () => {
    it('reds lint_hook_manifest on a host whose page moved AND which can block', () => {
        // `claude` is the one host carrying blocking bindings, so it is the one
        // host where drift must be a refusal rather than a note.
        const drift = classify('claude', 'any', 'u', recorded('claude'), 'the page was rewritten');
        expect(drift.state).toBe('changed');

        const { text, expired } = applyFindings(SOURCE, [drift], TODAY);
        expect(expired).toEqual(['claude/any']);

        const { errors } = gate(text);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('host_lowering claude/any');
        expect(errors[0]).toContain(dayBefore(TODAY));
        expect(errors[0]).toContain('pre_tool_use');
    });

    it('expires to the day BEFORE detection, because the gate tests `expires < today`', () => {
        // Pinning the off-by-one explicitly: `expires: TODAY` would still be
        // valid today and the refusal would not land until tomorrow, which is
        // the whole failure this one-day offset exists to prevent.
        const drift = classify('claude', 'any', 'u', recorded('claude'), 'moved');
        const sameDay = applyFindings(SOURCE, [drift], TODAY).text.replace(
            `expires: ${dayBefore(TODAY)}`,
            `expires: ${TODAY}`,
        );
        expect(gate(sameDay).errors).toEqual([]);
        expect(gate(applyFindings(SOURCE, [drift], TODAY).text).errors).toHaveLength(1);
    });

    it('only warns when the drifting host carries no blocking binding', () => {
        // The property that keeps a vendor's CSS rebuild from redding an
        // unrelated pull request: `cursor` binds five slots and can refuse on
        // none of them, so its drift is a note, not a refusal.
        const drift = classify('cursor', 'any', 'u', recorded('cursor'), 'moved');
        const { errors, warnings } = gate(applyFindings(SOURCE, [drift], TODAY).text);
        expect(errors).toEqual([]);
        expect(warnings.some((w) => w.includes('host_lowering cursor/any'))).toBe(true);
    });

    it('classifies an equal body as unchanged', () => {
        const body = 'the page, unmoved';
        expect(classify('claude', 'any', 'u', digestOf(body), body).state).toBe('unchanged');
        expect(classify('claude', 'any', 'u', recorded('claude'), body).state).toBe('changed');
    });

    it('leaves the table byte-identical when nothing moved', () => {
        // The finding is written out literally rather than via `classify`,
        // because producing it through `classify` would need a body that hashes
        // to the COMMITTED digest — i.e. the live page, which a unit test may
        // not reach. This is exactly the record `classify` emits when the
        // fetched body still matches: `now === was === the recorded digest`.
        const digest = recorded('claude');
        expect(digest).not.toBeNull();
        const { text, expired } = applyFindings(
            SOURCE,
            [{ host: 'claude', surface: 'any', url: 'u', state: 'unchanged', was: digest, now: digest }],
            TODAY,
        );
        expect(expired).toEqual([]);
        // A no-op run must produce no commit — the property that keeps a daily
        // scheduled job from writing a diff every morning.
        expect(text).toBe(SOURCE);
        expect(gate(text).errors).toEqual([]);
    });
});

describe('docs digest — unreachable establishes nothing', () => {
    it('does not expire a row when the page could not be read', () => {
        const dead = classify('claude', 'any', 'u', recorded('claude'), null, 'HTTP 503');
        expect(dead.state).toBe('unreachable');
        const { text, expired } = applyFindings(SOURCE, [dead], TODAY);
        expect(expired).toEqual([]);
        expect(text).toBe(SOURCE);
        expect(gate(text).errors).toEqual([]);
    });

    it('does not expire a row that cites no page at all', () => {
        const none = classify('cowork', 'any', null, null, null);
        expect(none.state).toBe('no-url');
        expect(applyFindings(SOURCE, [none], TODAY).text).toBe(SOURCE);
    });
});

describe('docs digest — the write is surgical', () => {
    it('changes only the lines whose content changed', () => {
        const drift = classify('claude', 'any', 'u', recorded('claude'), 'moved');
        const after = applyFindings(SOURCE, [drift], TODAY).text.split('\n');
        const before = SOURCE.split('\n');
        expect(after).toHaveLength(before.length);
        const changed = before.filter((l, i) => l !== after[i]);
        expect(changed).toHaveLength(2);
        expect(changed.join('\n')).toContain('docs_digest');
        expect(changed.join('\n')).toContain('expires');
    });

    it('does not touch a sibling host', () => {
        const drift = classify('claude', 'any', 'u', recorded('claude'), 'moved');
        const text = applyFindings(SOURCE, [drift], TODAY).text;
        const table = parseHostLowering(text);
        expect(table.get('gemini')?.get('any')?.verified?.expires).toBe('2027-09-29');
        expect(table.get('gemini')?.get('any')?.verified?.docs_digest).toBe(recorded('gemini'));
    });

    it('preserves the comments that carry the findings', () => {
        const drift = classify('claude', 'any', 'u', recorded('claude'), 'moved');
        const text = applyFindings(SOURCE, [drift], TODAY).text;
        expect(text).toContain('WHY THIS FILE EXISTS');
        expect(text).toContain('THE FINDING THIS ROW CARRIES');
        // The hand-aligned flow mappings are not this watcher's to reformat.
        expect(text).toContain('stop:               { native: Stop,              block_exit: 2,');
    });
});
