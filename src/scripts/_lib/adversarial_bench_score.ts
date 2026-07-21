/**
 * Deterministic scorer for the adversarial-council residual-detection benchmark
 * (road-to-adversarial-council-benchmark Phase 1).
 *
 * Pure + countable — never LLM-computed (the anti-lesson from ADR-122). Given a
 * corpus item's ground truth and a reviewer's structured findings, decide
 * whether the reviewer CAUGHT the planted defect (for a defect fixture) or
 * raised a FALSE POSITIVE (for a clean control). The two-stage recalls and FP
 * rates this produces feed `evaluateCouncilBench` (adversarial_council_gate.ts).
 *
 * Matching rule (deliberately NOT exact file:line — the scorer bug from the
 * earlier defect-finding benchmark required an exact line token and mis-scored
 * genuine catches that cited a nearby line): a finding CATCHES a planted defect
 * iff it names one of the defect's file(s) by basename AND its category falls in
 * the same normalized family as the planted defect. Line numbers are advisory,
 * never required. This credits a real catch that localizes the right file +
 * defect class, and denies credit for a scattershot "something's wrong here"
 * with the wrong class.
 */

/** Normalize a free-form category string to a coarse family. */
export function categoryFamily(raw: string): string {
    const c = raw.toLowerCase().replace(/[^a-z]/g, '');
    if (/(accesscontrol|authz|authorization|idor|bola|ownership|privilege|rbac)/.test(c)) return 'access-control';
    if (/(auth|authentication|session|credential|login)/.test(c)) return 'auth';
    if (/(ssrf|serverside)/.test(c)) return 'ssrf';
    if (/(pathtraversal|traversal|directorytraversal|lfi)/.test(c)) return 'path-traversal';
    // NB: no bare "rce" token — it substring-matches inside "resou[rce]leak".
    if (/(injection|sqli|xss|commandinjection|deserial|remotecodeexec)/.test(c)) return 'injection';
    if (/(crypto|cryptographic|timing|constanttime|hash|signature)/.test(c)) return 'crypto';
    if (/(concurrency|race|atomic|deadlock|idempoten)/.test(c)) return 'concurrency';
    if (/(resourceleak|leak|memory|handle|unsubscrib|cleanup)/.test(c)) return 'resource-leak';
    if (/(dataintegrity|integrity|corrupt|consistency|stale)/.test(c)) return 'data-integrity';
    if (/(correctness|logic|offbyone|boundary|edgecase|bug)/.test(c)) return 'correctness';
    return 'other';
}

export interface Finding {
    /** File the finding points at (any path form; matched by basename). */
    file: string;
    /** Reviewer-supplied category (free text; normalized via categoryFamily). */
    category: string;
    /** Reviewer confidence, if given. Low-confidence findings can be excluded from FP counting. */
    confidence?: 'high' | 'medium' | 'low';
}

export interface GroundTruth {
    id: string;
    /** true = clean control (no defect); a finding here is a false positive. */
    is_clean: boolean;
    /** Basenames of the file(s) the planted defect lives in (empty for clean). */
    defect_files: string[];
    /** Planted defect category family (via categoryFamily); empty for clean. */
    defect_category: string;
}

function basename(p: string): string {
    return p.split(/[\\/]/).pop() ?? p;
}

/**
 * Did the reviewer CATCH the planted defect? file-basename match on any defect
 * file AND category-family match. Clean controls always return false (they have
 * no defect to catch — use `isFalsePositive` for them).
 */
export function caughtDefect(truth: GroundTruth, findings: Finding[]): boolean {
    if (truth.is_clean) return false;
    const wantFiles = new Set(truth.defect_files.map(basename));
    const wantFamily = truth.defect_category;
    return findings.some(
        (f) => wantFiles.has(basename(f.file)) && categoryFamily(f.category) === wantFamily,
    );
}

/**
 * Did the reviewer raise a FALSE POSITIVE on a clean control? Any finding that
 * points at the control file counts (a claimed defect where none exists).
 * Low-confidence findings are excluded — a hedged "might check X" is not a FP
 * claim. Non-clean fixtures always return false.
 */
export function isFalsePositive(truth: GroundTruth, findings: Finding[]): boolean {
    if (!truth.is_clean) return false;
    return findings.some((f) => (f.confidence ?? 'high') !== 'low');
}

export interface StageResult {
    /** Per-defect-fixture: id → caught?. Excludes clean controls. */
    caught: Record<string, boolean>;
    /** Per-clean-control: id → false-positive?. */
    fp: Record<string, boolean>;
}

/** Recall over a set of defect ids, given per-id caught flags. */
export function recall(caught: Record<string, boolean>): number {
    const ids = Object.keys(caught);
    if (ids.length === 0) return 0;
    const hits = ids.filter((id) => caught[id]).length;
    return hits / ids.length;
}

/** FP rate over clean controls. */
export function fpRate(fp: Record<string, boolean>): number {
    const ids = Object.keys(fp);
    if (ids.length === 0) return 0;
    return ids.filter((id) => fp[id]).length / ids.length;
}
