import { execFileSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { decrypt } from '../../src/scripts/_lib/link_crypto.js';
import { appendLoop } from '../../src/scripts/analysis_ledger.js';
import {
    DEGRADED_NO_NETWORK,
    SourceCodebook,
    cloneRepoSource,
    fetchUrlSource,
    isPrivateAddress,
    quotedAnchor,
    validateSourceUrl,
} from '../../src/scripts/network_sources.js';

let server: http.Server;
let base: string;

beforeAll(async () => {
    server = http.createServer((req, res) => {
        if (req.url === '/article') {
            res.writeHead(200, { 'content-type': 'text/html' });
            res.end('<h1>Caching</h1>\n<p>The cache evicts the oldest entry first when it is full.</p>\n');
        } else if (req.url === '/big') {
            res.writeHead(200);
            res.end('x'.repeat(5000));
        } else if (req.url === '/slow') {
            res.writeHead(200);
            res.write('a trickle that never ends');
        } else if (req.url?.startsWith('/hop')) {
            const n = Number(req.url.slice(4));
            res.writeHead(302, { location: n > 0 ? `/hop${n - 1}` : '/article' });
            res.end();
        } else if (req.url === '/to-metadata') {
            res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data' });
            res.end();
        } else {
            res.writeHead(404);
            res.end();
        }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
    server.close();
});

const FIXTURE = { allowPrivateHosts: true, network: true } as const;

describe('validateSourceUrl', () => {
    it('refuses credentials, non-http schemes and private hosts', async () => {
        await expect(validateSourceUrl('https://user:pw@example.com/x', { network: true })).rejects.toThrow(/credentials/);
        await expect(validateSourceUrl('ftp://example.com/x', { network: true })).rejects.toThrow(/scheme/);
        await expect(validateSourceUrl(`${base}/article`, { network: true })).rejects.toThrow(/private/);
    });

    it('classifies private and link-local addresses', () => {
        for (const a of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1', '0.0.0.0']) {
            expect(isPrivateAddress(a)).toBe(true);
        }
        for (const a of ['93.184.216.34', '8.8.8.8', '2606:4700::1111']) expect(isPrivateAddress(a)).toBe(false);
    });

    it('judges an IPv6 address that embeds an IPv4 one by the IPv4 address, and refuses the reserved ranges', async () => {
        // WHATWG URL rewrites [::ffff:127.0.0.1] to the hex form, which the dotted-quad check alone missed.
        expect(new URL('http://[::ffff:127.0.0.1]/').hostname).toBe('[::ffff:7f00:1]');
        const embedded = ['::ffff:7f00:1', '::ffff:a9fe:a9fe', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '64:ff9b::7f00:1', '2002:7f00:1::', '::7f00:1'];
        const reserved = ['fec0::1', 'fe80::1', 'ff02::1', '192.0.0.8', '198.18.0.1', '198.19.255.1', '224.0.0.1', '255.255.255.255'];
        for (const a of [...embedded, ...reserved]) expect(isPrivateAddress(a), a).toBe(true);
        for (const a of ['::ffff:5db8:d822', '64:ff9b::808:808', '2002:808:808::', '198.20.0.1', '192.0.2.1']) expect(isPrivateAddress(a), a).toBe(false);
        await expect(validateSourceUrl('http://[::ffff:127.0.0.1]/x', { network: true })).rejects.toThrow(/private/);
    });

    it('refuses a clone pin that is not a full commit SHA, so it can never be read as an option', async () => {
        await expect(cloneRepoSource('https://example.com/r.git', os.tmpdir(), { network: true, pinSha: '--upload-pack=x' })).rejects.toThrow(/40-hex/);
    });
});

describe('fetchUrlSource (step 4.2b)', () => {
    it('reads a URL to a pinned, digested SourceRef', async () => {
        const ref = await fetchUrlSource(`${base}/article`, FIXTURE);
        expect(ref.kind).toBe('url');
        expect(ref.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
        expect(ref.pin).toBe(ref.digest);
        expect(ref.text).toContain('evicts the oldest entry');
    });

    it('gives up on a server that trickles a body without ending it', async () => {
        await expect(fetchUrlSource(`${base}/slow`, { ...FIXTURE, timeoutMs: 200 })).rejects.toThrow(/abort|timeout/i);
    });

    it('follows at most the redirect cap and re-validates every hop', async () => {
        expect((await fetchUrlSource(`${base}/hop2`, { ...FIXTURE, maxRedirects: 3 })).text).toContain('Caching');
        await expect(fetchUrlSource(`${base}/hop5`, { ...FIXTURE, maxRedirects: 3 })).rejects.toThrow(/redirect/);
        await expect(fetchUrlSource(`${base}/to-metadata`, { network: true, allowPrivateHosts: false, hostAllowlistForTests: ['127.0.0.1'] })).rejects.toThrow(
            /private/,
        );
    });

    it('refuses a body over the size cap', async () => {
        await expect(fetchUrlSource(`${base}/big`, { ...FIXTURE, maxBytes: 1000 })).rejects.toThrow(/exceeds/);
    });

    it('without network it returns a degraded result instead of fetching', async () => {
        const ref = await fetchUrlSource(`${base}/article`, { network: false });
        expect(ref.degraded).toBe(DEGRADED_NO_NETWORK);
        expect(ref.text).toBe('');
    });
});

describe('quotedAnchor', () => {
    it('quotes at most fifteen words around the needle with its line', () => {
        const a = quotedAnchor('line one\nThe cache evicts the oldest entry first when it is full and then some more words follow here today.', 'evicts');
        expect(a.line).toBe(2);
        expect(a.quote.split(/\s+/).length).toBeLessThanOrEqual(15);
        expect(a.quote).toContain('evicts');
    });
});

describe('SourceCodebook', () => {
    it('codes sources S1, S2 and keeps identities only as ENC1 tokens in intake', () => {
        const key = 'k'.repeat(32);
        const book = new SourceCodebook(key);
        expect(book.code('https://example.com/a')).toBe('S1');
        expect(book.code('https://example.com/b')).toBe('S2');
        expect(book.code('https://example.com/a')).toBe('S1');
        const intake = book.intakeMarkdown();
        expect(intake).not.toContain('example.com');
        const token = /S1: (ENC1\S+)/.exec(intake)?.[1] as string;
        expect(decrypt(token, key)).toBe('https://example.com/a');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codebook-'));
        book.writeIntake(dir);
        expect(fs.readFileSync(path.join(dir, 'intake.md'), 'utf8')).toBe(intake);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});

describe('a connected fixture run (step 4.2b verify)', () => {
    it('leaves one coded web row in the ledger and no source name in it', async () => {
        const book = new SourceCodebook('k'.repeat(32));
        const url = `${base}/article`;
        const ref = await fetchUrlSource(url, FIXTURE);
        const anchor = quotedAnchor(ref.text, 'evicts');
        const ledger = appendLoop([], {
            lens: 'coverage',
            items: [
                {
                    id: 'g1',
                    change: 'added',
                    evidence: [{ source_identity: book.code(url), digest: ref.digest, method: `web L${anchor.line}: "${anchor.quote}"`, claim: 'supported', tier: 'read' }],
                },
            ],
        });
        expect(ledger[0]?.status).toBe('counted');
        expect(ledger[0]?.items[0]?.evidence[0]?.source_identity).toBe('S1');
        expect(JSON.stringify(ledger)).not.toContain('127.0.0.1');
    });
});

describe('cloneRepoSource (step 4.2b)', () => {
    it('clones at depth 1 with hooks off and pins the clone HEAD; refuses without network', async () => {
        const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clone-src-'));
        const origin = path.join(work, 'origin');
        const run = (args: string[], cwd: string): string => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
        fs.mkdirSync(origin);
        run(['init', '-q', '-b', 'main'], origin);
        fs.writeFileSync(path.join(origin, 'README.md'), '# origin\n');
        run(['add', 'README.md'], origin);
        run(['-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-q', '-m', 'init'], origin);
        const head = run(['rev-parse', 'HEAD'], origin);
        const ref = await cloneRepoSource(`file://${origin}`, path.join(work, 'run'), { network: true, allowPrivateHosts: true });
        expect(ref.kind).toBe('local-clone');
        expect(ref.pin).toBe(head);
        expect(ref.identity).toBe(`file://${origin}`);
        await expect(cloneRepoSource(`file://${origin}`, path.join(work, 'run2'), { network: false })).rejects.toThrow(/no-network/);
        await expect(cloneRepoSource(`file://${origin}`, path.join(work, 'run3'), { network: true })).rejects.toThrow(/scheme/);
        fs.rmSync(work, { recursive: true, force: true });
    });

    it('refuses to follow a redirect during the clone, so a hop to a private host is never contacted', async () => {
        // The clone is synchronous, so the fixture servers run in a child process.
        const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clone-redirect-'));
        const hits = path.join(work, 'hits');
        const script = [
            "const http = require('node:http'); const fs = require('node:fs');",
            `const hits = ${JSON.stringify(hits)}; fs.writeFileSync(hits, '0');`,
            "const target = http.createServer((q, r) => { fs.writeFileSync(hits, String(Number(fs.readFileSync(hits, 'utf8')) + 1)); r.writeHead(404); r.end(); });",
            "target.listen(0, '127.0.0.1', () => { const t = target.address().port;",
            "  const red = http.createServer((q, r) => { r.writeHead(301, { location: 'http://127.0.0.1:' + t + q.url }); r.end(); });",
            "  red.listen(0, '127.0.0.1', () => process.stdout.write(String(red.address().port) + '\\n')); });",
        ].join('\n');
        const child = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'inherit'] });
        try {
            const port = await new Promise<string>((resolve) => child.stdout.once('data', (d: Buffer) => resolve(d.toString().trim())));
            await expect(
                cloneRepoSource(`http://127.0.0.1:${port}/repo.git`, path.join(work, 'run'), { network: true, hostAllowlistForTests: ['127.0.0.1'] }),
            ).rejects.toThrow();
            expect(fs.readFileSync(hits, 'utf8')).toBe('0');
        } finally {
            child.kill();
            fs.rmSync(work, { recursive: true, force: true });
        }
    });
});
