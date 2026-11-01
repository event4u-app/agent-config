// No-drift content sync: project the canonical docs/*.md listed in
// docs-manifest.json into the Starlight content collection at build time, so the
// site is always a projection of the source of truth and never holds a stale
// hand-copy. Runs as prebuild/predev.
//
// Every page lands in ONE gitignored subtree (src/content/docs/generated/) and
// carries a `slug` frontmatter key, so its public URL is the manifest `route`,
// independent of where the file sits. Adding a page is one manifest line.
//
// Each page is made to look native: the source's first H1 becomes the Starlight
// `title` (and leaves the body), its first paragraph the `description`, `editUrl`
// points at the docs/ source, and a visible aside says the page is generated.
//
// Every link is resolved relative to its source file and classified (see
// classifyLink). The sync fails if a relative `.md` link survives the rewrite.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..');
export const MANIFEST = path.join(HERE, 'docs-manifest.json');
export const OUT = path.join(HERE, 'src', 'content', 'docs', 'generated');
// Embedded media (e.g. the proof demo GIF) lives at docs/media/; it is copied into
// the site's static root so `public/media/x` → `${BASE}/media/x` at build time.
const MEDIA_SRC = path.join(REPO, 'docs', 'media');
const MEDIA_OUT = path.join(HERE, 'public', 'media');

export const BASE = '/agent-config';
export const GH = 'https://github.com/event4u-app/agent-config';
export const GH_BLOB = `${GH}/blob/main`;
const GH_EDIT = `${GH}/edit/main`;

const ROUTE_RE = /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/;

/** Read and validate the manifest. Throws with a precise message on any defect. */
export function parseManifest(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data || !Array.isArray(data.pages)) throw new Error('manifest: `pages` must be an array');
  const seenSrc = new Set();
  const seenRoute = new Set();
  return data.pages.map((p, i) => {
    const where = `manifest pages[${i}]`;
    if (!p || typeof p.src !== 'string' || !p.src.endsWith('.md')) throw new Error(`${where}: \`src\` must be a docs/-relative .md path`);
    if (p.src.startsWith('/') || path.posix.normalize(p.src).startsWith('..')) throw new Error(`${where}: \`src\` must stay inside docs/`);
    if (typeof p.route !== 'string' || !ROUTE_RE.test(p.route)) throw new Error(`${where}: \`route\` must be lowercase path segments (got ${JSON.stringify(p.route)})`);
    if (p.title !== undefined && typeof p.title !== 'string') throw new Error(`${where}: \`title\` must be a string`);
    if (seenSrc.has(p.src)) throw new Error(`${where}: duplicate src ${p.src}`);
    if (seenRoute.has(p.route)) throw new Error(`${where}: duplicate route ${p.route}`);
    seenSrc.add(p.src);
    seenRoute.add(p.route);
    return { src: p.src, route: p.route, ...(p.title ? { title: p.title } : {}) };
  });
}

/** Link context: repo path of every synced page → its site route. */
export function makeContext(pages, base = BASE) {
  return { base, pages: new Map(pages.map((p) => [`docs/${p.src}`, `${base}/${p.route}/`])) };
}

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Classify one link target found in `fromRepoPath` (a repo-relative POSIX path).
 * Returns { kind, url }:
 *   external — has a scheme or is protocol-relative; left as is
 *   anchor   — `#frag` on the same page; left as is
 *   page     — resolves to a synced page → its site route (+ fragment)
 *   media    — resolves into docs/media/ → the copied static asset
 *   docs     — any other file under docs/ → GitHub blob
 *   repo     — anything else in the repository → GitHub blob
 * Throws when the target resolves outside the repository.
 */
export function classifyLink(target, fromRepoPath, ctx) {
  if (SCHEME_RE.test(target) || target.startsWith('//')) return { kind: 'external', url: target };
  if (target.startsWith('#')) return { kind: 'anchor', url: target };
  const hashAt = target.search(/[?#]/);
  const rawPath = hashAt === -1 ? target : target.slice(0, hashAt);
  const suffix = hashAt === -1 ? '' : target.slice(hashAt);
  let decoded = rawPath;
  try {
    decoded = decodeURI(rawPath);
  } catch {
    /* keep raw */
  }
  const joined = decoded.startsWith('/')
    ? decoded.slice(1)
    : path.posix.join(path.posix.dirname(fromRepoPath), decoded);
  const resolved = path.posix.normalize(joined);
  if (resolved === '..' || resolved.startsWith('../') || path.posix.isAbsolute(resolved)) {
    throw new Error(`link escapes the repository: ${target} (in ${fromRepoPath})`);
  }
  const clean = resolved === '.' ? '' : resolved.replace(/\/$/, '');
  const page = ctx.pages.get(clean);
  if (page) return { kind: 'page', url: page + suffix };
  if (clean.startsWith('docs/media/')) return { kind: 'media', url: `${ctx.base}/media/${encodeURI(clean.slice('docs/media/'.length))}${suffix}` };
  const blob = `${GH_BLOB}/${encodeURI(clean)}${suffix}`;
  return { kind: clean.startsWith('docs/') ? 'docs' : 'repo', url: blob };
}

const INLINE_LINK_RE = /(\]\(\s*)(<[^>\n]*>|[^)\s]+)((?:\s+(?:"[^"]*"|'[^']*'))?\s*\))/g;
const REF_DEF_RE = /^(\s{0,3}\[[^\]]+\]:\s*)(<[^>\n]*>|\S+)(.*)$/;
const FENCE_RE = /^\s{0,3}(```|~~~)/;

/** Apply `fn` to every line segment outside fenced code blocks and inline code spans. */
function mapProse(text, fn) {
  let fence = null;
  return text
    .split('\n')
    .map((line) => {
      const m = FENCE_RE.exec(line);
      if (m) {
        if (fence === null) fence = m[1];
        else if (m[1] === fence) fence = null;
        return line;
      }
      if (fence !== null) return line;
      return line
        .split(/(`+[^`]*`+)/)
        .map((seg, i) => (i % 2 === 1 ? seg : fn(seg)))
        .join('');
    })
    .join('\n');
}

/** Rewrite every inline link and reference definition per classifyLink. */
export function rewriteLinks(text, fromRepoPath, ctx) {
  const fix = (target) => {
    const bare = target.startsWith('<') ? target.slice(1, -1) : target;
    return classifyLink(bare, fromRepoPath, ctx).url;
  };
  return mapProse(text, (seg) => {
    const ref = REF_DEF_RE.exec(seg);
    if (ref) return `${ref[1]}${fix(ref[2])}${ref[3]}`;
    return seg.replace(INLINE_LINK_RE, (_m, open, target, close) => `${open}${fix(target)}${close}`);
  });
}

/** Every link target that is still a relative `.md` link (outside code). */
export function findRelativeMdLinks(text) {
  const found = [];
  mapProse(text, (seg) => {
    const targets = [...seg.matchAll(INLINE_LINK_RE)].map((m) => m[2]);
    const ref = REF_DEF_RE.exec(seg);
    if (ref) targets.push(ref[2]);
    for (const t of targets) {
      const bare = t.replace(/^<|>$/g, '').split(/[?#]/)[0];
      if (!SCHEME_RE.test(bare) && !bare.startsWith('//') && !bare.startsWith('/') && /\.md$/i.test(bare)) found.push(t);
    }
    return seg;
  });
  return found;
}

/** Split a leading `---` frontmatter block off; returns its simple `key: value` pairs. */
export function splitFrontmatter(text) {
  if (!text.startsWith('---\n')) return { meta: {}, body: text };
  const end = text.indexOf('\n---', 4);
  if (end === -1) return { meta: {}, body: text };
  const meta = {};
  for (const line of text.slice(4, end).split('\n')) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (m) meta[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  const after = text.indexOf('\n', end + 1);
  return { meta, body: after === -1 ? '' : text.slice(after + 1) };
}

/** Find the first ATX H1 outside code; return its text and the body without it. */
export function extractTitle(body) {
  const lines = body.split('\n');
  let fence = null;
  for (let i = 0; i < lines.length; i += 1) {
    const f = FENCE_RE.exec(lines[i]);
    if (f) {
      if (fence === null) fence = f[1];
      else if (f[1] === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const h = /^#\s+(.+?)\s*#*\s*$/.exec(lines[i]);
    if (h) {
      const rest = [...lines.slice(0, i), ...lines.slice(i + 1)];
      // Collapse the blank line pair the removed heading leaves behind.
      if (i < rest.length && rest[i] === '' && (i === 0 || rest[i - 1] === '')) rest.splice(i, 1);
      return { title: stripInline(h[1]), body: rest.join('\n').replace(/^\s+/, '') };
    }
  }
  return { title: null, body };
}

/** Markdown inline → plain text (links to their text, emphasis/code markers dropped). */
export function stripInline(s) {
  // Code spans are literal: park their text so tag/emphasis stripping cannot touch it.
  const code = [];
  const parked = s.replace(/`+([^`]*)`+/g, (_m, c) => `\u0000${code.push(c) - 1}\u0000`);
  return parked
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|\W)[*_](\S.*?\S|\S)[*_](?=\W|$)/g, '$1$2')
    .replace(/\u0000(\d+)\u0000/g, (_m, i) => code[Number(i)])
    .replace(/\s+/g, ' ')
    .trim();
}

/** The first prose paragraph — or a blockquote that precedes it and the next heading — as plain text ≤ max chars. */
export function extractDescription(body, max = 160) {
  const lines = body.split('\n');
  let fence = null;
  let inComment = false;
  let quoteFallback = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const f = FENCE_RE.exec(line);
    if (f) {
      if (fence === null) fence = f[1];
      else if (f[1] === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;
    if (inComment) {
      if (line.includes('-->')) inComment = false;
      continue;
    }
    if (/^\s*<!--/.test(line)) {
      if (!line.includes('-->')) inComment = true;
      continue;
    }
    // A lead blockquote outranks prose under a later section heading.
    if (/^\s*#/.test(line) && quoteFallback !== null) break;
    if (!line.trim() || /^\s*(#|\||[-*+]\s|\d+\.\s|---|<|:::)/.test(line)) continue;
    const quote = /^\s*>/.test(line);
    const para = [];
    let j = i;
    while (j < lines.length && lines[j].trim() && /^\s*>/.test(lines[j]) === quote) {
      para.push(lines[j].replace(/^\s*>\s?/, ''));
      j += 1;
    }
    const text = stripInline(para.join(' '));
    if (!quote && text) return truncate(text, max);
    if (quote && quoteFallback === null && text) quoteFallback = text;
    i = j - 1;
  }
  return quoteFallback ? truncate(quoteFallback, max) : '';
}

function truncate(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.—-]+$/, '')}…`;
}

/** Render one manifest page from its source text. Throws on a surviving relative .md link. */
export function renderPage(page, sourceText, ctx) {
  const repoPath = `docs/${page.src}`;
  const { meta, body: raw } = splitFrontmatter(sourceText);
  const { title: h1, body } = extractTitle(raw.trimEnd());
  const title = page.title ?? meta.title ?? h1;
  if (!title) throw new Error(`${repoPath}: no H1 and no manifest title — cannot name the page`);
  const rewritten = rewriteLinks(body, repoPath, ctx);
  const leftover = findRelativeMdLinks(rewritten);
  if (leftover.length) throw new Error(`${repoPath}: relative .md link(s) survived the rewrite: ${leftover.join(', ')}`);
  const description = meta.description ?? extractDescription(body);
  const slug = ctx.pages.get(repoPath).slice(ctx.base.length + 1, -1);
  return (
    `---\n` +
    `title: ${JSON.stringify(title)}\n` +
    (description ? `description: ${JSON.stringify(description)}\n` : '') +
    `slug: ${JSON.stringify(slug)}\n` +
    `editUrl: ${JSON.stringify(`${GH_EDIT}/${repoPath}`)}\n` +
    `---\n\n` +
    `<!-- GENERATED from ${repoPath} by site/sync-docs.mjs — edit the source, not this file. -->\n\n` +
    `:::note[Generated page]\nGenerated from [\`${repoPath}\`](${GH_BLOB}/${repoPath}) — edit the source, not this page.\n:::\n\n` +
    `${rewritten.trimEnd()}\n`
  );
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

export function main() {
  const pages = parseManifest(fs.readFileSync(MANIFEST, 'utf8'));
  const ctx = makeContext(pages);
  // Rebuild the subtree from scratch: a page dropped from the manifest must not linger.
  fs.rmSync(OUT, { recursive: true, force: true });
  // Pre-manifest syncs wrote flat files beside the authored pages; in an existing
  // checkout they would now collide with the slugged copies, so remove our own.
  const docsRoot = path.dirname(OUT);
  for (const name of ['proof.md', 'benchmark.md', 'claims.md', 'catalog.md', 'works-with-agent-switch.md']) {
    const legacy = path.join(docsRoot, name);
    if (fs.existsSync(legacy) && fs.readFileSync(legacy, 'utf8').includes('by site/sync-docs.mjs')) fs.rmSync(legacy);
  }
  const errors = [];
  let n = 0;
  for (const page of pages) {
    const srcPath = path.join(REPO, 'docs', page.src);
    if (!fs.existsSync(srcPath)) {
      errors.push(`docs/${page.src}: listed in docs-manifest.json but missing`);
      continue;
    }
    try {
      const out = path.join(OUT, `${page.route}.md`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, renderPage(page, fs.readFileSync(srcPath, 'utf8'), ctx));
      n += 1;
    } catch (e) {
      errors.push(e.message);
    }
  }
  if (errors.length) {
    for (const e of errors) console.error(`sync-docs: ${e}`);
    process.exitCode = 1;
    return;
  }
  const media = syncMedia();
  console.log(`sync-docs: wrote ${n} page(s) to ${path.relative(HERE, OUT)}/, ${media} media asset(s) to public/media/`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
