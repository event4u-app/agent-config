/**
 * The closed vocabulary the verification-tampering detector speaks.
 *
 * Declared in its own module, and declared BEFORE the detector, because the
 * roadmap step that asks for it (`road-to-deterministic-defect-detectors` 1.1)
 * asks for exactly that ordering: a detector that invents its ids while it is
 * being written ends up with the ids its implementation found easy, not the
 * ids the failure classes need. Every id below has a fixture in
 * `tests/fixtures/tamper-corpus/`, committed one commit earlier.
 *
 * ## Why the outcome type extends `GateOutcome` instead of replacing it
 *
 * `_lib/gate_result.ts` already separates "the check ran and found something"
 * (`violations`) from "the check could not run" (`crashed`) from "the
 * measurement is void" (`estate_invalid`). That distinction is the one a tamper
 * detector most needs — a detector that crashed reporting `clean` is precisely
 * the phantom green it exists to catch — so it is reused verbatim rather than
 * re-spelled.
 *
 * Exactly ONE member is added, and only because `GateOutcome` cannot express
 * it: `stale_verdict`. A runner that exited 0 before the last edit produces a
 * green exit code over a tree that no longer exists. `clean` would launder it;
 * `violations` would claim a finding nobody made; `crashed` would claim the
 * runner failed when it succeeded — at the wrong time. The state is "it ran,
 * it passed, and it is not evidence", and none of the four existing members
 * says that. Adding a fifth member is a smaller change than a second
 * vocabulary, which is what 1.1 forbids.
 *
 * ## Severity, and the one contested call
 *
 * Six ids are `block`. `verification-skipped` is `warn`, and that is not a
 * confidence statement about the detection — an added `it.skip` is as
 * mechanically certain as an added `.only`. It is a statement about the
 * ACT: the source this roadmap came from is split on whether adding a skip
 * on the way to green is tampering or triage, and this repository does not
 * promote a class to blocking on a split. It ships `warn` with the corpus as
 * the evidence a later promotion would need.
 *
 * ## The escape hatch is scoped to one id, deliberately
 *
 * A blanket `tamper-allow` in a commit message would suppress every detector at
 * once, which turns one honest exception into a general amnesty. The grammar
 * therefore names the id: `tamper-allow: <detector-id> — <reason>`. The reason
 * floor mirrors `check_gate_completeness.MIN_REASON_CHARS` (20) and exists for
 * the same reason stated there — it rejects `n/a`, and it cannot judge whether
 * a reason is true, which stays a human read.
 */
import type { GateOutcome } from './gate_result.js';

/** Every tampering class the detector can name. Closed set. */
export type TamperDetectorId =
    | 'assertion-removed'
    | 'assertion-weakened'
    | 'verification-skipped'
    | 'expectation-rewritten'
    | 'early-exit-injected'
    | 'test-file-deleted'
    | 'subject-mocked-away';

export type TamperSeverity = 'block' | 'warn';

export interface TamperDetectorSpec {
    id: TamperDetectorId;
    severity: TamperSeverity;
    /** What shape in the diff fires this id. */
    what: string;
    /** Why that shape is a weakened verification rather than ordinary work. */
    why: string;
}

export const TAMPER_DETECTORS: readonly TamperDetectorSpec[] = [
    {
        id: 'assertion-removed',
        severity: 'block',
        what: 'a removed assertion line with no assertion added in the same hunk',
        why: 'the check that could fail is gone; what remains passes for a wider set of outputs',
    },
    {
        id: 'assertion-weakened',
        severity: 'block',
        what: 'a removed assertion replaced in the same hunk by one lower on the strength ladder',
        why: 'an exact-value check became an existence check, which passes for the broken output too',
    },
    {
        id: 'verification-skipped',
        severity: 'warn',
        what: 'an added skip / xfail / only / ignore marker on a test',
        why: 'the assertion survives the diff and stops running, which is the same thing at verdict time',
    },
    {
        id: 'expectation-rewritten',
        severity: 'block',
        what: 'the same assertion call on both sides of a hunk with a different literal expected value',
        why: 'the expectation moved onto whatever the code now emits, so the test can no longer disagree with it',
    },
    {
        id: 'early-exit-injected',
        severity: 'block',
        what: 'an added unconditional return or exit above surviving assertions in a test body',
        why: 'the test reports green having executed none of the verification below it',
    },
    {
        id: 'test-file-deleted',
        severity: 'block',
        what: 'a test file deleted outright by the diff',
        why: 'the fastest route to a green suite is the one that verifies nothing',
    },
    {
        id: 'subject-mocked-away',
        severity: 'block',
        what: 'an added mock or stub whose target also appears on a removed line of the same file',
        why: 'the function under test is replaced by a stub, so the test now asserts against its own fixture',
    },
] as const;

/** Ids in declaration order — the canonical listing order for output. */
export const TAMPER_DETECTOR_IDS: readonly TamperDetectorId[] = TAMPER_DETECTORS.map((d) => d.id);

const BY_ID = new Map<string, TamperDetectorSpec>(TAMPER_DETECTORS.map((d) => [d.id, d]));

/** True when `id` is a member of the closed set. */
export function isTamperDetectorId(id: string): id is TamperDetectorId {
    return BY_ID.has(id);
}

export function detectorSpec(id: TamperDetectorId): TamperDetectorSpec {
    const spec = BY_ID.get(id);
    /* c8 ignore next 3 -- unreachable while the map is built from the same array */
    if (spec === undefined) {
        throw new Error(`unknown tamper detector id: ${id}`);
    }
    return spec;
}

/**
 * The loop's outcome vocabulary: `GateOutcome` plus the one state it cannot say.
 *
 * See the module header for why this is an extension of four members rather
 * than a parallel set of five.
 */
export type LoopOutcome = GateOutcome | 'stale_verdict';

/**
 * One finding. `file` and `line` are mandatory and are checked at runtime by
 * {@link assertWellFormed} — a finding without a location is a claim a reader
 * cannot check, which is the shape of report this tree already refuses.
 */
export interface TamperFinding {
    id: TamperDetectorId;
    severity: TamperSeverity;
    /** Repo-relative path as it appears in the diff header. */
    file: string;
    /** 1-based line number in the side of the diff the evidence lives on. */
    line: number;
    /** Which side `line` indexes — a removal has no post-image line. */
    side: 'added' | 'removed';
    /** The offending line, trimmed. Never empty. */
    evidence: string;
}

/**
 * Reject a finding that cannot be located.
 *
 * Deliberately a throw and not a filter: a detector that silently drops its own
 * malformed findings under-reports, and under-reporting is the failure mode the
 * whole detector exists to close.
 */
export function assertWellFormed(finding: TamperFinding): TamperFinding {
    if (finding.file.trim() === '') {
        throw new Error(`tamper finding ${finding.id} carries no file`);
    }
    if (!Number.isInteger(finding.line) || finding.line < 1) {
        throw new Error(
            `tamper finding ${finding.id} in ${finding.file} carries no usable line ` +
                `(got ${String(finding.line)}); every finding must be locatable as file:line`,
        );
    }
    if (finding.evidence.trim() === '') {
        throw new Error(`tamper finding ${finding.id} at ${finding.file}:${String(finding.line)} carries no evidence text`);
    }
    return finding;
}

/** `path/to/file.ts:12` — the one location format the detector prints. */
export function locate(finding: TamperFinding): string {
    return `${finding.file}:${String(finding.line)}`;
}

/**
 * Grammar of the scoped escape hatch, read from a commit message.
 *
 * Both an em dash and a plain hyphen are accepted as the separator: the
 * repository writes em dashes in prose, and a contributor typing this into
 * `git commit` will reach for `-`. Rejecting the hyphen would make the hatch
 * fail in the direction that hides a legitimate change.
 */
export const TAMPER_ALLOW_RE = /^\s*tamper-allow:\s*([a-z-]+)\s*(?:—|--|-)\s*(.+)$/gim;

/** Mirrors `check_gate_completeness.MIN_REASON_CHARS` — rejects `n/a`, judges nothing. */
export const MIN_ALLOW_REASON_CHARS = 20;

export interface AllowDeclaration {
    id: TamperDetectorId;
    reason: string;
}

export interface AllowParse {
    allowed: Set<TamperDetectorId>;
    /** Declarations that named an unknown id or gave too short a reason. */
    malformed: string[];
}

/**
 * Parse every `tamper-allow:` line out of a commit message.
 *
 * A malformed declaration does NOT suppress anything and is reported instead:
 * a typo'd id that silently allowed nothing would read to its author as an
 * accepted exception, and a typo'd id that silently allowed everything would be
 * the amnesty this grammar exists to prevent.
 */
export function parseAllowDeclarations(message: string): AllowParse {
    const allowed = new Set<TamperDetectorId>();
    const malformed: string[] = [];
    TAMPER_ALLOW_RE.lastIndex = 0;
    for (const match of message.matchAll(TAMPER_ALLOW_RE)) {
        const rawId = (match[1] ?? '').trim();
        const reason = (match[2] ?? '').trim();
        if (!isTamperDetectorId(rawId)) {
            malformed.push(`tamper-allow names an unknown detector id: "${rawId}"`);
            continue;
        }
        if (reason.length < MIN_ALLOW_REASON_CHARS) {
            malformed.push(
                `tamper-allow for "${rawId}" gives a ${String(reason.length)}-character reason; ` +
                    `at least ${String(MIN_ALLOW_REASON_CHARS)} are required`,
            );
            continue;
        }
        allowed.add(rawId);
    }
    return { allowed, malformed };
}
