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
    main,
    watchable,
    watchablePages,
} from '../../src/scripts/check_host_docs_digest.js';
import { parseHostLowering } from '../../src/scripts/hooks/host_lowering.js';
import {
    PAGES_PSEUDO_HOST,
    applyDocsPageEdits,
    parseDocsPages,
} from '../../src/scripts/hooks/host_docs_pages.js';
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

    it('does not erase the recorded digest when the page is GONE', () => {
        // The state that means "this citation is dead" was the one state that
        // destroyed the evidence: `gone` fell through to the digest branch and
        // wrote `docs_digest: null`. Found by completion review, reproduced,
        // fixed — and pinned here, because the write-neutrality cases that
        // existed covered `unreachable` and `no-url` only, which is exactly how
        // a 19/19 green suite missed it.
        const dead = classify('claude', 'any', 'u', recorded('claude'), null, 'GONE HTTP 404');
        expect(dead.state).toBe('gone');
        const { text, expired, written } = applyFindings(SOURCE, [dead], TODAY);
        expect(written).toEqual([]);
        expect(expired).toEqual([]);
        expect(text).toBe(SOURCE);
        expect(parseHostLowering(text).get('claude')?.get('any')?.verified?.docs_digest).toBe(
            recorded('claude'),
        );
    });

    it('does not expire a row that cites no page at all', () => {
        const none = classify('cowork', 'any', null, null, null);
        expect(none.state).toBe('no-url');
        expect(applyFindings(SOURCE, [none], TODAY).text).toBe(SOURCE);
    });
});

// Asked for by both ratification reviewers, independently: the scheduled job
// runs `--fetch` with no `--write`, and the thing a reader most needs to be
// sure of is that this cannot touch the repository. The guard has two halves
// and both are checked here without a network call — the offline path, and the
// refusal of `--write` without `--fetch`. (The `--fetch`-only path shares the
// same single `writeFileSync`, which sits inside `if (doWrite)`.)
describe('docs digest — a read-only run never touches the tree', () => {
    let copy: string;

    beforeEach(() => {
        copy = path.join(tmp, 'host_lowering.yaml');
        fs.writeFileSync(copy, SOURCE);
    });

    it('leaves the table untouched in the default offline report', async () => {
        const code = await main(['--lowering', copy, '--quiet']);
        expect(code).toBe(0);
        expect(fs.readFileSync(copy, 'utf8')).toBe(SOURCE);
    });

    it('refuses `--write` without `--fetch` instead of silently writing nothing', async () => {
        const code = await main(['--write', '--lowering', copy, '--quiet']);
        expect(code).toBe(2);
        expect(fs.readFileSync(copy, 'utf8')).toBe(SOURCE);
    });

    it('refuses an unknown flag rather than ignoring it', async () => {
        // A silently-ignored flag is how `--lowering /nonexistent` once read the
        // real configuration and reported green in a sibling gate.
        expect(await main(['--not-a-flag'])).toBe(2);
    });
});

describe('docs digest — the write is surgical', () => {
    it('changes ONLY `expires` on drift — the recorded digest is evidence, not a cache', () => {
        // Two properties in one assertion, both found by completion review.
        //
        // PROVENANCE: writing the new body's hash while `docs_at` stays put
        // would make the row assert a reading that never happened.
        // PERSISTENCE: overwriting the digest would make the NEXT run compare
        // new-against-new and report `unchanged`, so the drift signal would
        // erase itself and a human who missed one red week would never learn.
        const drift = classify('claude', 'any', 'u', recorded('claude'), 'moved');
        const after = applyFindings(SOURCE, [drift], TODAY).text.split('\n');
        const before = SOURCE.split('\n');
        expect(after).toHaveLength(before.length);
        const changed = before.filter((l, i) => l !== after[i]);
        expect(changed).toHaveLength(1);
        expect(changed[0]).toContain('expires');
        expect(changed.join('\n')).not.toContain('docs_digest');
    });

    it('keeps reporting drift on a second run, because the digest was not overwritten', () => {
        const once = applyFindings(
            SOURCE,
            [classify('claude', 'any', 'u', recorded('claude'), 'moved')],
            TODAY,
        ).text;
        // The digest in the rewritten table is still the ORIGINAL one, so the
        // same body classifies as `changed` again rather than as `unchanged`.
        const stillRecorded = parseHostLowering(once).get('claude')?.get('any')?.verified?.docs_digest;
        expect(stillRecorded).toBe(recorded('claude'));
        expect(classify('claude', 'any', 'u', stillRecorded ?? null, 'moved').state).toBe('changed');
    });

    it('writes the digest on a FIRST fill, where there is no prior reading to contradict', () => {
        const blank = SOURCE.replace(
            `docs_digest: ${recorded('claude') ?? ''}`,
            'docs_digest: null',
        );
        const fill = classify('claude', 'any', 'u', null, 'a body');
        expect(fill.state).toBe('filled');
        const out = applyFindings(blank, [fill], TODAY);
        expect(out.missed).toEqual([]);
        expect(out.expired).toEqual([]);
        expect(out.text).toContain(`docs_digest: ${digestOf('a body')}`);
    });

    it('reports a row it could not write rather than claiming it recorded one', () => {
        // A `verified:` block with no `docs_digest:` key at all: the walk finds
        // nothing to rewrite. Before this, the run still said "newly recorded".
        const noKey = SOURCE.replace(`          docs_digest: ${recorded('claude') ?? ''}\n`, '');
        const out = applyFindings(noKey, [classify('claude', 'any', 'u', null, 'body')], TODAY);
        expect(out.written).toEqual([]);
        expect(out.missed).toEqual(['claude/any']);
    });

    it('does not treat an indent-8 comment as the end of the verified block', () => {
        // The copilot row carries long `#` comments at the row's own indent.
        // Treating one as the block end would silently stop the rewrite.
        const fill = classify('copilot', 'any', 'u', null, 'body');
        const out = applyFindings(SOURCE, [fill], TODAY);
        expect(out.missed).toEqual([]);
        expect(out.written).toEqual(['copilot/any']);
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

// The sibling page list — vendor pages this tree cites that are NOT a hook
// contract, and which therefore have no row in `host_lowering.yaml`.
//
// The failure it closes is an absence, so the first test is the one that
// matters: the page the listing model cites for every number in it must be ON
// the list. Before it was, a vendor could rewrite that contract and the only
// thing watching was the model's own prose.
describe('docs digest — the sibling page list', () => {
    const PAGES_FILE = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'host_docs_pages.yaml');
    const PAGES_SOURCE = fs.readFileSync(PAGES_FILE, 'utf8');

    it('watches the skills page the listing model reads every number off', () => {
        const pages = parseDocsPages(PAGES_SOURCE);
        const skills = pages.get('claude-code-skills');
        expect(skills).toBeDefined();
        // Not merely present — the URL must be the one the model cites, or the
        // watch is over a different page than the claim.
        const model = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'scripts', '_lib', 'host_listing_model.ts'),
            'utf8',
        );
        expect(model).toContain('code.claude.com/docs/en/skills');
        expect(skills!.docs_url).toContain('code.claude.com/docs/en/skills');
    });

    it('every row carries all four provenance fields, digest included', () => {
        for (const p of parseDocsPages(PAGES_SOURCE).values()) {
            expect(p.docs_url, `${p.id} has no url`).toMatch(/^https:\/\//);
            expect(p.docs_at, `${p.id} has no read date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(p.expires, `${p.id} has no review-by date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(p.docs_digest, `${p.id} cites a page with no digest`).toMatch(/^[0-9a-f]{64}$/);
            // A page nobody cites does not belong on the list, so the row has
            // to say what reads it.
            expect(p.why.length, `${p.id} has no reason`).toBeGreaterThan(40);
        }
    });

    it('the watcher ranks the list beside the table, under a label that is not a host', () => {
        const rows = watchablePages(parseDocsPages(PAGES_SOURCE));
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) expect(r.host).toBe(PAGES_PSEUDO_HOST);
        // `pages` must not collide with a real host, or a finding would be
        // written back into the wrong file by the wrong writer.
        const hosts = new Set(watchable(parseHostLowering(SOURCE)).map((r) => r.host));
        expect(hosts.has(PAGES_PSEUDO_HOST)).toBe(false);
    });

    it('a FILLED page gets its digest; a CHANGED page keeps it and loses `expires`', () => {
        const filled = applyDocsPageEdits(PAGES_SOURCE, [
            { id: 'claude-code-skills', digest: 'a'.repeat(64) },
        ]);
        expect(filled.written).toEqual(['claude-code-skills']);
        expect(parseDocsPages(filled.text).get('claude-code-skills')!.docs_digest).toBe('a'.repeat(64));

        const drifted = applyDocsPageEdits(PAGES_SOURCE, [
            { id: 'claude-code-skills', expires: '2026-10-12' },
        ]);
        expect(drifted.expired).toEqual(['claude-code-skills']);
        const row = parseDocsPages(drifted.text).get('claude-code-skills')!;
        expect(row.expires).toBe('2026-10-12');
        // The recorded digest is EVIDENCE of what the page was, not a cache.
        // Erasing it on drift would make a page that later returned classify as
        // `filled` and lose the signal permanently — the exact defect the
        // sibling writer's `gone` skip-list was added to close.
        expect(row.docs_digest).toBe(parseDocsPages(PAGES_SOURCE).get('claude-code-skills')!.docs_digest);
    });

    it('the write is surgical — one line, and never a sibling row', () => {
        const before = PAGES_SOURCE.split('\n');
        const after = applyDocsPageEdits(PAGES_SOURCE, [
            { id: 'claude-code-skills', expires: '2026-10-12' },
        ]).text.split('\n');
        expect(after.length).toBe(before.length);
        expect(before.reduce((n, l, i) => (l === after[i] ? n : n + 1), 0)).toBe(1);
    });

    it('a row the walk cannot find is REPORTED, never silently reported as written', () => {
        const out = applyDocsPageEdits(PAGES_SOURCE, [{ id: 'no-such-page', digest: 'b'.repeat(64) }]);
        expect(out.missed).toEqual(['no-such-page']);
        expect(out.written).toEqual([]);
        expect(out.text).toBe(PAGES_SOURCE);
    });

    it('refuses a malformed row rather than working around it', () => {
        const bad = (body: string): (() => unknown) => (): unknown => parseDocsPages(body);
        expect(bad('pages:\n  x:\n    docs_url: http://insecure\n    docs_at: 2026-01-01\n    expires: 2027-01-01\n    why: because\n')).toThrow(/https/);
        expect(bad('pages:\n  x:\n    docs_url: https://a\n    docs_at: nope\n    expires: 2027-01-01\n    why: because\n')).toThrow(/docs_at/);
        expect(bad('pages:\n  x:\n    docs_url: https://a\n    docs_at: 2026-01-01\n    docs_digest: short\n    expires: 2027-01-01\n    why: because\n')).toThrow(/64 hex/);
        // An EMPTY list is refused, not reported clean: a watcher over zero
        // rows is indistinguishable from a watcher that works.
        expect(bad('pages: {}\n')).toThrow(/empty/);
    });

    it('the offline report succeeds with the page corpus wired in and writes nothing', async () => {
        const out: string[] = [];
        const write = process.stdout.write.bind(process.stdout);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (process.stdout as any).write = (s: string): boolean => {
            out.push(String(s));
            return true;
        };
        try {
            expect(await main(['--quiet', '--today', TODAY])).toBe(0);
        } finally {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (process.stdout as any).write = write;
        }
        // `--quiet` suppresses the per-row lines; what must hold is that the
        // run SUCCEEDS with the second corpus wired in, offline and unwritten.
        expect(fs.readFileSync(PAGES_FILE, 'utf8')).toBe(PAGES_SOURCE);
    });
});
