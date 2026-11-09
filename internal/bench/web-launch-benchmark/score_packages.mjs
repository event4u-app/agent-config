// Coordinator step of PROTOCOL-2026-11-09.md § 7: strip metadata and arm labels,
// assign opaque ids in an order randomised by seed 20261109, and write one
// self-contained scoring package per output. The coordinator copies the
// manifest into each package without reading it; scoring is the seats' work.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [root, runDir, outDir] = process.argv.slice(2);
const fixtures = path.join(root, 'tests/fixtures/web-launch-benchmark');
const protocol = fs.readFileSync(path.join(root, 'internal/bench/web-launch-benchmark/PROTOCOL-2026-11-09.md'), 'utf8');
const manifest = fs.readFileSync(path.join(fixtures, 'GROUND-TRUTH.md'), 'utf8');
const sections = protocol.slice(protocol.indexOf('## 5.'), protocol.indexOf('## 7.'));

// mulberry32, seeded with the protocol's 20261109, then a Fisher-Yates shuffle.
let s = 20261109;
const rand = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const outputs = fs.readdirSync(runDir).filter((f) => /^response-.+\.json$/.test(f)).sort();
const order = [...outputs];
for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
}

const siteEvidence = (site) => {
    const dir = path.join(fixtures, site);
    const files = [];
    const walk = (d, rel) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const r = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) walk(path.join(d, e.name), r);
            else files.push(r);
        }
    };
    walk(dir, '');
    files.sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
    return files.map((f) => `### ${f}\n\n~~~\n${fs.readFileSync(path.join(dir, f), 'utf8')}\n~~~`).join('\n\n');
};

const INSTRUCTIONS = `You are a blind scorer for a launch-audit benchmark. Below are: the scoring rules (Sections 5 and 6 of a frozen protocol), the benchmark's manifest of real defects and its decoy, the site's files, and ONE audit report written about that site by an unknown auditor. Score the report against the manifest exactly as the rules say. Do not guess who or what wrote the report.

Return ONLY one JSON object, no prose around it, with this shape:

{
  "output_id": "<the id given below>",
  "truth_scorable": true | false,
  "truth_scorability_note": "<one sentence; why not, when false>",
  "findings": [
    {"n": 1, "claim": "<the atomic asserted defect, short>", "location": "<file(s) or site-wide>", "duplicate_of": null | <n>, "matches_row": "<manifest row id>" | null, "decoy": true | false, "note": "<one sentence of evidence>"}
  ],
  "decoy_flagged": true | false,
  "matched_rows": ["<row id>", ...],
  "false_positives": <count of deduplicated findings with no match, decoy flags included>
}

Use the manifest's own row identifiers. List every atomic asserted defect in the report, including those in summaries and recommendations; mark duplicates with duplicate_of rather than dropping them.`;

fs.mkdirSync(outDir, { recursive: true });
const key = {};
order.forEach((file, idx) => {
    const id = `out-${String(idx + 1)}`;
    const entry = JSON.parse(fs.readFileSync(path.join(runDir, file), 'utf8'));
    key[id] = { file, site: entry.site, arm: entry.arm };
    const text = (entry.final.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const pkg = `${INSTRUCTIONS}\n\nOutput id: ${id}\nSite: ${entry.site}\n\n## Scoring rules\n\n${sections}\n## Manifest\n\n${manifest}\n\n## Site files (${entry.site})\n\n${siteEvidence(entry.site)}\n\n## The audit report to score (${id})\n\n~~~\n${text}\n~~~\n`;
    fs.writeFileSync(path.join(outDir, `${id}.md`), pkg);
});
fs.writeFileSync(path.join(outDir, 'ARM-KEY.sealed.json'), `${JSON.stringify(key, null, 2)}\n`);
const digest = createHash('sha256').update(fs.readFileSync(path.join(outDir, 'ARM-KEY.sealed.json'))).digest('hex');
console.log(`packages: ${String(order.length)}; arm key sha256 ${digest}`);
