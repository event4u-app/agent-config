// No-drift content sync: copy the CANONICAL docs/*.md into the Starlight
// content collection at build time, so the site is always a projection of the
// source of truth and can never hold a stale hand-copy. Runs as prebuild/predev.
//
// Each synced page gets a Starlight `title` (derived from its first H1) and a
// banner marking it generated. Known cross-links between the synced pages are
// rewritten to Starlight routes. Editing files under src/content/docs/ by hand
// is pointless — this script overwrites them.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(HERE, '..', 'docs');
const OUT = path.join(HERE, 'src', 'content', 'docs');
// Embedded media (e.g. the B8 proof demo GIF) lives at docs/media/; copy it into
// the site's static root so `public/media/x` → `${BASE}/media/x` at build time.
const MEDIA_SRC = path.join(DOCS, 'media');
const MEDIA_OUT = path.join(HERE, 'public', 'media');

// src doc → { slug, title } . Cross-links to any src in this map are rewritten.
const PAGES = [
  { src: 'proof.md', slug: 'proof', title: 'Verify it yourself' },
  { src: 'benchmark.md', slug: 'benchmark', title: 'Discipline-axis benchmark' },
  { src: 'CLAIMS.md', slug: 'claims', title: 'Claims ledger' },
  { src: 'catalog.md', slug: 'catalog', title: 'Catalog' },
];
const BASE = '/agent-config';
// The catalog links to source files (../dist/…, ../docs/…, ../README.md) that
// the static site does not serve; rewrite those to the canonical GitHub source
// so they resolve (and the internal-link checker skips them as external).
const GH_BLOB = 'https://github.com/event4u-app/agent-config/blob/main';
const linkMap = new Map(PAGES.map((p) => [p.src, `${BASE}/${p.slug}/`]));

/** Strip a leading `---\n…\n---` frontmatter block if present. */
function stripFrontmatter(text) {
  if (!text.startsWith('---\n')) return text;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return text;
  const after = text.indexOf('\n', end + 1);
  return text.slice(after + 1).replace(/^\s+/, '');
}

/** Rewrite `](<src>.md)` and `](<src>.md#frag)` cross-links to Starlight routes. */
function rewriteLinks(text) {
  let out = text;
  for (const [src, route] of linkMap) {
    const re = new RegExp(`\\]\\(\\.?/?${src.replace('.', '\\.')}(#[^)]*)?\\)`, 'g');
    out = out.replace(re, (_m, frag) => `](${route}${frag ?? ''})`);
  }
  return out;
}

/** Rewrite relative `](media/…)` embeds to the base-prefixed static path. */
function rewriteMedia(text) {
  return text.replace(/\]\(\.?\/?media\//g, `](${BASE}/media/`);
}

/** Rewrite residual repo-relative `](../<path>)` links to the GitHub source. */
function rewriteSourceLinks(text) {
  return text.replace(/\]\(\.\.\/([^)]+)\)/g, (_m, rel) => `](${GH_BLOB}/${rel})`);
}

/** Copy docs/media/* → site/public/media/* so embedded assets are served. */
function syncMedia() {
  if (!fs.existsSync(MEDIA_SRC)) return 0;
  fs.mkdirSync(MEDIA_OUT, { recursive: true });
  let m = 0;
  for (const name of fs.readdirSync(MEDIA_SRC).sort()) {
    const from = path.join(MEDIA_SRC, name);
    if (fs.statSync(from).isFile()) {
      fs.copyFileSync(from, path.join(MEDIA_OUT, name));
      m += 1;
    }
  }
  return m;
}

fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const { src, slug, title } of PAGES) {
  const srcPath = path.join(DOCS, src);
  if (!fs.existsSync(srcPath)) {
    console.error(`sync-docs: SKIP ${src} (missing)`);
    continue;
  }
  const body = rewriteSourceLinks(
    rewriteMedia(rewriteLinks(stripFrontmatter(fs.readFileSync(srcPath, 'utf8')).trimEnd())),
  );
  const page =
    `---\n` +
    `title: ${JSON.stringify(title)}\n` +
    `description: "Synced from docs/${src} — do not edit here."\n` +
    `editUrl: false\n` +
    `---\n\n` +
    `<!-- GENERATED from docs/${src} by site/sync-docs.mjs — edit the source, not this file. -->\n\n` +
    `${body}\n`;
  fs.writeFileSync(path.join(OUT, `${slug}.md`), page);
  n += 1;
}
const media = syncMedia();
console.log(`sync-docs: wrote ${n} page(s) to src/content/docs/, ${media} media asset(s) to public/media/`);
