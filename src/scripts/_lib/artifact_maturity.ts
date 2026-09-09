/**
 * `spec.maturity` — the artefact-maturity axis as a resolved field with
 * provenance, not as a prose table two surfaces each keep a copy of.
 *
 * The axis itself is already decided. `design-fidelity.md` § Two axes states
 * it: maturity is a property of the ARTEFACT, mandate is a property of the
 * INSTRUCTION, and reproducing a wireframe's placeholder greys 1:1 honours the
 * wrong half of the artefact. `design-fidelity-mechanics § Artefact maturity`
 * carries the low-versus-finished table. What was missing is a value anything
 * can read: the table was prose, so every consumer re-derived it by eye and two
 * consumers could disagree without either being wrong about the text.
 *
 * **Two-valued on purpose, and not the same axis as `ReferenceMaturity`.**
 * `ui_authority.ts` carries a five-valued `ReferenceMaturity`
 * (`wireframe` | `prototype` | `finished-comp` | `runnable-artifact` |
 * `production-incumbent`) answering *what kind of thing is this*. This answers
 * the narrower question the rule actually branches on: *does its pixel detail
 * carry decisions*. `mapReferenceMaturity` below is the one place the two are
 * related, so a future edit to either enum has exactly one seam to update
 * rather than a scattering of `=== 'wireframe'` comparisons.
 *
 * **The resolution ladder, and why `finished` is the default.** A user signal
 * beats everything, then the artefact's own declaration, then inference from
 * its content, then the default. The default is `finished` because the rule
 * says so in as many words — *"When the artefact does not declare its maturity,
 * it is treated as finished: the 1:1 floor is stricter, and guessing low
 * fidelity would authorise the redesign this rule prevents."* Defaulting the
 * other way would make silence a licence.
 */

/** Does the artefact's pixel detail carry decisions, or placeholders? */
export type ArtifactMaturity = 'low' | 'finished';

/** Which rung of the ladder produced the verdict. */
export type MaturitySource = 'user' | 'declaration' | 'inference' | 'default';

export interface MaturityVerdict {
    maturity: ArtifactMaturity;
    source: MaturitySource;
    /**
     * The concrete thing that decided it, quotable back to the user. Never a
     * restatement of the verdict — "the artefact declares itself a wireframe"
     * is a signal, "it is low fidelity" is not.
     */
    signal: string;
}

/** Everything the resolver may look at. Every field is optional by design. */
export interface MaturityInput {
    /** What the user said this run. Beats every other rung. */
    userSignal?: ArtifactMaturity | null;
    /** A `spec.maturity` the artefact carries about itself. */
    declared?: string | null;
    /** The artefact's filename, if it has one. */
    filename?: string | null;
    /** The artefact's own body — markup, CSS, or a token file's text. */
    body?: string | null;
    /** A five-valued `ReferenceMaturity` already resolved elsewhere. */
    referenceMaturity?: string | null;
}

/**
 * The one seam between the five-valued `ReferenceMaturity` and this axis.
 * Returns `null` for a value that does not decide the question.
 */
export function mapReferenceMaturity(value: string | null | undefined): ArtifactMaturity | null {
    switch (value) {
        case 'wireframe':
            return 'low';
        case 'finished-comp':
        case 'runnable-artifact':
        case 'production-incumbent':
            return 'finished';
        // `prototype` is deliberately unmapped: the word covers both a greybox
        // click-through and a pixel-complete interactive build, so mapping it
        // either way would decide by vocabulary rather than by evidence. It
        // falls through to inference, which reads the artefact itself.
        default:
            return null;
    }
}

/** Markers an artefact uses to declare itself low-fidelity. */
const LOW_DECLARATIONS = new Set(['low', 'low-fidelity', 'lofi', 'lo-fi', 'wireframe', 'sketch']);
/** Markers an artefact uses to declare itself finished. */
const FINISHED_DECLARATIONS = new Set([
    'finished',
    'final',
    'high',
    'high-fidelity',
    'hifi',
    'hi-fi',
    'comp',
    'production',
]);

/** Content tells that the pixels are placeholders rather than decisions. */
const LOW_CONTENT_TELLS: ReadonlyArray<readonly [RegExp, string]> = [
    [/lorem\s+ipsum/i, 'placeholder copy (lorem ipsum) in the body'],
    [/\bwireframe\b/i, 'the body calls itself a wireframe'],
    [/\bgreybox\b|\bgraybox\b/i, 'the body describes greybox placeholders'],
    // NOT a bare `\bplaceholder\b`. That fired on
    // `<input placeholder="you@example.com">` in the committed finished
    // fixture — an ordinary HTML attribute, present in most real forms, and
    // the single broadest false positive available on this axis. The tell is
    // the artefact CALLING ITS OWN CONTENT placeholder, so the noun has to
    // follow.
    [
        /placeholder\s+(?:copy|content|text|image|images|art|asset|assets|data)\b/i,
        'the body marks its own content as placeholder',
    ],
];

function normalizeDeclaration(value: string): string {
    return value.trim().toLowerCase();
}

/**
 * True when every colour the body states is greyscale — the canonical wireframe
 * tell, and the one the rule names by hand ("reproducing a wireframe's
 * placeholder grays"). Requires at least two colours so a one-off `#fff`
 * in an otherwise colourless token file does not decide anything.
 */
export function isGreyscaleOnly(body: string): boolean {
    const hexes = body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    if (hexes.length < 2) return false;
    return hexes.every((hex) => {
        const raw = hex.slice(1);
        const six =
            raw.length === 3
                ? raw
                      .split('')
                      .map((c) => c + c)
                      .join('')
                : raw.slice(0, 6);
        if (six.length < 6) return false;
        const r = parseInt(six.slice(0, 2), 16);
        const g = parseInt(six.slice(2, 4), 16);
        const b = parseInt(six.slice(4, 6), 16);
        return r === g && g === b;
    });
}

/**
 * Resolve the artefact's maturity, naming the signal that decided it.
 *
 * Never throws: an unreadable or absent artefact resolves `finished` by
 * default, which is the conservative direction — see the header.
 */
export function resolveArtifactMaturity(input: MaturityInput = {}): MaturityVerdict {
    // 1. The user. `design-fidelity` § Two axes: a user signal beats any
    //    inference, because the human can see what the heuristic cannot.
    if (input.userSignal === 'low' || input.userSignal === 'finished') {
        return {
            maturity: input.userSignal,
            source: 'user',
            signal: `the user stated the artefact is ${input.userSignal} fidelity`,
        };
    }

    // 2. The artefact's own declaration — the case the rule's Iron Law names.
    if (typeof input.declared === 'string' && input.declared.trim() !== '') {
        const declared = normalizeDeclaration(input.declared);
        if (LOW_DECLARATIONS.has(declared)) {
            return {
                maturity: 'low',
                source: 'declaration',
                signal: `the artefact declares \`maturity: ${declared}\``,
            };
        }
        if (FINISHED_DECLARATIONS.has(declared)) {
            return {
                maturity: 'finished',
                source: 'declaration',
                signal: `the artefact declares \`maturity: ${declared}\``,
            };
        }
        // An unrecognised declaration is NOT silently treated as absent: it is
        // a statement the resolver could not read, and saying so beats guessing.
        return {
            maturity: 'finished',
            source: 'default',
            signal: `the artefact declares \`maturity: ${declared}\`, which is not a value this resolver knows — defaulting to finished`,
        };
    }

    // 3. A ReferenceMaturity already resolved upstream, where it decides.
    const mapped = mapReferenceMaturity(input.referenceMaturity);
    if (mapped !== null) {
        return {
            maturity: mapped,
            source: 'inference',
            signal: `reference_maturity is \`${String(input.referenceMaturity)}\``,
        };
    }

    // 4. The filename. Cheap, and the one signal present even when the body is
    //    not readable.
    if (typeof input.filename === 'string' && /wireframe|wf-|lofi|lo-fi/i.test(input.filename)) {
        return {
            maturity: 'low',
            source: 'inference',
            signal: `the filename \`${input.filename}\` names a wireframe`,
        };
    }

    // 5. The body.
    if (typeof input.body === 'string' && input.body !== '') {
        for (const [pattern, why] of LOW_CONTENT_TELLS) {
            if (pattern.test(input.body)) {
                return { maturity: 'low', source: 'inference', signal: why };
            }
        }
        if (isGreyscaleOnly(input.body)) {
            return {
                maturity: 'low',
                source: 'inference',
                signal: 'every colour in the body is greyscale',
            };
        }
    }

    // 6. Default — finished, deliberately. Silence is not a licence to redesign.
    return {
        maturity: 'finished',
        source: 'default',
        signal: 'the artefact declares no maturity and shows no low-fidelity tell',
    };
}
