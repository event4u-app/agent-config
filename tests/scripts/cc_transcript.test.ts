// Unit tests for the Claude Code transcript reader (`_lib/cc_transcript.ts`).
//
// Fixture mirrors the real `~/.claude/projects/<project>/` shape observed on
// this repo's own transcripts: a flat `<sessionId>.jsonl` next to a
// `<sessionId>/subagents/agent-*.jsonl` directory. `message.id` + `requestId`
// pairs are deduped across files (record B is written twice, once per file,
// to exercise exactly that replay path — real Claude Code sessions were
// observed replaying the same turn into multiple transcript files at a
// measured 50.8% rate on this repo's data).
//
// Every expected sum below is computed from the fixture record constants at
// the top of the file, never copied from a run.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    aggregateByBucket,
    billableInputTokens,
    derivedBytes,
    listTranscriptFiles,
    measureBytesPerToken,
    measureContentBytes,
    scanToolResults,
    scanTranscripts,
    weightedInputUnits,
    type TranscriptRecord,
} from '../../src/scripts/_lib/cc_transcript.js';

const _tmpDirs: string[] = [];

function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-transcript-'));
    _tmpDirs.push(d);
    return d;
}

afterEach(() => {
    while (_tmpDirs.length > 0) {
        const d = _tmpDirs.pop();
        if (d) fs.rmSync(d, { recursive: true, force: true });
    }
});

function appendJsonl(filePath: string, records: readonly Record<string, unknown>[]): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

// ── Fixture record constants ──────────────────────────────────────────
// Case (c): REC_A is a first call — cache_read_input_tokens is 0.
const REC_A = {
    type: 'assistant',
    isSidechain: false,
    requestId: 'req_A',
    timestamp: '2026-07-30T10:00:00.000Z',
    message: {
        id: 'msg_A',
        model: 'claude-sonnet-4-5',
        usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    },
};

// REC_B is written into BOTH the main session file and the subagent file
// with an identical (message.id, requestId) pair — case (a), the replay.
const REC_B = {
    type: 'assistant',
    isSidechain: false,
    requestId: 'req_B',
    timestamp: '2026-07-30T10:01:00.000Z',
    message: {
        id: 'msg_B',
        model: 'claude-sonnet-4-5',
        usage: { input_tokens: 500, output_tokens: 150, cache_read_input_tokens: 300, cache_creation_input_tokens: 0 },
    },
};

// Case (b): agentId + isSidechain both present → subagent leg.
const REC_C = {
    type: 'assistant',
    isSidechain: true,
    agentId: 'agent-x',
    requestId: 'req_C',
    timestamp: '2026-07-30T10:02:00.000Z',
    message: {
        id: 'msg_C',
        model: 'claude-haiku-4-5',
        usage: { input_tokens: 800, output_tokens: 100, cache_read_input_tokens: 200, cache_creation_input_tokens: 0 },
    },
};

// Case (d): cache_creation carries BOTH ephemeral_5m and ephemeral_1h.
const REC_D = {
    type: 'assistant',
    isSidechain: false,
    requestId: 'req_D',
    timestamp: '2026-07-30T10:03:00.000Z',
    message: {
        id: 'msg_D',
        model: 'claude-sonnet-4-5',
        usage: {
            input_tokens: 50,
            output_tokens: 20,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 900,
            cache_creation: { ephemeral_5m_input_tokens: 600, ephemeral_1h_input_tokens: 300 },
        },
    },
};

// A non-assistant / no-usage line that must never surface as a record.
const NOISE_USER_RECORD = { type: 'user', isSidechain: false, message: { role: 'user', content: 'hi' } };

function writeFixtureProject(root: string): { projectDir: string } {
    const projectDir = path.join(root, 'proj');
    appendJsonl(path.join(projectDir, 'session1.jsonl'), [REC_A, REC_B, NOISE_USER_RECORD, REC_D]);
    appendJsonl(path.join(projectDir, 'session1', 'subagents', 'agent-x.jsonl'), [REC_B, REC_C]);
    return { projectDir };
}

describe('scanTranscripts — dedup', () => {
    it('a replayed (message.id, requestId) pair across two files dedupes to one record', () => {
        const root = mkTmp();
        writeFixtureProject(root);

        const written = [REC_A, REC_B, REC_D, REC_B, REC_C]; // main file (minus noise) + subagent file
        const uniqueKeys = new Set(written.map((r) => `${r.message.id} ${r.requestId}`));

        const result = scanTranscripts({ root });

        expect(result.totalSeen).toBe(written.length);
        expect(result.dedupedCount).toBe(uniqueKeys.size);
        expect(result.records).toHaveLength(uniqueKeys.size);
        expect(result.dedup_ratio).toBeCloseTo((written.length - uniqueKeys.size) / written.length, 12);

        // The replay must not be double-counted: exactly one msg_B survives.
        expect(result.records.filter((r) => r.model === 'claude-sonnet-4-5' && r.usage.input_tokens === REC_B.message.usage.input_tokens && r.usage.cache_read_input_tokens === 300)).toHaveLength(1);
    });

    it('a non-assistant / no-usage line is never counted', () => {
        const root = mkTmp();
        writeFixtureProject(root);
        const result = scanTranscripts({ root });
        // 5 written qualifying lines (A, B, D, B-dup, C) vs 6 lines total incl. the noise record.
        expect(result.totalSeen).toBe(5);
    });
});

describe('scanTranscripts — bucket classification', () => {
    it('isSidechain + agentId together classify as subagent; everything else is main', () => {
        const root = mkTmp();
        writeFixtureProject(root);
        const { records } = scanTranscripts({ root });

        const byId = new Map(records.map((r) => [r.model + '|' + r.usage.input_tokens, r]));
        const recC = records.find((r) => r.agentId === 'agent-x');
        expect(recC).toBeDefined();
        expect(recC?.bucket).toBe('subagent');

        for (const r of records) {
            if (r.agentId === 'agent-x') continue;
            expect(r.bucket).toBe('main');
        }
        expect(byId.size).toBeGreaterThan(0); // sanity: map actually populated
    });
});

describe('aggregateByBucket', () => {
    it('sums per bucket and derives read_share + weighted_input_units from the raw fixture fields', () => {
        const root = mkTmp();
        writeFixtureProject(root);
        const { records } = scanTranscripts({ root });
        const buckets = aggregateByBucket(records);

        // main = {A, B, D} (deduped) — derived directly from the fixture constants.
        const mainInput = REC_A.message.usage.input_tokens + REC_B.message.usage.input_tokens + REC_D.message.usage.input_tokens;
        const mainCacheRead = REC_A.message.usage.cache_read_input_tokens + REC_B.message.usage.cache_read_input_tokens + REC_D.message.usage.cache_read_input_tokens;
        const mainCacheCreation = REC_A.message.usage.cache_creation_input_tokens + REC_B.message.usage.cache_creation_input_tokens + REC_D.message.usage.cache_creation_input_tokens;
        const mainOutput = REC_A.message.usage.output_tokens + REC_B.message.usage.output_tokens + REC_D.message.usage.output_tokens;
        const mainEph5m = REC_D.message.usage.cache_creation.ephemeral_5m_input_tokens;
        const mainEph1h = REC_D.message.usage.cache_creation.ephemeral_1h_input_tokens;
        const mainBillable = mainInput + mainCacheRead + mainCacheCreation;
        const mainReadShare = mainCacheRead / mainBillable;
        const mainWeighted = mainInput * 1.0 + mainCacheRead * 0.1 + mainEph5m * 1.25 + mainEph1h * 2.0;

        expect(buckets.main.calls).toBe(3);
        expect(buckets.main.input_tokens).toBe(mainInput);
        expect(buckets.main.cache_read_input_tokens).toBe(mainCacheRead);
        expect(buckets.main.cache_creation_input_tokens).toBe(mainCacheCreation);
        expect(buckets.main.output_tokens).toBe(mainOutput);
        expect(buckets.main.ephemeral_5m_input_tokens).toBe(mainEph5m);
        expect(buckets.main.ephemeral_1h_input_tokens).toBe(mainEph1h);
        expect(buckets.main.read_share).toBeCloseTo(mainReadShare, 12);
        expect(buckets.main.weighted_input_units).toBeCloseTo(mainWeighted, 12);
        expect(billableInputTokens(buckets.main)).toBe(mainBillable);

        // subagent = {C} only.
        const subInput = REC_C.message.usage.input_tokens;
        const subCacheRead = REC_C.message.usage.cache_read_input_tokens;
        const subWeighted = subInput * 1.0 + subCacheRead * 0.1;

        expect(buckets.subagent.calls).toBe(1);
        expect(buckets.subagent.input_tokens).toBe(subInput);
        expect(buckets.subagent.cache_read_input_tokens).toBe(subCacheRead);
        expect(buckets.subagent.read_share).toBeCloseTo(subCacheRead / (subInput + subCacheRead), 12);
        expect(buckets.subagent.weighted_input_units).toBeCloseTo(subWeighted, 12);
    });

    it('cache_creation beyond the known 5m/1h split is treated as a 5m write, never dropped', () => {
        const unaccounted = weightedInputUnits({
            input_tokens: 0,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 100,
            output_tokens: 0,
            ephemeral_5m_input_tokens: 0,
            ephemeral_1h_input_tokens: 0,
        });
        expect(unaccounted).toBeCloseTo(100 * 1.25, 12);
    });

    it('zero-call bucket stays all-zero, never NaN or divide-by-zero', () => {
        const buckets = aggregateByBucket([]);
        expect(buckets.main.calls).toBe(0);
        expect(buckets.main.read_share).toBe(0);
        expect(buckets.main.weighted_input_units).toBe(0);
        expect(buckets.subagent.calls).toBe(0);
    });
});

describe('listTranscriptFiles — root / projectDir / maxAgeDays', () => {
    it('finds jsonl files recursively, including under a nested subagents/ dir', () => {
        const root = mkTmp();
        const { projectDir } = writeFixtureProject(root);
        const files = listTranscriptFiles({ root });
        expect(files).toContain(path.join(projectDir, 'session1.jsonl'));
        expect(files).toContain(path.join(projectDir, 'session1', 'subagents', 'agent-x.jsonl'));
    });

    it('projectDir filter narrows the walk to one project subdirectory', () => {
        const root = mkTmp();
        writeFixtureProject(root); // -> root/proj/...
        appendJsonl(path.join(root, 'other-proj', 'session2.jsonl'), [REC_A]);

        const filtered = listTranscriptFiles({ root, projectDir: 'proj' });
        expect(filtered.every((f) => f.includes(`${path.sep}proj${path.sep}`))).toBe(true);
        expect(filtered.some((f) => f.includes('other-proj'))).toBe(false);
    });

    it('maxAgeDays excludes files older than the cutoff', () => {
        const root = mkTmp();
        const { projectDir } = writeFixtureProject(root);
        const staleFile = path.join(projectDir, 'session1.jsonl');
        const old = new Date('2020-01-01T00:00:00.000Z');
        fs.utimesSync(staleFile, old, old);

        const now = new Date('2026-07-30T00:00:00.000Z');
        const files = listTranscriptFiles({ root, maxAgeDays: 7, now });
        expect(files).not.toContain(staleFile);
        expect(files).toContain(path.join(projectDir, 'session1', 'subagents', 'agent-x.jsonl'));
    });
});

// -- Byte measurement (road-to-a-bytes-row-that-exists, Phase 2) -------
//
// The whole point of these is that NO ratio is hardcoded anywhere: every
// expected value below is computed from the fixture's own content, which is
// what "measured on the fixture, never assumed" has to mean to be checkable.

function rec(outputTokens: number, contentBytes: number | null): TranscriptRecord {
    return {
        bucket: 'main',
        agentId: null,
        model: 'm',
        timestamp: null,
        usage: {
            input_tokens: 0,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
            output_tokens: outputTokens,
            ephemeral_5m_input_tokens: 0,
            ephemeral_1h_input_tokens: 0,
        },
        content_bytes: contentBytes,
    };
}

describe('measureContentBytes - bytes, not characters, and null is not zero', () => {
    it('measures an array content block as its serialised UTF-8 length', () => {
        const content = [{ type: 'text', text: 'hello' }];
        expect(measureContentBytes({ message: { content } })).toBe(
            Buffer.byteLength(JSON.stringify(content), 'utf8'),
        );
    });

    it('measures a bare-string content directly', () => {
        expect(measureContentBytes({ message: { content: 'abc' } })).toBe(3);
    });

    it('counts BYTES for a multibyte payload - a char count would under-report', () => {
        const text = '\u{1F642} Gr\u00fc\u00dfe';
        const got = measureContentBytes({ message: { content: text } });
        expect(got).toBe(Buffer.byteLength(text, 'utf8'));
        expect(got).toBeGreaterThan(text.length);
    });

    it('returns null - never 0 - when the record carries no content', () => {
        expect(measureContentBytes({ message: { usage: {} } })).toBeNull();
    });
});

describe('scanTranscripts - byte measurement is OPT-IN', () => {
    it('leaves content_bytes null when measureBytes is not asked for', () => {
        const root = mkTmp();
        appendJsonl(path.join(root, 'proj', 's.jsonl'), [REC_A]);
        const { records } = scanTranscripts({ root });
        expect(records).toHaveLength(1);
        expect(records[0]?.content_bytes).toBeNull();
    });

    it('fills content_bytes from the record itself when asked', () => {
        const root = mkTmp();
        const content = [{ type: 'text', text: 'measured, not assumed' }];
        appendJsonl(path.join(root, 'proj', 's.jsonl'), [
            { ...REC_A, message: { ...REC_A.message, content } },
        ]);
        const { records } = scanTranscripts({ root, measureBytes: true });
        expect(records[0]?.content_bytes).toBe(Buffer.byteLength(JSON.stringify(content), 'utf8'));
    });

    it('leaves the token columns byte-identical whether or not bytes are measured', () => {
        const root = mkTmp();
        const content = [{ type: 'text', text: 'x'.repeat(97) }];
        appendJsonl(path.join(root, 'proj', 's.jsonl'), [
            { ...REC_A, message: { ...REC_A.message, content } },
            REC_C,
        ]);
        const plain = scanTranscripts({ root });
        const withBytes = scanTranscripts({ root, measureBytes: true });
        expect(JSON.stringify(withBytes.records.map((r) => r.usage))).toBe(
            JSON.stringify(plain.records.map((r) => r.usage)),
        );
    });
});

describe('measureBytesPerToken - the factor is a division of two counted sums', () => {
    it('divides summed content bytes by summed output tokens', () => {
        const got = measureBytesPerToken([rec(10, 40), rec(30, 80)]);
        expect(got).not.toBeNull();
        expect(got?.content_bytes).toBe(120);
        expect(got?.output_tokens).toBe(40);
        expect(got?.bytes_per_token).toBe(120 / 40);
        expect(got?.records).toBe(2);
        expect(got?.basis).toBe('measured');
    });

    it('skips records with no measured bytes rather than counting them as zero', () => {
        // The unmeasured record would drag the ratio down if it were folded in
        // as 0 bytes; it must not contribute to either sum.
        const got = measureBytesPerToken([rec(10, 40), rec(1000, null)]);
        expect(got?.output_tokens).toBe(10);
        expect(got?.bytes_per_token).toBe(4);
    });

    it('returns null - the honest null - when nothing in the corpus supplies a ratio', () => {
        expect(measureBytesPerToken([])).toBeNull();
        expect(measureBytesPerToken([rec(0, 40)])).toBeNull();
        expect(measureBytesPerToken([rec(10, null)])).toBeNull();
    });
});

describe('derivedBytes - a derived figure can never be read as a counted one', () => {
    it('multiplies and labels the result derived, carrying the factor with it', () => {
        const factor = measureBytesPerToken([rec(10, 45)]);
        const got = derivedBytes(1000, factor);
        expect(got?.basis).toBe('derived');
        expect(got?.bytes).toBe(Math.round(1000 * 4.5));
        expect(got?.factor.basis).toBe('measured');
        expect(got?.factor.content_bytes).toBe(45);
    });

    it('propagates the honest null instead of substituting a default factor', () => {
        expect(derivedBytes(1000, null)).toBeNull();
    });

    it('uses the fixture ratio, not a constant - a different corpus gives a different answer', () => {
        // The guard against a hardcoded bytes-per-token literal: two corpora
        // with the same token count and different content must not produce the
        // same byte figure.
        const thin = derivedBytes(100, measureBytesPerToken([rec(10, 20)]));
        const fat = derivedBytes(100, measureBytesPerToken([rec(10, 200)]));
        expect(thin?.bytes).not.toBe(fat?.bytes);
        expect(fat?.bytes).toBe((thin?.bytes ?? 0) * 10);
    });
});

describe('scanToolResults - the payload bytes of a tool result, per tool class', () => {
    // An Edit whose hook envelope carries the whole original file, while the
    // model receives only the confirmation line. Every expected figure is
    // computed from these constants, never copied from a run.
    const ORIGINAL_FILE = 'const x = 1;\n'.repeat(400);
    const CONFIRMATION = 'The file /repo/a.ts has been updated successfully.';
    const EDIT_ENVELOPE = { filePath: '/repo/a.ts', oldString: 'x', newString: 'y', originalFile: ORIGINAL_FILE };
    const BASH_OUT = 'line one\nline two';
    const IMAGE_DATA = 'iVBORw0KGgo'.repeat(30);

    function writeToolFixture(root: string): string {
        const projectDir = path.join(root, 'proj');
        appendJsonl(path.join(projectDir, 's.jsonl'), [
            {
                type: 'assistant',
                message: {
                    id: 'm1',
                    content: [
                        { type: 'tool_use', id: 'tu_edit', name: 'Edit', input: {} },
                        { type: 'tool_use', id: 'tu_bash', name: 'Bash', input: {} },
                        { type: 'tool_use', id: 'tu_img', name: 'Read', input: {} },
                    ],
                },
            },
            {
                type: 'user',
                message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_edit', content: CONFIRMATION }] },
                toolUseResult: EDIT_ENVELOPE,
            },
            {
                type: 'user',
                message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_bash', content: [{ type: 'text', text: BASH_OUT }] }] },
                toolUseResult: { stdout: BASH_OUT, stderr: '' },
            },
            {
                type: 'user',
                message: {
                    role: 'user',
                    content: [{ type: 'tool_result', tool_use_id: 'tu_img', content: [{ type: 'image', source: { type: 'base64', data: IMAGE_DATA } }] }],
                },
            },
            // An orphan: its tool_use is in no file. Counted as unknown, never dropped, never guessed.
            {
                type: 'user',
                message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_orphan', content: 'orphan' }] },
            },
        ]);
        // The Edit result replayed into a second file must not be counted twice.
        appendJsonl(path.join(projectDir, 's', 'subagents', 'agent-r.jsonl'), [
            {
                type: 'user',
                message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_edit', content: CONFIRMATION }] },
                toolUseResult: EDIT_ENVELOPE,
            },
        ]);
        return projectDir;
    }

    it('edit-envelope-is-not-model-visible', () => {
        const root = mkTmp();
        const projectDir = writeToolFixture(root);
        const scan = scanToolResults({ root, projectDir });
        const edit = scan.classes['Edit'];
        expect(edit?.count).toBe(1);
        expect(edit?.payload_bytes).toBe(Buffer.byteLength(CONFIRMATION, 'utf8'));
        expect(edit?.envelope_bytes).toBe(Buffer.byteLength(JSON.stringify(EDIT_ENVELOPE), 'utf8'));
        expect(edit?.envelope_bytes ?? 0).toBeGreaterThan((edit?.payload_bytes ?? 0) * 10);
    });

    it('counts text blocks, separates image Reads, and keeps orphans in their own class', () => {
        const root = mkTmp();
        const projectDir = writeToolFixture(root);
        const scan = scanToolResults({ root, projectDir });
        expect(scan.classes['Bash']?.payload_bytes).toBe(Buffer.byteLength(BASH_OUT, 'utf8'));
        expect(scan.classes['Read:image']?.payload_bytes).toBe(IMAGE_DATA.length);
        expect(scan.classes['Read:image']?.envelope_bytes).toBeNull();
        expect(scan.classes['Read']).toBeUndefined();
        expect(scan.classes['unknown']?.count).toBe(1);
        expect(scan.results).toBe(4);
    });

    describe('payload definition - text strings and base64 image data, never block structure', () => {
        function scanOne(block: Record<string, unknown>, name = 'Bash') {
            const root = mkTmp();
            const projectDir = path.join(root, 'proj');
            appendJsonl(path.join(projectDir, 's.jsonl'), [
                { type: 'assistant', message: { id: 'm1', content: [{ type: 'tool_use', id: 'tu_1', name, input: {} }] } },
                { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', ...block }] } },
            ]);
            return scanToolResults({ root, projectDir });
        }

        it('is-error-flag-is-not-payload', () => {
            const ERR = 'Exit code 1\nboom';
            const cls = scanOne({ is_error: true, content: ERR }).classes['Bash'];
            expect(cls?.count).toBe(1);
            expect(cls?.payload_bytes).toBe(Buffer.byteLength(ERR, 'utf8'));
        });

        it('mixed-text-and-image-sums-both-and-classes-as-image', () => {
            const A = 'before ✓';
            const DATA = 'iVBORw0KGgo'.repeat(3);
            const B = 'after';
            const scan = scanOne(
                {
                    content: [
                        { type: 'text', text: A },
                        { type: 'image', source: { type: 'base64', data: DATA } },
                        { type: 'text', text: B },
                    ],
                },
                'Read',
            );
            expect(scan.classes['Read']).toBeUndefined();
            expect(scan.classes['Read:image']?.payload_bytes).toBe(
                Buffer.byteLength(A, 'utf8') + DATA.length + Buffer.byteLength(B, 'utf8'),
            );
        });

        it('empty-content-counts-the-result-at-zero-bytes', () => {
            for (const block of [{ content: '' }, { content: [] }, {}]) {
                const cls = scanOne(block).classes['Bash'];
                expect(cls?.count).toBe(1);
                expect(cls?.payload_bytes).toBe(0);
                expect(cls?.unsupported_members).toBe(0);
            }
        });

        it('unsupported-members-are-counted-not-silently-dropped', () => {
            const scan = scanOne({
                content: [
                    { type: 'document', source: { type: 'base64', data: 'JVBERi0xLjQ=' } },
                    { type: 'text', text: 'ok' },
                    'a bare string member',
                ],
            });
            const cls = scan.classes['Bash'];
            expect(cls?.payload_bytes).toBe(2);
            expect(cls?.unsupported_members).toBe(2);
        });
    });
});
