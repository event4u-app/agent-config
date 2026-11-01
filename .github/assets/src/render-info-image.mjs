#!/usr/bin/env node
// Renders .github/assets/info-image.png from info-image.html + info-image-base.webp.
//
//   node .github/assets/src/render-info-image.mjs
//
// Maintainer-only: rebuild the masked base from the untracked original artwork
// (the original carries text that must not be committed):
//
//   node .github/assets/src/render-info-image.mjs --extract-base /path/to/original.png
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = pathToFileURL(join(here, 'info-image.html')).href;
const baseOut = join(here, 'info-image-base.webp');
const pngOut = resolve(here, '..', 'info-image.png');

const args = process.argv.slice(2);
const extractIdx = args.indexOf('--extract-base');

const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
try {
  const page = await browser.newPage({ viewport: { width: 1774, height: 887 }, deviceScaleFactor: 1 });
  if (extractIdx !== -1) {
    const original = args[extractIdx + 1];
    if (!original) throw new Error('--extract-base needs the path of the original artwork');
    await page.goto(html + '?mode=mask');
    const dataUrl = `data:image/png;base64,${readFileSync(original).toString('base64')}`;
    const out = await page.evaluate((d) => window.buildBase(d), dataUrl);
    writeFileSync(baseOut, Buffer.from(out.split(',')[1], 'base64'));
    console.log(`wrote ${baseOut}`);
  } else {
    await page.goto(html);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.renderOverlay());
    await page.locator('#stage').screenshot({ path: pngOut });
    console.log(`wrote ${pngOut}`);
  }
} finally {
  await browser.close();
}
