/**
 * Offloadable-call catalog for R-A8 (thin-request-path, F9) and R-A10
 * (durable-async, F11) — spike S0.5, road-to-scale-and-history-discipline.
 *
 * The catalog is CONFIG DATA, not detector logic: a positive list of
 * expensive call classes per stack. A single indexed insert or a cache op is
 * never in the catalog — over-application (queueing trivially cheap work) is
 * the failure mode this shape prevents.
 */

export interface CatalogEntry {
    /** Regex source matched against a single (masked) code line. */
    pattern: string;
    /** Human label used in the finding message. */
    label: string;
    /**
     * Whether losing this work silently is unacceptable (drives F11 for
     * fire-and-forget shapes): promised emails, billing, webhooks out.
     */
    must_not_lose: boolean;
}

export interface StackCatalog {
    /** Offloadable call classes — firing inside a request handler is F9. */
    offloadable: CatalogEntry[];
    /**
     * Patterns that are the CORRECT offload shape — their presence on the
     * same line neutralizes an offloadable match (e.g. Mail::queue).
     */
    allowed_alternatives: string[];
}

export const ELOQUENT_CATALOG: StackCatalog = {
    offloadable: [
        { pattern: String.raw`\bMail::send\s*\(`, label: 'synchronous mail send', must_not_lose: true },
        { pattern: String.raw`\bMail::to\s*\([^)]*\)\s*->\s*send\s*\(`, label: 'synchronous mail send', must_not_lose: true },
        { pattern: String.raw`\bHttp::`, label: 'outbound HTTP call', must_not_lose: false },
        { pattern: String.raw`\b(PDF|Pdf)::loadView\s*\(`, label: 'PDF generation', must_not_lose: false },
        { pattern: String.raw`\bExcel::store\s*\(`, label: 'spreadsheet export to storage', must_not_lose: false },
        { pattern: String.raw`\bImage::make\s*\(`, label: 'image processing chain', must_not_lose: false },
        { pattern: String.raw`\bBrowsershot::`, label: 'headless-browser rendering', must_not_lose: false },
        { pattern: String.raw`new\s+\\?Stripe\\StripeClient\b|\bStripe\\\w+::`, label: 'payment SDK call', must_not_lose: true },
        { pattern: String.raw`\bTwilio\\|\bnew\s+\\?Twilio\b`, label: 'SMS/voice SDK call', must_not_lose: true },
        { pattern: String.raw`\bOpenAI::|\bAnthropic\\|\bAnthropic::`, label: 'ML/AI inference call', must_not_lose: false },
    ],
    allowed_alternatives: [
        String.raw`\bMail::queue\s*\(`,
        String.raw`->\s*queue\s*\(`,
    ],
};

export const TS_CATALOG: StackCatalog = {
    offloadable: [
        { pattern: String.raw`\.sendMail\s*\(`, label: 'synchronous mail send', must_not_lose: true },
        { pattern: String.raw`\b(fetch|axios(\.\w+)?)\s*\(\s*['"\`]https?://`, label: 'outbound HTTP call', must_not_lose: false },
        { pattern: String.raw`\bpuppeteer\.launch\s*\(|\bchromium\.launch\s*\(`, label: 'headless-browser rendering', must_not_lose: false },
        { pattern: String.raw`\bsharp\s*\([^)]*\)\s*\.`, label: 'image processing chain', must_not_lose: false },
        { pattern: String.raw`\.chat\.completions\.create\s*\(|\banthropic\.messages\.create\s*\(`, label: 'ML/AI inference call', must_not_lose: false },
        { pattern: String.raw`\bstripe\.\w+(\.\w+)*\.create\s*\(`, label: 'payment SDK call', must_not_lose: true },
        { pattern: String.raw`\.updateMany\s*\(\s*\{\s*data\s*:`, label: 'unbounded bulk mutation', must_not_lose: false },
    ],
    allowed_alternatives: [
        String.raw`\bqueue\.add\s*\(`,
        String.raw`\.add\s*\(\s*['"\`]`,
    ],
};

/**
 * Job-class names whose loss is unacceptable — drives the
 * dispatchAfterResponse / fire-and-forget F11 checks.
 */
export const MUST_NOT_LOSE_NAME_RE =
    /(Mail|Email|Invoice|Webhook|Payment|Billing|Notification|Receipt)/;
