/**
 * The subset of GitHub Actions expression syntax the locally mirrored workflow
 * jobs use, evaluated against a context the mirror supplies.
 *
 * Deliberately a subset with a hard edge: an identifier, function or operator
 * outside it throws `UnsupportedExpression`, so the mirror reports the step as
 * not reproducible instead of guessing a value. A guessed `if:` that evaluates
 * the wrong way would silently skip a gate locally that runs in CI — the exact
 * divergence the mirror exists to remove.
 *
 * Semantics follow the Actions documentation where the subset touches them:
 * `==`/`!=` compare strings case-insensitively, a missing property is `''`,
 * and truthiness treats `''`, `0`, `false` and `null` as false.
 */

export class UnsupportedExpression extends Error {}

export type ExprValue = string | number | boolean | null;

export interface ExprContext {
    /** Dotted-path lookup for `github.*`, `runner.*`, `env.*`, `secrets.*`. */
    lookup(path: string): ExprValue | undefined;
    /** Step outputs and outcomes recorded so far in this job. */
    steps: Record<string, { outputs: Record<string, string>; outcome: string }>;
    /** Whether every step that ran before this one succeeded. */
    jobSucceeded: boolean;
}

type Tok =
    | { t: 'str'; v: string }
    | { t: 'num'; v: number }
    | { t: 'id'; v: string }
    | { t: 'op'; v: string };

function tokenize(src: string): Tok[] {
    const out: Tok[] = [];
    let i = 0;
    while (i < src.length) {
        const c = src.charAt(i);
        if (/\s/.test(c)) { i++; continue; }
        if (c === "'") {
            let s = '';
            i++;
            for (;;) {
                if (i >= src.length) throw new UnsupportedExpression(`unterminated string in: ${src}`);
                if (src[i] === "'" && src[i + 1] === "'") { s += "'"; i += 2; continue; }
                if (src[i] === "'") { i++; break; }
                s += src[i++];
            }
            out.push({ t: 'str', v: s });
            continue;
        }
        const two = src.slice(i, i + 2);
        if (['==', '!=', '&&', '||', '<=', '>='].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
        if ('!()<>,'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
        const num = /^\d+(\.\d+)?/.exec(src.slice(i));
        if (num) { out.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
        const id = /^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*/.exec(src.slice(i));
        if (id) { out.push({ t: 'id', v: id[0] }); i += id[0].length; continue; }
        throw new UnsupportedExpression(`unsupported character ${JSON.stringify(c)} in: ${src}`);
    }
    return out;
}

function truthy(v: ExprValue): boolean {
    return !(v === '' || v === 0 || v === false || v === null);
}

function asString(v: ExprValue): string {
    if (v === null) return '';
    return String(v);
}

function equals(a: ExprValue, b: ExprValue): boolean {
    if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
    if (typeof a === 'boolean' || typeof b === 'boolean') return truthy(a) === truthy(b);
    return asString(a).toLowerCase() === asString(b).toLowerCase();
}

class Parser {
    private pos = 0;
    constructor(private readonly toks: Tok[], private readonly ctx: ExprContext, private readonly src: string) {}

    parse(): ExprValue {
        const v = this.or();
        if (this.pos !== this.toks.length) throw new UnsupportedExpression(`trailing tokens in: ${this.src}`);
        return v;
    }

    private peek(v: string): boolean {
        const t = this.toks[this.pos];
        return t !== undefined && t.t === 'op' && t.v === v;
    }

    private expect(v: string): void {
        if (!this.peek(v)) throw new UnsupportedExpression(`expected ${v} in: ${this.src}`);
        this.pos++;
    }

    private or(): ExprValue {
        let left = this.and();
        while (this.peek('||')) {
            this.pos++;
            const right = this.and();
            left = truthy(left) ? left : right;
        }
        return left;
    }

    private and(): ExprValue {
        let left = this.cmp();
        while (this.peek('&&')) {
            this.pos++;
            const right = this.cmp();
            left = truthy(left) ? right : left;
        }
        return left;
    }

    private cmp(): ExprValue {
        const left = this.unary();
        for (const op of ['==', '!=']) {
            if (this.peek(op)) {
                this.pos++;
                const right = this.unary();
                return op === '==' ? equals(left, right) : !equals(left, right);
            }
        }
        for (const op of ['<', '>', '<=', '>=']) {
            if (this.peek(op)) throw new UnsupportedExpression(`operator ${op} in: ${this.src}`);
        }
        return left;
    }

    private unary(): ExprValue {
        if (this.peek('!')) {
            this.pos++;
            return !truthy(this.unary());
        }
        return this.primary();
    }

    private primary(): ExprValue {
        const t = this.toks[this.pos];
        if (t === undefined) throw new UnsupportedExpression(`unexpected end of: ${this.src}`);
        if (t.t === 'op' && t.v === '(') {
            this.pos++;
            const v = this.or();
            this.expect(')');
            return v;
        }
        this.pos++;
        if (t.t === 'str') return t.v;
        if (t.t === 'num') return t.v;
        if (t.t !== 'id') throw new UnsupportedExpression(`unexpected ${t.v} in: ${this.src}`);
        if (t.v === 'true') return true;
        if (t.v === 'false') return false;
        if (t.v === 'null') return null;
        if (this.peek('(')) return this.call(t.v);
        return this.resolve(t.v);
    }

    private call(name: string): ExprValue {
        this.expect('(');
        const args: ExprValue[] = [];
        if (!this.peek(')')) {
            args.push(this.or());
            while (this.peek(',')) { this.pos++; args.push(this.or()); }
        }
        this.expect(')');
        switch (name) {
            case 'always': return true;
            case 'cancelled': return false;
            case 'success': return this.ctx.jobSucceeded;
            case 'failure': return !this.ctx.jobSucceeded;
            case 'startsWith': return asString(args[0] ?? '').toLowerCase().startsWith(asString(args[1] ?? '').toLowerCase());
            case 'endsWith': return asString(args[0] ?? '').toLowerCase().endsWith(asString(args[1] ?? '').toLowerCase());
            case 'contains': return asString(args[0] ?? '').toLowerCase().includes(asString(args[1] ?? '').toLowerCase());
            default: throw new UnsupportedExpression(`function ${name}() in: ${this.src}`);
        }
    }

    private resolve(path: string): ExprValue {
        const parts = path.split('.');
        if (parts[0] === 'steps') {
            const step = this.ctx.steps[parts[1] ?? ''];
            if (parts[2] === 'outputs' && parts.length === 4) return step?.outputs[parts[3] ?? ''] ?? '';
            if ((parts[2] === 'outcome' || parts[2] === 'conclusion') && parts.length === 3) return step?.outcome ?? '';
            throw new UnsupportedExpression(`step reference ${path} in: ${this.src}`);
        }
        const v = this.ctx.lookup(path);
        if (v === undefined) throw new UnsupportedExpression(`unknown context ${path} in: ${this.src}`);
        return v;
    }
}

/** Evaluate one expression body (the text between `${{` and `}}`, or a bare `if:`). */
export function evaluate(src: string, ctx: ExprContext): ExprValue {
    return new Parser(tokenize(src), ctx, src).parse();
}

const STATUS_FN = /\b(always|success|failure|cancelled)\s*\(/;

/**
 * Evaluate an `if:` value: a bare expression or one wrapped in `${{ }}`.
 * As on Actions, a condition that names no status function is implicitly
 * `success() && (…)`, so a step after a failure stays skipped unless its
 * condition says otherwise.
 */
export function evaluateCondition(raw: string | boolean | undefined, ctx: ExprContext): boolean {
    if (raw === undefined) return ctx.jobSucceeded;
    if (typeof raw === 'boolean') return raw && ctx.jobSucceeded;
    const m = /^\s*\$\{\{([\s\S]*)\}\}\s*$/.exec(raw);
    const body = m?.[1] ?? raw;
    const value = truthy(evaluate(body, ctx));
    return STATUS_FN.test(body) ? value : value && ctx.jobSucceeded;
}

/** Replace every `${{ … }}` in a string with its value. */
export function interpolate(text: string, ctx: ExprContext): string {
    return text.replace(/\$\{\{([\s\S]*?)\}\}/g, (_all, body: string) => asString(evaluate(body, ctx)));
}
