/**
 * Child process for the DOM acceptance grader. Runs one produced HTML page in
 * happy-dom with its scripts enabled and executes the held-back acceptance
 * spec against it, printing one JSON line.
 *
 * Why a child process: the page is untrusted model output. happy-dom's VM
 * context is not a security boundary, so the parent starts this worker with
 * `--disallow-code-generation-from-strings --frozen-intrinsics`, a timeout and
 * the arm's isolated HOME; a page that loops forever costs one timeout, not the
 * grader. happy-dom is a devDependency and is imported dynamically, so a
 * consumer install without it reports `unknown` instead of failing to load.
 *
 * Usage: bench_artifact_dom_worker <spec.json>
 *   spec = { html_path, tests: [{name, steps}], render: {width, height, locale} }
 */
import * as fs from 'node:fs';
import process from 'node:process';

type Step = Record<string, unknown>;
interface Spec {
    html_path: string;
    tests: { name: string; steps: Step[] }[];
    render: { width: number; height: number; locale: string };
}

type Win = any; // eslint-disable-line @typescript-eslint/no-explicit-any

async function open(mod: Win, html: string, spec: Spec, storage: Record<string, string>): Promise<Win> {
    const w = new mod.Window({
        url: 'http://bench.invalid/',
        width: spec.render.width,
        height: spec.render.height,
        settings: {
            enableJavaScriptEvaluation: true,
            suppressInsecureJavaScriptEnvironmentWarning: true,
            disableJavaScriptFileLoading: true,
            disableCSSFileLoading: true,
            disableIframePageLoading: true,
            navigator: { userAgent: 'bench-artifact' },
            device: { prefersReducedMotion: 'reduce', prefersColorScheme: 'light', mediaType: 'screen' },
        },
    });
    Object.defineProperty(w.navigator, 'language', { value: spec.render.locale });
    for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
    w.document.write(html);
    await w.happyDOM.waitUntilComplete();
    return w;
}

function visible(w: Win, el: Win): boolean {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        if (n.hidden || w.getComputedStyle(n).display === 'none' || w.getComputedStyle(n).visibility === 'hidden') return false;
    }
    return true;
}

function storage_of(w: Win): Record<string, string> {
    const out: Record<string, string> = {};
    for (let i = 0; i < w.localStorage.length; i += 1) {
        const k = w.localStorage.key(i);
        out[k] = w.localStorage.getItem(k);
    }
    return out;
}

async function run_step(w: Win, s: Step, html: string): Promise<string | null> {
    const q = (sel: unknown): Win => w.document.querySelector(String(sel));
    const all = (sel: unknown): Win[] => [...w.document.querySelectorAll(String(sel))];
    const re = (p: unknown): RegExp => new RegExp(String(p), 'i');
    if (s['do'] !== undefined) {
        const el = q(s['selector']);
        if (!el) return `no element ${String(s['selector'])}`;
        if (s['do'] === 'fill') {
            el.value = String(s['value'] ?? '');
            el.dispatchEvent(new w.Event('input', { bubbles: true }));
            el.dispatchEvent(new w.Event('change', { bubbles: true }));
        } else if (s['do'] === 'click') {
            el.click();
        } else if (s['do'] === 'press') {
            for (const t of ['keydown', 'keypress', 'keyup']) el.dispatchEvent(new w.KeyboardEvent(t, { key: String(s['key']), bubbles: true }));
        } else if (s['do'] === 'submit') {
            if (el.requestSubmit) el.requestSubmit();
            else el.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
        } else {
            return `unknown action ${String(s['do'])}`;
        }
        await w.happyDOM.waitUntilComplete();
        return null;
    }
    const kind = s['expect'];
    const sel = s['selector'];
    if (kind === 'count') {
        const els = all(sel).filter((e) => s['visible_only'] !== true || visible(w, e));
        const n = els.length;
        if (typeof s['eq'] === 'number' && n !== s['eq']) return `${String(sel)}: ${n} != ${s['eq']}`;
        if (typeof s['min'] === 'number' && n < s['min']) return `${String(sel)}: ${n} < ${s['min']}`;
        return null;
    }
    if (kind === 'text') {
        const el = q(sel);
        const txt = el ? String(el.textContent).replace(/\s+/g, ' ').trim() : '';
        return el && re(s['match']).test(txt) ? null : `${String(sel)} text "${txt.slice(0, 60)}" !~ ${String(s['match'])}`;
    }
    if (kind === 'attr') {
        const el = q(sel);
        const v = el?.getAttribute(String(s['attribute'])) ?? '';
        return el && re(s['match']).test(v) ? null : `${String(sel)}@${String(s['attribute'])}="${v}" !~ ${String(s['match'])}`;
    }
    if (kind === 'value') {
        const el = q(sel);
        return el && re(s['match']).test(String(el.value)) ? null : `${String(sel)} value !~ ${String(s['match'])}`;
    }
    if (kind === 'visible' || kind === 'hidden') {
        const el = q(sel);
        if (!el) return kind === 'hidden' && s['absent_ok'] === true ? null : `no element ${String(sel)}`;
        return visible(w, el) === (kind === 'visible') ? null : `${String(sel)} is not ${kind}`;
    }
    if (kind === 'labelled') {
        const bad = all(sel).filter((e) => {
            const id = e.getAttribute('id');
            return !(e.getAttribute('aria-label') || e.closest('label') || (id && w.document.querySelector(`label[for="${id}"]`)));
        });
        return bad.length === 0 ? null : `${bad.length} unlabelled control(s)`;
    }
    if (kind === 'source') {
        const ok = re(s['match']).test(html);
        return ok === (s['negate'] !== true) ? null : `source ${s['negate'] ? 'matches' : 'lacks'} ${String(s['match'])}`;
    }
    return `unknown expectation ${String(kind)}`;
}

async function main(): Promise<void> {
    const spec = JSON.parse(fs.readFileSync(process.argv[2] as string, 'utf-8')) as Spec;
    let mod: Win;
    try {
        mod = await import('happy-dom');
    } catch {
        process.stdout.write(JSON.stringify({ unavailable: 'happy-dom not installed' }) + '\n');
        return;
    }
    const html = fs.readFileSync(spec.html_path, 'utf-8');
    const results: { name: string; status: 'pass' | 'fail'; detail?: string }[] = [];
    for (const t of spec.tests) {
        let w = await open(mod, html, spec, {});
        let failure: string | null = null;
        try {
            for (const s of t.steps) {
                if (s['do'] === 'reload') {
                    const kept = storage_of(w);
                    await w.happyDOM.close();
                    w = await open(mod, html, spec, kept);
                    continue;
                }
                failure = await run_step(w, s, html);
                if (failure !== null) break;
            }
        } catch (e) {
            failure = `threw: ${(e as Error).message}`;
        }
        await w.happyDOM.close();
        results.push({ name: t.name, status: failure === null ? 'pass' : 'fail', ...(failure ? { detail: failure } : {}) });
    }
    process.stdout.write(JSON.stringify({ results }) + '\n');
}

void main().then(() => process.exit(0));
