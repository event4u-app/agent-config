/**
 * Child process for the render-similarity check of the image → SVG task
 * (proof-where 2.4). Draws the produced SVG and the source raster onto two
 * canvases of the same size in headless Chromium and prints one JSON line.
 *
 * Score: colour agreement over the union of foreground pixels — a pixel counts
 * when either image has something other than the background there, and it agrees
 * when no channel differs by more than `tolerance`. A blank or white SVG therefore
 * scores 0, not "mostly white, so similar". Both images are drawn without
 * smoothing at `scale`, so a hard-edged 48 px source is compared shape for shape.
 *
 * `@playwright/test` is a devDependency and imported dynamically; without it, or
 * without its Chromium, the worker reports `unavailable`.
 *
 * Usage: bench_artifact_svg_similarity_worker <spec.json>
 *   spec = { svg_path, png_path, scale, tolerance }
 */
import * as fs from 'node:fs';
import process from 'node:process';

interface Spec {
    svg_path: string;
    png_path: string;
    scale: number;
    tolerance: number;
}

const IN_PAGE = `async ({ svg, png, scale, tolerance }) => {
    const load = (src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('image did not load'));
        img.src = src;
    });
    const ref = await load(png);
    const w = ref.naturalWidth * scale;
    const h = ref.naturalHeight * scale;
    const pixels = (img) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, w, h);
        if (img) g.drawImage(img, 0, 0, w, h);
        return g.getImageData(0, 0, w, h).data;
    };
    const a = pixels(ref);
    const b = pixels(await load(svg).catch(() => null));
    const bg = (d, i) => d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245;
    let union = 0;
    let agree = 0;
    for (let i = 0; i < a.length; i += 4) {
        if (bg(a, i) && bg(b, i)) continue;
        union += 1;
        if (Math.abs(a[i] - b[i]) <= tolerance && Math.abs(a[i + 1] - b[i + 1]) <= tolerance && Math.abs(a[i + 2] - b[i + 2]) <= tolerance) agree += 1;
    }
    return union === 0 ? 0 : agree / union;
}`;

async function main(): Promise<void> {
    const spec = JSON.parse(fs.readFileSync(process.argv[2] as string, 'utf-8')) as Spec;
    let pw: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
        pw = await import('@playwright/test');
    } catch {
        process.stdout.write(JSON.stringify({ unavailable: '@playwright/test not installed' }) + '\n');
        return;
    }
    if (!fs.existsSync(pw.chromium.executablePath())) {
        process.stdout.write(JSON.stringify({ unavailable: 'no playwright chromium installed' }) + '\n');
        return;
    }
    const svg = `data:image/svg+xml;base64,${fs.readFileSync(spec.svg_path).toString('base64')}`;
    const png = `data:image/png;base64,${fs.readFileSync(spec.png_path).toString('base64')}`;
    const browser = await pw.chromium.launch();
    try {
        const ctx = await browser.newContext();
        await ctx.route('**/*', (r: { abort: () => Promise<void> }) => r.abort());
        const page = await ctx.newPage();
        await page.setContent('<!doctype html><body></body>');
        // Passed as source text: a function would be transpiled with helper calls
        // (`__name`) that do not exist inside the page.
        const similarity = (await page.evaluate(`(${IN_PAGE})(${JSON.stringify({ svg, png, scale: spec.scale, tolerance: spec.tolerance })})`)) as number;
        process.stdout.write(JSON.stringify({ similarity }) + '\n');
    } finally {
        await browser.close();
    }
}

void main().then(
    () => process.exit(0),
    (e: unknown) => {
        process.stdout.write(JSON.stringify({ error: (e as Error).message }) + '\n');
        process.exit(1);
    },
);
