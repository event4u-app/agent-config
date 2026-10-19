// Rasterise an SVG to PNG with the repository's Playwright Chromium, offline.
//   node render_png.mjs in.svg out.png
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const [, , input, output] = process.argv;
const svg = readFileSync(input, 'utf-8');
const width = Number(/width="(\d+)"/.exec(svg)[1]);
const height = Number(/height="(\d+)"/.exec(svg)[1]);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
await page.screenshot({ path: output, clip: { x: 0, y: 0, width, height } });
await browser.close();
