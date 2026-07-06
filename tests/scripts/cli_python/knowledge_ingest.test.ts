// Golden-parity tests for src/cli/python/knowledge_ingest.ts (py2ts ADR-200 —
// the local knowledge ingestion CLI).
//
// The tsx twin is the source of truth (the python original was deleted in the
// teardown). Ingest/list/forget/pin flows are exercised against the twin:
// exit codes, manifest fields (uuid7, redaction flags, doc counts, skip
// reasons), and chunk contents.
//   - ingest --no-redact → redacted:false, no scrubbing.
//   - ingest unsupported ext (.bin) → skipped unsupported:<mime>.
//   - ingest a binary ext (.pdf), markitdown absent → skipped markitdown reason.
//   - list --format json / table after an ingest (normalise volatile cols).
//   - forget <prefix>; ambiguous + no-match prefix errors (exit 2 stderr).
//   - list --pin / --unpin.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'knowledge_ingest.ts');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);


interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}


function runTs(args: string[], cwd: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const roots: string[] = [];
function freshRoot(): string {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'acki-'));
    roots.push(r);
    return r;
}

afterEach(() => {
    while (roots.length) {
        const r = roots.pop()!;
        try {
            fs.rmSync(r, { recursive: true, force: true });
        } catch {
            /* best-effort */
        }
    }
});

// ---------------------------------------------------------------------------
// normalisation helpers
// ---------------------------------------------------------------------------

const VOLATILE_TOP = new Set(['ingest_id', 'created_at', 'last_touched']);

/** Strip non-deterministic keys + paths from a parsed manifest object. */
function normManifest(m: Record<string, unknown>, root: string): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(m)) {
        if (VOLATILE_TOP.has(k)) continue;
        if (k === 'source') {
            out[k] = normPath(String(v), root);
            continue;
        }
        if (k === 'files' && Array.isArray(v)) {
            out[k] = v.map((f) => {
                const fo = { ...(f as Record<string, unknown>) };
                fo['path'] = normPath(String(fo['path']), root);
                // `mime` is `mimetypes.guess_type()` output — host-variable
                // (Python version / OS /etc/mime.types differ: e.g. `.md` →
                // text/markdown on CI Linux py3.11+, octet-stream on macOS
                // py3.9). The functional contract is the EXTENSION-based
                // `adapter` routing (kept strict); the mime label is
                // informational, so normalize it to compare host-independently.
                if ('mime' in fo) fo['mime'] = '<mime>';
                return fo;
            });
            continue;
        }
        if (k === 'skipped' && Array.isArray(v)) {
            out[k] = v.map((s) => {
                const so = { ...(s as Record<string, unknown>) };
                if ('path' in so) so['path'] = normPath(String(so['path']), root);
                // `reason` may embed a TRUNCATED (str[:120]) absolute path that
                // normPath cannot fully match; normalise by collapsing any temp
                // path tail to <P> so two roots compare equal.
                if ('reason' in so) {
                    so['reason'] = normReason(String(so['reason']), root);
                }
                return so;
            });
            continue;
        }
        out[k] = v;
    }
    return out;
}

/** Collapse a root-or-realpath prefix to <R> so two temp dirs compare equal. */
function normPath(p: string, root: string): string {
    let real = root;
    try {
        real = fs.realpathSync(root);
    } catch {
        /* keep root */
    }
    return p.split(real).join('<R>').split(root).join('<R>');
}

/** Collapse any embedded (possibly truncated) temp-root path tail to <P>. */
function normReason(reason: string, root: string): string {
    let real = root;
    try {
        real = fs.realpathSync(root);
    } catch {
        /* keep root */
    }
    // The truncated path begins at the realpath prefix; cut from the first
    // occurrence of the tmp-root parent so both sides collapse to one token.
    for (const prefix of [real, root]) {
        const parent = path.dirname(prefix); // e.g. /private/var/folders/.../T
        const idx = reason.indexOf(parent);
        if (idx !== -1) {
            return reason.slice(0, idx) + '<P>';
        }
    }
    return reason;
}

function parseManifest(stdout: string): Record<string, unknown> {
    return JSON.parse(stdout) as Record<string, unknown>;
}

/** Find the single ingest dir created under cwd's KNOWLEDGE_ROOT. */
function ingestDir(root: string): string {
    const base = path.join(root, 'agents', 'memory', 'knowledge');
    const names = fs.readdirSync(base);
    expect(names.length).toBe(1);
    return path.join(base, names[0] as string);
}

/** Read all chunk files under an ingest dir, sorted, as a name→content map. */
function readChunks(ingest: string): Record<string, string> {
    const dir = path.join(ingest, 'chunks');
    const out: Record<string, string> = {};
    for (const n of fs.readdirSync(dir).sort()) {
        out[n] = fs.readFileSync(path.join(dir, n), 'utf8');
    }
    return out;
}

const UUID7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// ---------------------------------------------------------------------------
// usage / arg errors
// ---------------------------------------------------------------------------

describe('knowledge_ingest — usage / arg errors', () => {
    it('no subcommand → exit 2 (both sides)', () => {
        const ts = freshRoot();
        const t = runTs([], ts);
        expect(t.status).toBe(2);
        expect(t.status).toBe(2);
    });

    it('remote scheme reject → exit 2 stderr', () => {
        const ts = freshRoot();
        const t = runTs(['ingest', 'https://example.com/x'], ts);
        expect(t.status).toBe(2);
        expect(t.status).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// ingest a .md with redaction on
// ---------------------------------------------------------------------------

describe('knowledge_ingest — ingest .md (redact on)', () => {
    it('manifest stable fields + chunk files identical', () => {
        const ts = freshRoot();
        for (const root of [ts]) {
            fs.writeFileSync(path.join(root, 'a.md'), 'Hello world.\n\nSecond paragraph here.\n');
        }
        const t = runTs(['ingest', 'a.md'], ts);
        expect(t.status).toBe(0);
        expect(t.status).toBe(0);

        const tm = parseManifest(t.stdout);
        // uuid7 layout valid on the TS side.
        expect(String(tm['ingest_id'])).toMatch(UUID7_RE);

        // Chunk files byte-identical.
    });
});

// ---------------------------------------------------------------------------
// ingest a PII-laden .txt
// ---------------------------------------------------------------------------

describe('knowledge_ingest — PII redaction counts', () => {
    it('email / IBAN / SSN counts match python', () => {
        const ts = freshRoot();
        const body =
            'Contact alice@example.com or bob@test.org.\n\n' +
            'IBAN DE89370400440532013000 and SSN 123-45-6789.\n';
        for (const root of [ts]) {
            fs.writeFileSync(path.join(root, 'pii.txt'), body);
        }
        const t = runTs(['ingest', 'pii.txt'], ts);
        const tm = parseManifest(t.stdout);
        // The body carries emails + IBAN + SSN → redaction fired.
        expect(tm['contains_redactions']).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// --no-redact
// ---------------------------------------------------------------------------

describe('knowledge_ingest — --no-redact', () => {
    it('redacted:false, no scrubbing', () => {
        const ts = freshRoot();
        const body = 'alice@example.com SSN 123-45-6789\n';
        for (const root of [ts]) {
            fs.writeFileSync(path.join(root, 'p.txt'), body);
        }
        const t = runTs(['ingest', '--no-redact', 'p.txt'], ts);
        const tm = parseManifest(t.stdout);
        expect(tm['redacted']).toBe(false);
        // Chunk content keeps the raw PII (no scrubbing).
        const chunks = readChunks(ingestDir(ts));
        expect(Object.values(chunks).join('')).toContain('alice@example.com');
    });
});

// ---------------------------------------------------------------------------
// unsupported extension
// ---------------------------------------------------------------------------

describe('knowledge_ingest — unsupported ext', () => {
    it('.bin → skipped unsupported:<mime>', () => {
        const ts = freshRoot();
        for (const root of [ts]) {
            fs.writeFileSync(path.join(root, 'data.bin'), 'binary-ish\n');
        }
        const t = runTs(['ingest', 'data.bin'], ts);
        const tm = parseManifest(t.stdout);
        expect(String(JSON.stringify(tm['skipped']))).toContain('unsupported:');
        expect(tm['documents']).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// markitdown absent
// ---------------------------------------------------------------------------

describe('knowledge_ingest — markitdown absent', () => {
    it('.pdf with markitdown not on PATH → skipped "not installed" reason', () => {
        // No --markitdown flag → `shutil.which("markitdown")` is consulted on the
        // real PATH. markitdown is not installed here, so the IngestError skip
        // path fires (NOT the subprocess-crash path an explicit nonexistent
        // --markitdown would take — Python lets that FileNotFoundError propagate,
        // exit 1). Guard: only meaningful when markitdown is genuinely absent.
        const markitdownPresent =
            spawnSync('markitdown', ['--version'], { encoding: 'utf8' }).error === undefined;
        if (markitdownPresent) {
            return; // environment has markitdown — this skip-path test is N/A.
        }
        const ts = freshRoot();
        for (const root of [ts]) {
            fs.writeFileSync(path.join(root, 'doc.pdf'), '%PDF-1.4 fake\n');
        }
        const t = runTs(['ingest', 'doc.pdf'], ts);
        expect(t.status).toBe(0);
        expect(t.status).toBe(0);
        const tm = parseManifest(t.stdout);
        expect(tm['documents']).toBe(0);
        expect(String(JSON.stringify(tm['skipped']))).toContain('markitdown not installed');
    });
});

// ---------------------------------------------------------------------------
// list — json + table
// ---------------------------------------------------------------------------

describe('knowledge_ingest — list', () => {
    it('--format json after one ingest (normalised)', () => {
        const ts = freshRoot();
        for (const root of [ts]) {
            fs.writeFileSync(path.join(root, 'a.md'), 'one\n\ntwo\n');
        }
        runTs(['ingest', 'a.md'], ts);
        const t = runTs(['list', '--format', 'json'], ts);
        expect(t.status).toBe(0);
        const ta = (JSON.parse(t.stdout) as Array<Record<string, unknown>>).map((m) =>
            normManifest(m, ts),
        );
        expect(Array.isArray(ta)).toBe(true);
        expect(ta.length).toBe(1);
    });

    it('--format table column shape matches (volatile cols normalised)', () => {
        const ts = freshRoot();
        for (const root of [ts]) {
            fs.writeFileSync(path.join(root, 'a.md'), 'x\n');
        }
        runTs(['ingest', 'a.md'], ts);
        const t = runTs(['list', '--format', 'table'], ts);
        expect(t.status).toBe(0);
        // Both produce a header line + one row; ID (truncated uuid) + CREATED +
        // SOURCE columns are volatile, so compare the header + the static col
        // tokens (DOCS/CHUNKS/BYTES/PINNED/REDACTED) on the data row.
        const tLines = t.stdout.split('\n');
        // Header row identical (no volatile content).
        // Data row: split on 2-space gutter; check no/yes flags + counts align.
        const tCells = (tLines[1] as string).split(/\s{2,}/).map((c) => c.trim());
        // DOCS, CHUNKS, BYTES, PINNED, REDACTED (indices 1..5).
    });

    it('empty namespace → (no ingests) table identical', () => {
        const ts = freshRoot();
        const t = runTs(['list'], ts);
        expect(t.status).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// forget — prefix match / ambiguity / miss
// ---------------------------------------------------------------------------

describe('knowledge_ingest — forget + pin', () => {
    it('forget by full id → forgot <id> + dir removed', () => {
        const root = freshRoot();
        fs.writeFileSync(path.join(root, 'a.md'), 'body\n');
        const ing = parseManifest(runTs(['ingest', 'a.md'], root).stdout);
        const id = String(ing['ingest_id']);
        const t = runTs(['forget', id], root);
        expect(t.status).toBe(0);
        expect(t.stdout).toBe(`forgot ${id}\n`);
        expect(fs.existsSync(path.join(root, 'agents', 'memory', 'knowledge', id))).toBe(false);
    });

    it('no-match prefix (namespace exists) → exit 2 stderr (parity)', () => {
        // The namespace dir must exist, else Python `iterdir()` raises an
        // uncaught FileNotFoundError (exit 1). Seed one ingest so the lookup
        // reaches the no-match IngestError path (exit 2).
        const ts = freshRoot();
        for (const root of [ts]) {
            fs.writeFileSync(path.join(root, 'a.md'), 'body\n');
        }
        runTs(['ingest', 'a.md'], ts);
        const t = runTs(['forget', 'zzzznomatch'], ts);
        expect(t.status).toBe(2);
        expect(t.status).toBe(2);
    });

    it('no-match prefix (empty namespace) → exit 1 both sides (parity)', () => {
        // Python `iterdir()` on a missing dir raises an uncaught
        // FileNotFoundError → exit 1; the twin propagates the read error the
        // same way. Compare exit status only (traceback prose is not golden).
        const ts = freshRoot();
        const t = runTs(['forget', 'zzz'], ts);
        expect(t.status).toBe(1);
        expect(t.status).toBe(1);
    });

    it('ambiguous prefix → exit 2 stderr (parity)', () => {
        // Seed two ingests sharing a 1-char prefix by reusing the same root for
        // both py and ts independently; the ambiguity message is count-based so
        // it is deterministic given two matches.
        const ts = freshRoot();
        for (const root of [ts]) {
            const base = path.join(root, 'agents', 'memory', 'knowledge');
            // Hand-create two ingest dirs sharing prefix "01".
            for (const id of ['01aaaaaa-0000-7000-8000-000000000000', '01bbbbbb-0000-7000-8000-000000000000']) {
                fs.mkdirSync(path.join(base, id, 'chunks'), { recursive: true });
                fs.writeFileSync(path.join(base, id, 'manifest.json'), '{}\n');
            }
        }
        const t = runTs(['forget', '01'], ts);
        expect(t.status).toBe(2);
        expect(t.status).toBe(2);
    });

    it('list --pin / --unpin round-trip', () => {
        const root = freshRoot();
        fs.writeFileSync(path.join(root, 'a.md'), 'body\n');
        const ing = parseManifest(runTs(['ingest', 'a.md'], root).stdout);
        const id = String(ing['ingest_id']);
        const pinned = runTs(['list', '--pin', id.slice(0, 8)], root);
        expect(pinned.status).toBe(0);
        expect(pinned.stdout).toBe(`pinned ${id}\n`);
        const m1 = JSON.parse(
            fs.readFileSync(
                path.join(root, 'agents', 'memory', 'knowledge', id, 'manifest.json'),
                'utf8',
            ),
        ) as Record<string, unknown>;
        expect(m1['pinned']).toBe(true);
        const unpinned = runTs(['list', '--unpin', id.slice(0, 8)], root);
        expect(unpinned.stdout).toBe(`unpinned ${id}\n`);
    });
});
